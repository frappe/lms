# Copyright 2007 Matt Chaput. All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#    1. Redistributions of source code must retain the above copyright notice,
#       this list of conditions and the following disclaimer.
#
#    2. Redistributions in binary form must reproduce the above copyright
#       notice, this list of conditions and the following disclaimer in the
#       documentation and/or other materials provided with the distribution.
#
# THIS SOFTWARE IS PROVIDED BY MATT CHAPUT ``AS IS'' AND ANY EXPRESS OR
# IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
# EVENT SHALL MATT CHAPUT OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
# INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
# LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
# OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
# LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
# NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
# EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#
# The views and conclusions contained in the software and documentation are
# those of the authors and should not be interpreted as representing official
# policies, either expressed or implied, of Matt Chaput.

"""This module contains classes and functions related to searching the index.
"""


from __future__ import division
import copy
import weakref
from math import ceil

from whoosh import classify, highlight, query, scoring
from whoosh.compat import iteritems, itervalues, iterkeys, xrange
from whoosh.idsets import DocIdSet, BitSet
from whoosh.reading import TermNotFound
from whoosh.util.cache import lru_cache


class NoTermsException(Exception):
    """Exception raised you try to access matched terms on a :class:`Results`
    object was created without them. To record which terms matched in which
    document, you need to call the :meth:`Searcher.search` method with
    ``terms=True``.
    """

    message = "Results were created without recording terms"


class TimeLimit(Exception):
    """Raised by :class:`TimeLimitedCollector` if the time limit is reached
    before the search finishes. If you have a reference to the collector, you
    can get partial results by calling :meth:`TimeLimitedCollector.results`.
    """

    pass


# Context class

class SearchContext(object):
    """A container for information about the current search that may be used
    by the collector or the query objects to change how they operate.
    """

    def __init__(self, needs_current=False, weighting=None, top_query=None,
                 limit=0):
        """
        :param needs_current: if True, the search requires that the matcher
            tree be "valid" and able to access information about the current
            match. For queries during matcher instantiation, this means they
            should not instantiate a matcher that doesn't allow access to the
            current match's value, weight, and so on. For collectors, this
            means they should advanced the matcher doc-by-doc rather than using
            shortcut methods such as all_ids().
        :param weighting: the Weighting object to use for scoring documents.
        :param top_query: a reference to the top-level query object.
        :param limit: the number of results requested by the user.
        """

        self.needs_current = needs_current
        self.weighting = weighting
        self.top_query = top_query
        self.limit = limit

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self.__dict__)

    def set(self, **kwargs):
        ctx = copy.copy(self)
        ctx.__dict__.update(kwargs)
        return ctx


# Searcher class

class Searcher(object):
    """Wraps an :class:`~whoosh.reading.IndexReader` object and provides
    methods for searching the index.
    """

    def __init__(self, reader, weighting=scoring.BM25F, closereader=True,
                 fromindex=None, parent=None):
        """
        :param reader: An :class:`~whoosh.reading.IndexReader` object for
            the index to search.
        :param weighting: A :class:`whoosh.scoring.Weighting` object to use to
            score found documents.
        :param closereader: Whether the underlying reader will be closed when
            the searcher is closed.
        :param fromindex: An optional reference to the index of the underlying
            reader. This is required for :meth:`Searcher.up_to_date` and
            :meth:`Searcher.refresh` to work.
        """

        self.ixreader = reader
        self.is_closed = False
        self._closereader = closereader
        self._ix = fromindex
        self._doccount = self.ixreader.doc_count_all()
        # Cache for PostingCategorizer objects (supports fields without columns)
        self._field_caches = {}

        if parent:
            self.parent = weakref.ref(parent)
            self.schema = parent.schema
            self._idf_cache = parent._idf_cache
            self._filter_cache = parent._filter_cache
        else:
            self.parent = None
            self.schema = self.ixreader.schema
            self._idf_cache = {}
            self._filter_cache = {}

        if type(weighting) is type:
            self.weighting = weighting()
        else:
            self.weighting = weighting

        self.leafreaders = None
        self.subsearchers = None
        if not self.ixreader.is_atomic():
            self.leafreaders = self.ixreader.leaf_readers()
            self.subsearchers = [(self._subsearcher(r), offset) for r, offset
                                 in self.leafreaders]

        # Copy attributes/methods from wrapped reader
        for name in ("stored_fields", "all_stored_fields", "has_vector",
                     "vector", "vector_as", "lexicon", "field_terms",
                     "frequency", "doc_frequency", "term_info",
                     "doc_field_length", "corrector", "iter_docs"):
            setattr(self, name, getattr(self.ixreader, name))

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()

    def _subsearcher(self, reader):
        return self.__class__(reader, fromindex=self._ix,
                              weighting=self.weighting, parent=self)

    def _offset_for_subsearcher(self, subsearcher):
        for ss, offset in self.subsearchers:
            if ss is subsearcher:
                return offset

    def leaf_searchers(self):
        if self.is_atomic():
            return [(self, 0)]
        else:
            return self.subsearchers

    def is_atomic(self):
        return self.reader().is_atomic()

    def has_parent(self):
        return self.parent is not None

    def get_parent(self):
        """Returns the parent of this searcher (if has_parent() is True), or
        else self.
        """

        if self.has_parent():
            # Call the weak reference to get the parent searcher
            return self.parent()
        else:
            return self

    def doc_count(self):
        """Returns the number of UNDELETED documents in the index.
        """

        return self.ixreader.doc_count()

    def doc_count_all(self):
        """Returns the total number of documents, DELETED OR UNDELETED, in
        the index.
        """

        return self._doccount

    def field_length(self, fieldname):
        if self.has_parent():
            return self.get_parent().field_length(fieldname)
        else:
            return self.reader().field_length(fieldname)

    def max_field_length(self, fieldname):
        if self.has_parent():
            return self.get_parent().max_field_length(fieldname)
        else:
            return self.reader().max_field_length(fieldname)

    def up_to_date(self):
        """Returns True if this Searcher represents the latest version of the
        index, for backends that support versioning.
        """

        if not self._ix:
            raise Exception("No reference to index")
        return self._ix.latest_generation() == self.ixreader.generation()

    def refresh(self):
        """Returns a fresh searcher for the latest version of the index::

            my_searcher = my_searcher.refresh()

        If the index has not changed since this searcher was created, this
        searcher is simply returned.

        This method may CLOSE underlying resources that are no longer needed
        by the refreshed searcher, so you CANNOT continue to use the original
        searcher after calling ``refresh()`` on it.
        """

        if not self._ix:
            raise Exception("No reference to index")
        if self._ix.latest_generation() == self.reader().generation():
            return self

        # Get a new reader, re-using resources from the current reader if
        # possible
        self.is_closed = True
        newreader = self._ix.reader(reuse=self.ixreader)
        return self.__class__(newreader, fromindex=self._ix,
                              weighting=self.weighting)

    def close(self):
        if self._closereader:
            self.ixreader.close()
        self.is_closed = True

    def avg_field_length(self, fieldname, default=None):
        if not self.schema[fieldname].scorable:
            return default
        return self.field_length(fieldname) / (self._doccount or 1)

    def reader(self):
        """Returns the underlying :class:`~whoosh.reading.IndexReader`.
        """
        return self.ixreader

    def context(self, **kwargs):
        """Generates a :class:`SearchContext` for this searcher.
        """

        if "weighting" not in kwargs:
            kwargs["weighting"] = self.weighting

        return SearchContext(**kwargs)

    def boolean_context(self):
        """Shortcut returns a SearchContext set for unscored (boolean)
        searching.
        """

        return self.context(needs_current=False, weighting=None)

    def postings(self, fieldname, text, weighting=None, qf=1):
        """Returns a :class:`whoosh.matching.Matcher` for the postings of the
        given term. Unlike the :func:`whoosh.reading.IndexReader.postings`
        method, this method automatically sets the scoring functions on the
        matcher from the searcher's weighting object.
        """

        weighting = weighting or self.weighting
        globalscorer = weighting.scorer(self, fieldname, text, qf=qf)

        if self.is_atomic():
            return self.ixreader.postings(fieldname, text, scorer=globalscorer)
        else:
            from whoosh.matching import MultiMatcher

            matchers = []
            docoffsets = []
            term = (fieldname, text)
            for subsearcher, offset in self.subsearchers:
                r = subsearcher.reader()
                if term in r:
                    # Make a segment-specific scorer; the scorer should call
                    # searcher.parent() to get global stats
                    scorer = weighting.scorer(subsearcher, fieldname, text, qf=qf)
                    m = r.postings(fieldname, text, scorer=scorer)
                    matchers.append(m)
                    docoffsets.append(offset)

            if not matchers:
                raise TermNotFound(fieldname, text)

            return MultiMatcher(matchers, docoffsets, globalscorer)

    def idf(self, fieldname, text):
        """Calculates the Inverse Document Frequency of the current term (calls
        idf() on the searcher's Weighting object).
        """

        # This method just calls the Weighting object's idf() method, but
        # caches the result. So Weighting objects should call *this* method
        # which will then call *their own* idf() methods.

        cache = self._idf_cache
        term = (fieldname, text)
        if term in cache:
            return cache[term]

        idf = self.weighting.idf(self, fieldname, text)
        cache[term] = idf
        return idf

    def document(self, **kw):
        """Convenience method returns the stored fields of a document
        matching the given keyword arguments, where the keyword keys are
        field names and the values are terms that must appear in the field.

        This method is equivalent to::

            searcher.stored_fields(searcher.document_number(<keyword args>))

        Where Searcher.documents() returns a generator, this function returns
        either a dictionary or None. Use it when you assume the given keyword
        arguments either match zero or one documents (i.e. at least one of the
        fields is a unique key).

        >>> stored_fields = searcher.document(path=u"/a/b")
        >>> if stored_fields:
        ...   print(stored_fields['title'])
        ... else:
        ...   print("There is no document with the path /a/b")
        """

        for p in self.documents(**kw):
            return p

    def documents(self, **kw):
        """Convenience method returns the stored fields of a document
        matching the given keyword arguments, where the keyword keys are field
        names and the values are terms that must appear in the field.

        Returns a generator of dictionaries containing the stored fields of any
        documents matching the keyword arguments. If you do not specify any
        arguments (``Searcher.documents()``), this method will yield **all**
        documents.

        >>> for stored_fields in searcher.documents(emailto=u"matt@whoosh.ca"):
        ...   print("Email subject:", stored_fields['subject'])
        """

        ixreader = self.ixreader
        return (ixreader.stored_fields(docnum)
                for docnum in self.document_numbers(**kw))

    def _kw_to_text(self, kw):
        for k, v in iteritems(kw):
            field = self.schema[k]
            kw[k] = field.to_bytes(v)

    def _query_for_kw(self, kw):
        subqueries = []
        for key, value in iteritems(kw):
            subqueries.append(query.Term(key, value))
        if subqueries:
            q = query.And(subqueries).normalize()
        else:
            q = query.Every()
        return q

    def document_number(self, **kw):
        """Returns the document number of the document matching the given
        keyword arguments, where the keyword keys are field names and the
        values are terms that must appear in the field.

        >>> docnum = searcher.document_number(path=u"/a/b")

        Where Searcher.document_numbers() returns a generator, this function
        returns either an int or None. Use it when you assume the given keyword
        arguments either match zero or one documents (i.e. at least one of the
        fields is a unique key).

        :rtype: int
        """

        # In the common case where only one keyword was given, just use
        # first_id() instead of building a query.

        self._kw_to_text(kw)
        if len(kw) == 1:
            k, v = list(kw.items())[0]
            try:
                return self.reader().first_id(k, v)
            except TermNotFound:
                return None
        else:
            m = self._query_for_kw(kw).matcher(self, self.boolean_context())
            if m.is_active():
                return m.id()

    def document_numbers(self, **kw):
        """Returns a generator of the document numbers for documents matching
        the given keyword arguments, where the keyword keys are field names and
        the values are terms that must appear in the field. If you do not
        specify any arguments (``Searcher.document_numbers()``), this method
        will yield **all** document numbers.

        >>> docnums = list(searcher.document_numbers(emailto="matt@whoosh.ca"))
        """

        self._kw_to_text(kw)
        return self.docs_for_query(self._query_for_kw(kw))

    def _find_unique(self, uniques):
        # uniques is a list of ("unique_field_name", "field_value") tuples
        delset = set()
        for name, value in uniques:
            docnum = self.document_number(**{name: value})
            if docnum is not None:
                delset.add(docnum)
        return delset

    def _query_to_comb(self, fq):
        return BitSet(self.docs_for_query(fq), size=self.doc_count_all())

    def _filter_to_comb(self, obj):
        if obj is None:
            return None
        if isinstance(obj, (set, DocIdSet)):
            c = obj
        elif isinstance(obj, Results):
            c = obj.docs()
        elif isinstance(obj, ResultsPage):
            c = obj.results.docs()
        elif isinstance(obj, query.Query):
            c = self._query_to_comb(obj)
        else:
            raise Exception("Don't know what to do with filter object %r"
                            % obj)

        return c

    def suggest(self, fieldname, text, limit=5, maxdist=2, prefix=0):
        """Returns a sorted list of suggested corrections for the given
        mis-typed word ``text`` based on the contents of the given field::

            >>> searcher.suggest("content", "specail")
            ["special"]

        This is a convenience method. If you are planning to get suggestions
        for multiple words in the same field, it is more efficient to get a
        :class:`~whoosh.spelling.Corrector` object and use it directly::

            corrector = searcher.corrector("fieldname")
            for word in words:
                print(corrector.suggest(word))

        :param limit: only return up to this many suggestions. If there are not
            enough terms in the field within ``maxdist`` of the given word, the
            returned list will be shorter than this number.
        :param maxdist: the largest edit distance from the given word to look
            at. Numbers higher than 2 are not very effective or efficient.
        :param prefix: require suggestions to share a prefix of this length
            with the given word. This is often justifiable since most
            misspellings do not involve the first letter of the word. Using a
            prefix dramatically decreases the time it takes to generate the
            list of words.
        """

        c = self.reader().corrector(fieldname)
        return c.suggest(text, limit=limit, maxdist=maxdist, prefix=prefix)

    def key_terms(self, docnums, fieldname, numterms=5,
                  model=classify.Bo1Model, normalize=True):
        """Returns the 'numterms' most important terms from the documents
        listed (by number) in 'docnums'. You can get document numbers for the
        documents your interested in with the document_number() and
        document_numbers() methods.

        "Most important" is generally defined as terms that occur frequently in
        the top hits but relatively infrequently in the collection as a whole.

        >>> docnum = searcher.document_number(path=u"/a/b")
        >>> keywords_and_scores = searcher.key_terms([docnum], "content")

        This method returns a list of ("term", score) tuples. The score may be
        useful if you want to know the "strength" of the key terms, however to
        just get the terms themselves you can just do this:

        >>> kws = [kw for kw, score in searcher.key_terms([docnum], "content")]

        :param fieldname: Look at the terms in this field. This field must
            store vectors.
        :param docnums: A sequence of document numbers specifying which
            documents to extract key terms from.
        :param numterms: Return this number of important terms.
        :param model: The classify.ExpansionModel to use. See the classify
            module.
        :param normalize: normalize the scores.
        :returns: a list of ("term", score) tuples.
        """

        expander = classify.Expander(self.ixreader, fieldname, model=model)
        for docnum in docnums:
            expander.add_document(docnum)
        return expander.expanded_terms(numterms, normalize=normalize)

    def key_terms_from_text(self, fieldname, text, numterms=5,
                            model=classify.Bo1Model, normalize=True):
        """Return the 'numterms' most important terms from the given text.

        :param numterms: Return this number of important terms.
        :param model: The classify.ExpansionModel to use. See the classify
            module.
        """

        expander = classify.Expander(self.ixreader, fieldname, model=model)
        expander.add_text(text)
        return expander.expanded_terms(numterms, normalize=normalize)

    def more_like(self, docnum, fieldname, text=None, top=10, numterms=5,
                  model=classify.Bo1Model, normalize=False, filter=None):
        """Returns a :class:`Results` object containing documents similar to
        the given document, based on "key terms" in the given field::

            # Get the ID for the document you're interested in
            docnum = search.document_number(path=u"/a/b/c")

            r = searcher.more_like(docnum)

            print("Documents like", searcher.stored_fields(docnum)["title"])
            for hit in r:
                print(hit["title"])

        :param fieldname: the name of the field to use to test similarity.
        :param text: by default, the method will attempt to load the contents
            of the field from the stored fields for the document, or from a
            term vector. If the field isn't stored or vectored in the index,
            but you have access to the text another way (for example, loading
            from a file or a database), you can supply it using the ``text``
            parameter.
        :param top: the number of results to return.
        :param numterms: the number of "key terms" to extract from the hit and
            search for. Using more terms is slower but gives potentially more
            and more accurate results.
        :param model: (expert) a :class:`whoosh.classify.ExpansionModel` to use
            to compute "key terms".
        :param normalize: whether to normalize term weights.
        :param filter: a query, Results object, or set of docnums. The results
            will only contain documents that are also in the filter object.
        """

        if text:
            kts = self.key_terms_from_text(fieldname, text, numterms=numterms,
                                           model=model, normalize=normalize)
        else:
            kts = self.key_terms([docnum], fieldname, numterms=numterms,
                                 model=model, normalize=normalize)
        # Create an Or query from the key terms
        q = query.Or([query.Term(fieldname, word, boost=weight)
                      for word, weight in kts])

        return self.search(q, limit=top, filter=filter, mask=set([docnum]))

    def search_page(self, query, pagenum, pagelen=10, **kwargs):
        """This method is Like the :meth:`Searcher.search` method, but returns
        a :class:`ResultsPage` object. This is a convenience function for
        getting a certain "page" of the results for the given query, which is
        often useful in web search interfaces.

        For example::

            querystring = request.get("q")
            query = queryparser.parse("content", querystring)

            pagenum = int(request.get("page", 1))
            pagelen = int(request.get("perpage", 10))

            results = searcher.search_page(query, pagenum, pagelen=pagelen)
            print("Page %d of %d" % (results.pagenum, results.pagecount))
            print("Showing results %d-%d of %d"
                  % (results.offset + 1, results.offset + results.pagelen + 1,
                     len(results)))
            for hit in results:
                print("%d: %s" % (hit.rank + 1, hit["title"]))

        (Note that results.pagelen might be less than the pagelen argument if
        there aren't enough results to fill a page.)

        Any additional keyword arguments you supply are passed through to
        :meth:`Searcher.search`. For example, you can get paged results of a
        sorted search::

            results = searcher.search_page(q, 2, sortedby="date", reverse=True)

        Currently, searching for page 100 with pagelen of 10 takes the same
        amount of time as using :meth:`Searcher.search` to find the first 1000
        results. That is, this method does not have any special optimizations
        or efficiencies for getting a page from the middle of the full results
        list. (A future enhancement may allow using previous page results to
        improve the efficiency of finding the next page.)

        This method will raise a ``ValueError`` if you ask for a page number
        higher than the number of pages in the resulting query.

        :param query: the :class:`whoosh.query.Query` object to match.
        :param pagenum: the page number to retrieve, starting at ``1`` for the
            first page.
        :param pagelen: the number of results per page.
        :returns: :class:`ResultsPage`
        """

        if pagenum < 1:
            raise ValueError("pagenum must be >= 1")

        results = self.search(query, limit=pagenum * pagelen, **kwargs)
        return ResultsPage(results, pagenum, pagelen)

    def find(self, defaultfield, querystring, **kwargs):
        from whoosh.qparser import QueryParser
        qp = QueryParser(defaultfield, schema=self.ixreader.schema)
        q = qp.parse(querystring)
        return self.search(q, **kwargs)

    def docs_for_query(self, q, for_deletion=False):
        """Returns an iterator of document numbers for documents matching the
        given :class:`whoosh.query.Query` object.
        """

        # If we're getting the document numbers so we can delete them, use the
        # deletion_docs method instead of docs; this lets special queries
        # (e.g. nested queries) override what gets deleted
        if for_deletion:
            method = q.deletion_docs
        else:
            method = q.docs

        if self.subsearchers:
            for s, offset in self.subsearchers:
                for docnum in method(s):
                    yield docnum + offset
        else:
            for docnum in method(self):
                yield docnum

    def collector(self, limit=10, sortedby=None, reverse=False, groupedby=None,
                  collapse=None, collapse_limit=1, collapse_order=None,
                  optimize=True, filter=None, mask=None, terms=False,
                  maptype=None, scored=True):
        """Low-level method: returns a configured
        :class:`whoosh.collectors.Collector` object based on the given
        arguments. You can use this object with
        :meth:`Searcher.search_with_collector` to search.

        See the documentation for the :meth:`Searcher.search` method for a
        description of the parameters.

        This method may be useful to get a basic collector object and then wrap
        it with another collector from ``whoosh.collectors`` or with a custom
        collector of your own::

            # Equivalent of
            # results = mysearcher.search(myquery, limit=10)
            # but with a time limt...

            # Create a TopCollector
            c = mysearcher.collector(limit=10)

            # Wrap it with a TimeLimitedCollector with a time limit of
            # 10.5 seconds
            from whoosh.collectors import TimeLimitedCollector
            c = TimeLimitCollector(c, 10.5)

            # Search using the custom collector
            results = mysearcher.search_with_collector(myquery, c)
        """

        from whoosh import collectors

        if limit is not None and limit < 1:
            raise ValueError("limit must be >= 1")

        if not scored and not sortedby:
            c = collectors.UnsortedCollector()
        elif sortedby:
            c = collectors.SortingCollector(sortedby, limit=limit,
                                            reverse=reverse)
        elif groupedby or reverse or not limit or limit >= self.doc_count():
            # A collector that gathers every matching document
            c = collectors.UnlimitedCollector(reverse=reverse)
        else:
            # A collector that uses block quality optimizations and a heap
            # queue to only collect the top N documents
            c = collectors.TopCollector(limit, usequality=optimize)

        if groupedby:
            c = collectors.FacetCollector(c, groupedby, maptype=maptype)
        if terms:
            c = collectors.TermsCollector(c)
        if collapse:
            c = collectors.CollapseCollector(c, collapse, limit=collapse_limit,
                                             order=collapse_order)

        # Filtering wraps last so it sees the docs first
        if filter or mask:
            c = collectors.FilterCollector(c, filter, mask)
        return c

    def search(self, q, **kwargs):
        """Runs a :class:`whoosh.query.Query` object on this searcher and
        returns a :class:`Results` object. See :doc:`/searching` for more
        information.

        This method takes many keyword arguments (documented below).

        See :doc:`/facets` for information on using ``sortedby`` and/or
        ``groupedby``. See :ref:`collapsing` for more information on using
        ``collapse``, ``collapse_limit``, and ``collapse_order``.

        :param query: a :class:`whoosh.query.Query` object to use to match
            documents.
        :param limit: the maximum number of documents to score. If you're only
            interested in the top N documents, you can set limit=N to limit the
            scoring for a faster search. Default is 10.
        :param scored: whether to score the results. Overriden by ``sortedby``.
            If both ``scored=False`` and ``sortedby=None``, the results will be
            in arbitrary order, but will usually be computed faster than
            scored or sorted results.
        :param sortedby: see :doc:`/facets`.
        :param reverse: Reverses the direction of the sort. Default is False.
        :param groupedby: see :doc:`/facets`.
        :param optimize: use optimizations to get faster results when possible.
            Default is True.
        :param filter: a query, Results object, or set of docnums. The results
            will only contain documents that are also in the filter object.
        :param mask: a query, Results object, or set of docnums. The results
            will not contain any documents that are in the mask object.
        :param terms: if True, record which terms were found in each matching
            document. See :doc:`/searching` for more information. Default is
            False.
        :param maptype: by default, the results of faceting with ``groupedby``
            is a dictionary mapping group names to ordered lists of document
            numbers in the group. You can pass a
            :class:`whoosh.sorting.FacetMap` subclass to this keyword argument
            to specify a different (usually faster) method for grouping. For
            example, ``maptype=sorting.Count`` would store only the count of
            documents in each group, instead of the full list of document IDs.
        :param collapse: a :doc:`facet </facets>` to use to collapse the
            results. See :ref:`collapsing` for more information.
        :param collapse_limit: the maximum number of documents to allow with
            the same collapse key. See :ref:`collapsing` for more information.
        :param collapse_order: an optional ordering :doc:`facet </facets>`
            to control which documents are kept when collapsing. The default
            (``collapse_order=None``) uses the results order (e.g. the highest
            scoring documents in a scored search).
        :rtype: :class:`Results`
        """

        # Call the collector() method to build a collector based on the
        # parameters passed to this method
        c = self.collector(**kwargs)
        # Call the lower-level method to run the collector
        self.search_with_collector(q, c)
        # Return the results object from the collector
        return c.results()

    def search_with_collector(self, q, collector, context=None):
        """Low-level method: runs a :class:`whoosh.query.Query` object on this
        searcher using the given :class:`whoosh.collectors.Collector` object
        to collect the results::

            myquery = query.Term("content", "cabbage")

            uc = collectors.UnlimitedCollector()
            tc = TermsCollector(uc)

            mysearcher.search_with_collector(myquery, tc)
            print(tc.docterms)
            print(tc.results())

        Note that this method does not return a :class:`Results` object. You
        need to access the collector to get a results object or other
        information the collector might hold after the search.

        :param q: a :class:`whoosh.query.Query` object to use to match
            documents.
        :param collector: a :class:`whoosh.collectors.Collector` object to feed
            the results into.
        """

        # Get the search context object from the searcher
        context = context or self.context()
        # Allow collector to set up based on the top-level information
        collector.prepare(self, q, context)

        collector.run()

    def correct_query(self, q, qstring, correctors=None, terms=None, maxdist=2,
                      prefix=0, aliases=None):
        """
        Returns a corrected version of the given user query using a default
        :class:`whoosh.spelling.ReaderCorrector`.

        The default:

        * Corrects any words that don't appear in the index.

        * Takes suggestions from the words in the index. To make certain fields
          use custom correctors, use the ``correctors`` argument to pass a
          dictionary mapping field names to :class:`whoosh.spelling.Corrector`
          objects.

        Expert users who want more sophisticated correction behavior can create
        a custom :class:`whoosh.spelling.QueryCorrector` and use that instead
        of this method.

        Returns a :class:`whoosh.spelling.Correction` object with a ``query``
        attribute containing the corrected :class:`whoosh.query.Query` object
        and a ``string`` attributes containing the corrected query string.

        >>> from whoosh import qparser, highlight
        >>> qtext = 'mary "litle lamb"'
        >>> q = qparser.QueryParser("text", myindex.schema)
        >>> mysearcher = myindex.searcher()
        >>> correction = mysearcher().correct_query(q, qtext)
        >>> correction.query
        <query.And ...>
        >>> correction.string
        'mary "little lamb"'
        >>> mysearcher.close()

        You can use the ``Correction`` object's ``format_string`` method to
        format the corrected query string using a
        :class:`whoosh.highlight.Formatter` object. For example, you can format
        the corrected string as HTML, emphasizing the changed words.

        >>> hf = highlight.HtmlFormatter(classname="change")
        >>> correction.format_string(hf)
        'mary "<strong class="change term0">little</strong> lamb"'

        :param q: the :class:`whoosh.query.Query` object to correct.
        :param qstring: the original user query from which the query object was
            created. You can pass None instead of a string, in which the
            second item in the returned tuple will also be None.
        :param correctors: an optional dictionary mapping fieldnames to
            :class:`whoosh.spelling.Corrector` objects. By default, this method
            uses the contents of the index to spell check the terms in the
            query. You can use this argument to "override" some fields with a
            different correct, for example a
            :class:`whoosh.spelling.GraphCorrector`.
        :param terms: a sequence of ``("fieldname", "text")`` tuples to correct
            in the query. By default, this method corrects terms that don't
            appear in the index. You can use this argument to override that
            behavior and explicitly specify the terms that should be corrected.
        :param maxdist: the maximum number of "edits" (insertions, deletions,
            subsitutions, or transpositions of letters) allowed between the
            original word and any suggestion. Values higher than ``2`` may be
            slow.
        :param prefix: suggested replacement words must share this number of
            initial characters with the original word. Increasing this even to
            just ``1`` can dramatically speed up suggestions, and may be
            justifiable since spellling mistakes rarely involve the first
            letter of a word.
        :param aliases: an optional dictionary mapping field names in the query
            to different field names to use as the source of spelling
            suggestions. The mappings in ``correctors`` are applied after this.
        :rtype: :class:`whoosh.spelling.Correction`
        """

        reader = self.reader()

        # Dictionary of field name alias mappings
        if aliases is None:
            aliases = {}
        # Dictionary of custom per-field correctors
        if correctors is None:
            correctors = {}

        # Remap correctors dict according to aliases
        d = {}
        for fieldname, corr in iteritems(correctors):
            fieldname = aliases.get(fieldname, fieldname)
            d[fieldname] = corr
        correctors = d

        # Fill in default corrector objects for fields that don't have a custom
        # one in the "correctors" dictionary
        fieldnames = self.schema.names()
        for fieldname in fieldnames:
            fieldname = aliases.get(fieldname, fieldname)
            if fieldname not in correctors:
                correctors[fieldname] = self.reader().corrector(fieldname)

        # Get any missing terms in the query in the fields we're correcting
        if terms is None:
            terms = []
            for token in q.all_tokens():
                aname = aliases.get(token.fieldname, token.fieldname)
                text = token.text
                if aname in correctors and (aname, text) not in reader:
                    # Note that we use the original, not aliases fieldname here
                    # so if we correct the query we know what it was
                    terms.append((token.fieldname, token.text))

        # Make q query corrector
        from whoosh import spelling
        sqc = spelling.SimpleQueryCorrector(correctors, terms, aliases)
        return sqc.correct_query(q, qstring)


class Results(object):
    """This object is returned by a Searcher. This object represents the
    results of a search query. You can mostly use it as if it was a list of
    dictionaries, where each dictionary is the stored fields of the document at
    that position in the results.

    Note that a Results object keeps a reference to the Searcher that created
    it, so keeping a reference to a Results object keeps the Searcher alive and
    so keeps all files used by it open.
    """

    def __init__(self, searcher, q, top_n, docset=None, facetmaps=None,
                 runtime=0, highlighter=None):
        """
        :param searcher: the :class:`Searcher` object that produced these
            results.
        :param query: the original query that created these results.
        :param top_n: a list of (score, docnum) tuples representing the top
            N search results.
        """

        self.searcher = searcher
        self.q = q
        self.top_n = top_n
        self.docset = docset
        self._facetmaps = facetmaps or {}
        self.runtime = runtime
        self.highlighter = highlighter or highlight.Highlighter()
        self.collector = None
        self._total = None
        self._char_cache = {}

    def __repr__(self):
        return "<Top %s Results for %r runtime=%s>" % (len(self.top_n),
                                                       self.q,
                                                       self.runtime)

    def __len__(self):
        """Returns the total number of documents that matched the query. Note
        this may be more than the number of scored documents, given the value
        of the ``limit`` keyword argument to :meth:`Searcher.search`.

        If this Results object was created by searching with a ``limit``
        keyword, then computing the exact length of the result set may be
        expensive for large indexes or large result sets. You may consider
        using :meth:`Results.has_exact_length`,
        :meth:`Results.estimated_length`, and
        :meth:`Results.estimated_min_length` to display an estimated size of
        the result set instead of an exact number.
        """

        if self._total is None:
            self._total = self.collector.count()
        return self._total

    def __getitem__(self, n):
        if isinstance(n, slice):
            start, stop, step = n.indices(len(self.top_n))
            return [Hit(self, self.top_n[i][1], i, self.top_n[i][0])
                    for i in xrange(start, stop, step)]
        else:
            if n >= len(self.top_n):
                raise IndexError("results[%r]: Results only has %s hits"
                                 % (n, len(self.top_n)))
            return Hit(self, self.top_n[n][1], n, self.top_n[n][0])

    def __iter__(self):
        """Yields a :class:`Hit` object for each result in ranked order.
        """

        for i in xrange(len(self.top_n)):
            yield Hit(self, self.top_n[i][1], i, self.top_n[i][0])

    def __contains__(self, docnum):
        """Returns True if the given document number matched the query.
        """

        return docnum in self.docs()

    def __nonzero__(self):
        return not self.is_empty()

    __bool__ = __nonzero__

    def is_empty(self):
        """Returns True if not documents matched the query.
        """

        return self.scored_length() == 0

    def items(self):
        """Returns an iterator of (docnum, score) pairs for the scored
        documents in the results.
        """

        return ((docnum, score) for score, docnum in self.top_n)

    def fields(self, n):
        """Returns the stored fields for the document at the ``n`` th position
        in the results. Use :meth:`Results.docnum` if you want the raw
        document number instead of the stored fields.
        """

        return self.searcher.stored_fields(self.top_n[n][1])

    def facet_names(self):
        """Returns the available facet names, for use with the ``groups()``
        method.
        """

        return self._facetmaps.keys()

    def groups(self, name=None):
        """If you generated facet groupings for the results using the
        `groupedby` keyword argument to the ``search()`` method, you can use
        this method to retrieve the groups. You can use the ``facet_names()``
        method to get the list of available facet names.

        >>> results = searcher.search(my_query, groupedby=["tag", "price"])
        >>> results.facet_names()
        ["tag", "price"]
        >>> results.groups("tag")
        {"new": [12, 1, 4], "apple": [3, 10, 5], "search": [11]}

        If you only used one facet, you can call the method without a facet
        name to get the groups for the facet.

        >>> results = searcher.search(my_query, groupedby="tag")
        >>> results.groups()
        {"new": [12, 1, 4], "apple": [3, 10, 5, 0], "search": [11]}

        By default, this returns a dictionary mapping category names to a list
        of document numbers, in the same relative order as they appear in the
        results.

        >>> results = mysearcher.search(myquery, groupedby="tag")
        >>> docnums = results.groups()
        >>> docnums['new']
        [12, 1, 4]

        You can then use :meth:`Searcher.stored_fields` to get the stored
        fields associated with a document ID.

        If you specified a different ``maptype`` for the facet when you
        searched, the values in the dictionary depend on the
        :class:`whoosh.sorting.FacetMap`.

        >>> myfacet = sorting.FieldFacet("tag", maptype=sorting.Count)
        >>> results = mysearcher.search(myquery, groupedby=myfacet)
        >>> counts = results.groups()
        {"new": 3, "apple": 4, "search": 1}
        """

        if (name is None or name == "facet") and len(self._facetmaps) == 1:
            # If there's only one facet, just use it; convert keys() to list
            # for Python 3
            name = list(self._facetmaps.keys())[0]
        elif name not in self._facetmaps:
            raise KeyError("%r not in facet names %r"
                           % (name, self.facet_names()))
        return self._facetmaps[name].as_dict()

    def has_exact_length(self):
        """Returns True if this results object already knows the exact number
        of matching documents.
        """

        if self.collector:
            return self.collector.computes_count()
        else:
            return self._total is not None

    def estimated_length(self):
        """The estimated maximum number of matching documents, or the
        exact number of matching documents if it's known.
        """

        if self.has_exact_length():
            return len(self)
        else:
            return self.q.estimate_size(self.searcher.reader())

    def estimated_min_length(self):
        """The estimated minimum number of matching documents, or the
        exact number of matching documents if it's known.
        """

        if self.has_exact_length():
            return len(self)
        else:
            return self.q.estimate_min_size(self.searcher.reader())

    def scored_length(self):
        """Returns the number of scored documents in the results, equal to or
        less than the ``limit`` keyword argument to the search.

        >>> r = mysearcher.search(myquery, limit=20)
        >>> len(r)
        1246
        >>> r.scored_length()
        20

        This may be fewer than the total number of documents that match the
        query, which is what ``len(Results)`` returns.
        """

        return len(self.top_n)

    def docs(self):
        """Returns a set-like object containing the document numbers that
        matched the query.
        """

        if self.docset is None:
            self.docset = set(self.collector.all_ids())
        return self.docset

    def copy(self):
        """Returns a deep copy of this results object.
        """

        # Shallow copy self to get attributes
        r = copy.copy(self)
        # Deep copies of docset and top_n in case they're modified
        r.docset = copy.deepcopy(self.docset)
        r.top_n = copy.deepcopy(self.top_n)
        return r

    def score(self, n):
        """Returns the score for the document at the Nth position in the list
        of ranked documents. If the search was not scored, this may return
        None.
        """

        return self.top_n[n][0]

    def docnum(self, n):
        """Returns the document number of the result at position n in the list
        of ranked documents.
        """
        return self.top_n[n][1]

    def query_terms(self, expand=False, fieldname=None):
        return self.q.existing_terms(self.searcher.reader(),
                                     fieldname=fieldname, expand=expand)

    def has_matched_terms(self):
        """Returns True if the search recorded which terms matched in which
        documents.

        >>> r = searcher.search(myquery)
        >>> r.has_matched_terms()
        False
        >>>
        """

        return hasattr(self, "docterms") and hasattr(self, "termdocs")

    def matched_terms(self):
        """Returns the set of ``("fieldname", "text")`` tuples representing
        terms from the query that matched one or more of the TOP N documents
        (this does not report terms for documents that match the query but did
        not score high enough to make the top N results). You can compare this
        set to the terms from the original query to find terms which didn't
        occur in any matching documents.

        This is only valid if you used ``terms=True`` in the search call to
        record matching terms. Otherwise it will raise an exception.

        >>> q = myparser.parse("alfa OR bravo OR charlie")
        >>> results = searcher.search(q, terms=True)
        >>> results.terms()
        set([("content", "alfa"), ("content", "charlie")])
        >>> q.all_terms() - results.terms()
        set([("content", "bravo")])
        """

        if not self.has_matched_terms():
            raise NoTermsException
        return set(self.termdocs.keys())

    def _get_fragmenter(self):
        return self.highlighter.fragmenter

    def _set_fragmenter(self, f):
        self.highlighter.fragmenter = f

    fragmenter = property(_get_fragmenter, _set_fragmenter)

    def _get_formatter(self):
        return self.highlighter.formatter

    def _set_formatter(self, f):
        self.highlighter.formatter = f

    formatter = property(_get_formatter, _set_formatter)

    def _get_scorer(self):
        return self.highlighter.scorer

    def _set_scorer(self, s):
        self.highlighter.scorer = s

    scorer = property(_get_scorer, _set_scorer)

    def _get_order(self):
        return self.highlighter.order

    def _set_order(self, o):
        self.highlighter.order = o

    order = property(_get_order, _set_order)

    def key_terms(self, fieldname, docs=10, numterms=5,
                  model=classify.Bo1Model, normalize=True):
        """Returns the 'numterms' most important terms from the top 'docs'
        documents in these results. "Most important" is generally defined as
        terms that occur frequently in the top hits but relatively infrequently
        in the collection as a whole.

        :param fieldname: Look at the terms in this field. This field must
            store vectors.
        :param docs: Look at this many of the top documents of the results.
        :param numterms: Return this number of important terms.
        :param model: The classify.ExpansionModel to use. See the classify
            module.
        :returns: list of unicode strings.
        """

        if not len(self):
            return []
        docs = min(docs, len(self))

        reader = self.searcher.reader()

        expander = classify.Expander(reader, fieldname, model=model)
        for _, docnum in self.top_n[:docs]:
            expander.add_document(docnum)

        return expander.expanded_terms(numterms, normalize=normalize)

    def extend(self, results):
        """Appends hits from 'results' (that are not already in this
        results object) to the end of these results.

        :param results: another results object.
        """

        docs = self.docs()
        for item in results.top_n:
            if item[1] not in docs:
                self.top_n.append(item)
        self.docset = docs | results.docs()
        self._total = len(self.docset)

    def filter(self, results):
        """Removes any hits that are not also in the other results object.
        """

        if not len(results):
            return

        otherdocs = results.docs()
        items = [item for item in self.top_n if item[1] in otherdocs]
        self.docset = self.docs() & otherdocs
        self.top_n = items

    def upgrade(self, results, reverse=False):
        """Re-sorts the results so any hits that are also in 'results' appear
        before hits not in 'results', otherwise keeping their current relative
        positions. This does not add the documents in the other results object
        to this one.

        :param results: another results object.
        :param reverse: if True, lower the position of hits in the other
            results object instead of raising them.
        """

        if not len(results):
            return

        otherdocs = results.docs()
        arein = [item for item in self.top_n if item[1] in otherdocs]
        notin = [item for item in self.top_n if item[1] not in otherdocs]

        if reverse:
            items = notin + arein
        else:
            items = arein + notin

        self.top_n = items

    def upgrade_and_extend(self, results):
        """Combines the effects of extend() and upgrade(): hits that are also
        in 'results' are raised. Then any hits from the other results object
        that are not in this results object are appended to the end.

        :param results: another results object.
        """

        if not len(results):
            return

        docs = self.docs()
        otherdocs = results.docs()

        arein = [item for item in self.top_n if item[1] in otherdocs]
        notin = [item for item in self.top_n if item[1] not in otherdocs]
        other = [item for item in results.top_n if item[1] not in docs]

        self.docset = docs | otherdocs
        self.top_n = arein + notin + other


class Hit(object):
    """Represents a single search result ("hit") in a Results object.

    This object acts like a dictionary of the matching document's stored
    fields. If for some reason you need an actual ``dict`` object, use
    ``Hit.fields()`` to get one.

    >>> r = searcher.search(query.Term("content", "render"))
    >>> r[0]
    < Hit {title = u"Rendering the scene"} >
    >>> r[0].rank
    0
    >>> r[0].docnum == 4592
    True
    >>> r[0].score
    2.52045682
    >>> r[0]["title"]
    "Rendering the scene"
    >>> r[0].keys()
    ["title"]
    """

    def __init__(self, results, docnum, pos=None, score=None):
        """
        :param results: the Results object this hit belongs to.
        :param pos: the position in the results list of this hit, for example
            pos = 0 means this is the first (highest scoring) hit.
        :param docnum: the document number of this hit.
        :param score: the score of this hit.
        """

        self.results = results
        self.searcher = results.searcher
        self.reader = self.searcher.reader()
        self.pos = self.rank = pos
        self.docnum = docnum
        self.score = score
        self._fields = None

    def fields(self):
        """Returns a dictionary of the stored fields of the document this
        object represents.
        """

        if self._fields is None:
            self._fields = self.searcher.stored_fields(self.docnum)
        return self._fields

    def matched_terms(self):
        """Returns the set of ``("fieldname", "text")`` tuples representing
        terms from the query that matched in this document. You can
        compare this set to the terms from the original query to find terms
        which didn't occur in this document.

        This is only valid if you used ``terms=True`` in the search call to
        record matching terms. Otherwise it will raise an exception.

        >>> q = myparser.parse("alfa OR bravo OR charlie")
        >>> results = searcher.search(q, terms=True)
        >>> for hit in results:
        ...   print(hit["title"])
        ...   print("Contains:", hit.matched_terms())
        ...   print("Doesn't contain:", q.all_terms() - hit.matched_terms())
        """

        if not self.results.has_matched_terms():
            raise NoTermsException
        return self.results.docterms.get(self.docnum, [])

    def highlights(self, fieldname, text=None, top=3, minscore=1):
        """Returns highlighted snippets from the given field::

            r = searcher.search(myquery)
            for hit in r:
                print(hit["title"])
                print(hit.highlights("content"))

        See :doc:`/highlight`.

        To change the fragmeter, formatter, order, or scorer used in
        highlighting, you can set attributes on the results object::

            from whoosh import highlight

            results = searcher.search(myquery, terms=True)
            results.fragmenter = highlight.SentenceFragmenter()

        ...or use a custom :class:`whoosh.highlight.Highlighter` object::

            hl = highlight.Highlighter(fragmenter=sf)
            results.highlighter = hl

        :param fieldname: the name of the field you want to highlight.
        :param text: by default, the method will attempt to load the contents
            of the field from the stored fields for the document. If the field
            you want to highlight isn't stored in the index, but you have
            access to the text another way (for example, loading from a file or
            a database), you can supply it using the ``text`` parameter.
        :param top: the maximum number of fragments to return.
        :param minscore: the minimum score for fragments to appear in the
            highlights.
        """

        hliter = self.results.highlighter
        return hliter.highlight_hit(self, fieldname, text=text, top=top,
                                    minscore=minscore)

    def more_like_this(self, fieldname, text=None, top=10, numterms=5,
                       model=classify.Bo1Model, normalize=True, filter=None):
        """Returns a new Results object containing documents similar to this
        hit, based on "key terms" in the given field::

            r = searcher.search(myquery)
            for hit in r:
                print(hit["title"])
                print("Top 3 similar documents:")
                for subhit in hit.more_like_this("content", top=3):
                  print("  ", subhit["title"])

        :param fieldname: the name of the field to use to test similarity.
        :param text: by default, the method will attempt to load the contents
            of the field from the stored fields for the document, or from a
            term vector. If the field isn't stored or vectored in the index,
            but you have access to the text another way (for example, loading
            from a file or a database), you can supply it using the ``text``
            parameter.
        :param top: the number of results to return.
        :param numterms: the number of "key terms" to extract from the hit and
            search for. Using more terms is slower but gives potentially more
            and more accurate results.
        :param model: (expert) a :class:`whoosh.classify.ExpansionModel` to use
            to compute "key terms".
        :param normalize: whether to normalize term weights.
        """

        return self.searcher.more_like(self.docnum, fieldname, text=text,
                                       top=top, numterms=numterms, model=model,
                                       normalize=normalize, filter=filter)

    def __repr__(self):
        return "<%s %r>" % (self.__class__.__name__, self.fields())

    def __eq__(self, other):
        if isinstance(other, Hit):
            return self.fields() == other.fields()
        elif isinstance(other, dict):
            return self.fields() == other
        else:
            return False

    def __len__(self):
        return len(self.fields())

    def __iter__(self):
        return iterkeys(self.fields())

    def __getitem__(self, fieldname):
        if fieldname in self.fields():
            return self._fields[fieldname]

        reader = self.reader
        if reader.has_column(fieldname):
            cr = reader.column_reader(fieldname)
            return cr[self.docnum]

        raise KeyError(fieldname)

    def __contains__(self, key):
        return (key in self.fields()
                or self.reader.has_column(key))

    def items(self):
        return list(self.fields().items())

    def keys(self):
        return list(self.fields().keys())

    def values(self):
        return list(self.fields().values())

    def iteritems(self):
        return iteritems(self.fields())

    def iterkeys(self):
        return iterkeys(self.fields())

    def itervalues(self):
        return itervalues(self.fields())

    def get(self, key, default=None):
        return self.fields().get(key, default)

    def __setitem__(self, key, value):
        raise NotImplementedError("You cannot modify a search result")

    def __delitem__(self, key, value):
        raise NotImplementedError("You cannot modify a search result")

    def clear(self):
        raise NotImplementedError("You cannot modify a search result")

    def update(self, dict=None, **kwargs):
        raise NotImplementedError("You cannot modify a search result")


class ResultsPage(object):
    """Represents a single page out of a longer list of results, as returned
    by :func:`whoosh.searching.Searcher.search_page`. Supports a subset of the
    interface of the :class:`~whoosh.searching.Results` object, namely getting
    stored fields with __getitem__ (square brackets), iterating, and the
    ``score()`` and ``docnum()`` methods.

    The ``offset`` attribute contains the results number this page starts at
    (numbered from 0). For example, if the page length is 10, the ``offset``
    attribute on the second page will be ``10``.

    The ``pagecount`` attribute contains the number of pages available.

    The ``pagenum`` attribute contains the page number. This may be less than
    the page you requested if the results had too few pages. For example, if
    you do::

        ResultsPage(results, 5)

    but the results object only contains 3 pages worth of hits, ``pagenum``
    will be 3.

    The ``pagelen`` attribute contains the number of results on this page
    (which may be less than the page length you requested if this is the last
    page of the results).

    The ``total`` attribute contains the total number of hits in the results.

    >>> mysearcher = myindex.searcher()
    >>> pagenum = 2
    >>> page = mysearcher.find_page(pagenum, myquery)
    >>> print("Page %s of %s, results %s to %s of %s" %
    ...       (pagenum, page.pagecount, page.offset+1,
    ...        page.offset+page.pagelen, page.total))
    >>> for i, fields in enumerate(page):
    ...   print("%s. %r" % (page.offset + i + 1, fields))
    >>> mysearcher.close()

    To set highlighter attributes (for example ``formatter``), access the
    underlying :class:`Results` object::

        page.results.formatter = highlight.UppercaseFormatter()

    """

    def __init__(self, results, pagenum, pagelen=10):
        """
        :param results: a :class:`~whoosh.searching.Results` object.
        :param pagenum: which page of the results to use, numbered from ``1``.
        :param pagelen: the number of hits per page.
        """

        self.results = results
        self.total = len(results)

        if pagenum < 1:
            raise ValueError("pagenum must be >= 1")

        self.pagecount = int(ceil(self.total / pagelen))
        self.pagenum = min(self.pagecount, pagenum)

        offset = (self.pagenum - 1) * pagelen
        if (offset + pagelen) > self.total:
            pagelen = self.total - offset
        self.offset = offset
        self.pagelen = pagelen

    def __getitem__(self, n):
        offset = self.offset
        if isinstance(n, slice):
            start, stop, step = n.indices(self.pagelen)
            return self.results.__getitem__(slice(start + offset,
                                                  stop + offset, step))
        else:
            return self.results.__getitem__(n + offset)

    def __iter__(self):
        return iter(self.results[self.offset:self.offset + self.pagelen])

    def __len__(self):
        return self.total

    def scored_length(self):
        return self.results.scored_length()

    def score(self, n):
        """Returns the score of the hit at the nth position on this page.
        """
        return self.results.score(n + self.offset)

    def docnum(self, n):
        """Returns the document number of the hit at the nth position on this
        page.
        """
        return self.results.docnum(n + self.offset)

    def is_last_page(self):
        """Returns True if this object represents the last page of results.
        """

        return self.pagecount == 0 or self.pagenum == self.pagecount
