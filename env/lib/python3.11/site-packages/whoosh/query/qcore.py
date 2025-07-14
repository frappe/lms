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

from __future__ import division
import copy
from array import array

from whoosh import matching
from whoosh.compat import u
from whoosh.reading import TermNotFound
from whoosh.compat import methodcaller


# Exceptions

class QueryError(Exception):
    """Error encountered while running a query.
    """
    pass


# Functions

def error_query(msg, q=None):
    """Returns the query in the second argument (or a :class:`NullQuery` if the
    second argument is not given) with its ``error`` attribute set to
    ``msg``.
    """

    if q is None:
        q = _NullQuery()
    q.error = msg
    return q


def token_lists(q, phrases=True):
    """Returns the terms in the query tree, with the query hierarchy
    represented as nested lists.
    """

    if q.is_leaf():
        from whoosh.query import Phrase
        if phrases or not isinstance(q, Phrase):
            return list(q.tokens())
    else:
        ls = []
        for qq in q.children():
            t = token_lists(qq, phrases=phrases)
            if len(t) == 1:
                t = t[0]
            if t:
                ls.append(t)
        return ls


# Utility classes

class Lowest(object):
    """A value that is always compares lower than any other object except
    itself.
    """

    def __cmp__(self, other):
        if other.__class__ is Lowest:
            return 0
        return -1

    def __eq__(self, other):
        return self.__class__ is type(other)

    def __lt__(self, other):
        return type(other) is not self.__class__

    def __ne__(self, other):
        return not self.__eq__(other)

    def __gt__(self, other):
        return not (self.__lt__(other) or self.__eq__(other))

    def __le__(self, other):
        return self.__eq__(other) or self.__lt__(other)

    def __ge__(self, other):
        return self.__eq__(other) or self.__gt__(other)


class Highest(object):
    """A value that is always compares higher than any other object except
    itself.
    """

    def __cmp__(self, other):
        if other.__class__ is Highest:
            return 0
        return 1

    def __eq__(self, other):
        return self.__class__ is type(other)

    def __lt__(self, other):
        return type(other) is self.__class__

    def __ne__(self, other):
        return not self.__eq__(other)

    def __gt__(self, other):
        return not (self.__lt__(other) or self.__eq__(other))

    def __le__(self, other):
        return self.__eq__(other) or self.__lt__(other)

    def __ge__(self, other):
        return self.__eq__(other) or self.__gt__(other)


Lowest = Lowest()
Highest = Highest()


# Base classes

class Query(object):
    """Abstract base class for all queries.

    Note that this base class implements __or__, __and__, and __sub__ to allow
    slightly more convenient composition of query objects::

        >>> Term("content", u"a") | Term("content", u"b")
        Or([Term("content", u"a"), Term("content", u"b")])

        >>> Term("content", u"a") & Term("content", u"b")
        And([Term("content", u"a"), Term("content", u"b")])

        >>> Term("content", u"a") - Term("content", u"b")
        And([Term("content", u"a"), Not(Term("content", u"b"))])
    """

    # For queries produced by the query parser, record where in the user
    # query this object originated
    startchar = endchar = None
    # For queries produced by the query parser, records an error that resulted
    # in this query
    error = None

    def __unicode__(self):
        raise NotImplementedError(self.__class__.__name__)

    def __getitem__(self, item):
        raise NotImplementedError

    def __or__(self, query):
        """Allows you to use | between query objects to wrap them in an Or
        query.
        """

        from whoosh.query import Or
        return Or([self, query]).normalize()

    def __and__(self, query):
        """Allows you to use & between query objects to wrap them in an And
        query.
        """

        from whoosh.query import And
        return And([self, query]).normalize()

    def __sub__(self, query):
        """Allows you to use - between query objects to add the right-hand
        query as a "NOT" query.
        """

        from whoosh.query import And, Not
        return And([self, Not(query)]).normalize()

    def __hash__(self):
        raise NotImplementedError

    def __ne__(self, other):
        return not self.__eq__(other)

    def is_leaf(self):
        """Returns True if this is a leaf node in the query tree, or False if
        this query has sub-queries.
        """

        return True

    def children(self):
        """Returns an iterator of the subqueries of this object.
        """

        return iter([])

    def is_range(self):
        """Returns True if this object searches for values within a range.
        """

        return False

    def has_terms(self):
        """Returns True if this specific object represents a search for a
        specific term (as opposed to a pattern, as in Wildcard and Prefix) or
        terms (i.e., whether the ``replace()`` method does something
        meaningful on this instance).
        """

        return False

    def needs_spans(self):
        for child in self.children():
            if child.needs_spans():
                return True
        return False

    def apply(self, fn):
        """If this query has children, calls the given function on each child
        and returns a new copy of this node with the new children returned by
        the function. If this is a leaf node, simply returns this object.

        This is useful for writing functions that transform a query tree. For
        example, this function changes all Term objects in a query tree into
        Variations objects::

            def term2var(q):
                if isinstance(q, Term):
                    return Variations(q.fieldname, q.text)
                else:
                    return q.apply(term2var)

            q = And([Term("f", "alfa"),
                     Or([Term("f", "bravo"),
                         Not(Term("f", "charlie"))])])
            q = term2var(q)

        Note that this method does not automatically create copies of nodes.
        To avoid modifying the original tree, your function should call the
        :meth:`Query.copy` method on nodes before changing their attributes.
        """

        return self

    def accept(self, fn):
        """Applies the given function to this query's subqueries (if any) and
        then to this query itself::

            def boost_phrases(q):
                if isintance(q, Phrase):
                    q.boost *= 2.0
                return q

            myquery = myquery.accept(boost_phrases)

        This method automatically creates copies of the nodes in the original
        tree before passing them to your function, so your function can change
        attributes on nodes without altering the original tree.

        This method is less flexible than using :meth:`Query.apply` (in fact
        it's implemented using that method) but is often more straightforward.
        """

        def fn_wrapper(q):
            q = q.apply(fn_wrapper)
            return fn(q)

        return fn_wrapper(self)

    def replace(self, fieldname, oldtext, newtext):
        """Returns a copy of this query with oldtext replaced by newtext (if
        oldtext was anywhere in this query).

        Note that this returns a *new* query with the given text replaced. It
        *does not* modify the original query "in place".
        """

        # The default implementation uses the apply method to "pass down" the
        # replace() method call
        if self.is_leaf():
            return copy.copy(self)
        else:
            return self.apply(methodcaller("replace", fieldname, oldtext,
                                           newtext))

    def copy(self):
        """Deprecated, just use ``copy.deepcopy``.
        """

        return copy.deepcopy(self)

    def all_terms(self, phrases=True):
        """Returns a set of all terms in this query tree.

        This method exists for backwards-compatibility. Use iter_all_terms()
        instead.

        :param phrases: Whether to add words found in Phrase queries.
        :rtype: set
        """

        return set(self.iter_all_terms(phrases=phrases))

    def terms(self, phrases=False):
        """Yields zero or more (fieldname, text) pairs queried by this object.
        You can check whether a query object targets specific terms before you
        call this method using :meth:`Query.has_terms`.

        To get all terms in a query tree, use :meth:`Query.iter_all_terms`.
        """

        return iter(())

    def expanded_terms(self, ixreader, phrases=True):
        return self.terms(phrases=phrases)

    def existing_terms(self, ixreader, phrases=True, expand=False, fieldname=None):
        """Returns a set of all byteterms in this query tree that exist in
        the given ixreader.

        :param ixreader: A :class:`whoosh.reading.IndexReader` object.
        :param phrases: Whether to add words found in Phrase queries.
        :param expand: If True, queries that match multiple terms
            will return all matching expansions.
        :rtype: set
        """

        schema = ixreader.schema
        termset = set()

        for q in self.leaves():
            if fieldname and fieldname != q.field():
                continue

            if expand:
                terms = q.expanded_terms(ixreader, phrases=phrases)
            else:
                terms = q.terms(phrases=phrases)

            for fieldname, text in terms:
                if (fieldname, text) in termset:
                    continue

                if fieldname in schema:
                    field = schema[fieldname]

                    try:
                        btext = field.to_bytes(text)
                    except ValueError:
                        continue

                    if (fieldname, btext) in ixreader:
                        termset.add((fieldname, btext))
        return termset

    def leaves(self):
        """Returns an iterator of all the leaf queries in this query tree as a
        flat series.
        """

        if self.is_leaf():
            yield self
        else:
            for q in self.children():
                for qq in q.leaves():
                    yield qq

    def iter_all_terms(self, phrases=True):
        """Returns an iterator of (fieldname, text) pairs for all terms in
        this query tree.

        >>> qp = qparser.QueryParser("text", myindex.schema)
        >>> q = myparser.parse("alfa bravo title:charlie")
        >>> # List the terms in a query
        >>> list(q.iter_all_terms())
        [("text", "alfa"), ("text", "bravo"), ("title", "charlie")]
        >>> # Get a set of all terms in the query that don't exist in the index
        >>> r = myindex.reader()
        >>> missing = set(t for t in q.iter_all_terms() if t not in r)
        set([("text", "alfa"), ("title", "charlie")])
        >>> # All terms in the query that occur in fewer than 5 documents in
        >>> # the index
        >>> [t for t in q.iter_all_terms() if r.doc_frequency(t[0], t[1]) < 5]
        [("title", "charlie")]

        :param phrases: Whether to add words found in Phrase queries.
        """

        for q in self.leaves():
            if q.has_terms():
                for t in q.terms(phrases=phrases):
                    yield t

    def all_tokens(self, boost=1.0):
        """Returns an iterator of :class:`analysis.Token` objects corresponding
        to all terms in this query tree. The Token objects will have the
        ``fieldname``, ``text``, and ``boost`` attributes set. If the query
        was built by the query parser, they Token objects will also have
        ``startchar`` and ``endchar`` attributes indexing into the original
        user query.
        """

        if self.is_leaf():
            for token in self.tokens(boost):
                yield token
        else:
            boost *= self.boost if hasattr(self, "boost") else 1.0
            for child in self.children():
                for token in child.all_tokens(boost):
                    yield token

    def tokens(self, boost=1.0, exreader=None):
        """Yields zero or more :class:`analysis.Token` objects corresponding to
        the terms searched for by this query object. You can check whether a
        query object targets specific terms before you call this method using
        :meth:`Query.has_terms`.

        The Token objects will have the ``fieldname``, ``text``, and ``boost``
        attributes set. If the query was built by the query parser, they Token
        objects will also have ``startchar`` and ``endchar`` attributes
        indexing into the original user query.

        To get all tokens for a query tree, use :meth:`Query.all_tokens`.

        :param exreader: a reader to use to expand multiterm queries such as
            prefixes and wildcards. The default is None meaning do not expand.
        """

        return iter(())

    def requires(self):
        """Returns a set of queries that are *known* to be required to match
        for the entire query to match. Note that other queries might also turn
        out to be required but not be determinable by examining the static
        query.

        >>> a = Term("f", u"a")
        >>> b = Term("f", u"b")
        >>> And([a, b]).requires()
        set([Term("f", u"a"), Term("f", u"b")])
        >>> Or([a, b]).requires()
        set([])
        >>> AndMaybe(a, b).requires()
        set([Term("f", u"a")])
        >>> a.requires()
        set([Term("f", u"a")])
        """

        # Subclasses should implement the _add_required_to(qset) method

        return set([self])

    def field(self):
        """Returns the field this query matches in, or None if this query does
        not match in a single field.
        """

        return self.fieldname

    def with_boost(self, boost):
        """Returns a COPY of this query with the boost set to the given value.

        If a query type does not accept a boost itself, it will try to pass the
        boost on to its children, if any.
        """

        q = self.copy()
        q.boost = boost
        return q

    def estimate_size(self, ixreader):
        """Returns an estimate of how many documents this query could
        potentially match (for example, the estimated size of a simple term
        query is the document frequency of the term). It is permissible to
        overestimate, but not to underestimate.
        """
        raise NotImplementedError

    def estimate_min_size(self, ixreader):
        """Returns an estimate of the minimum number of documents this query
        could potentially match.
        """

        return self.estimate_size(ixreader)

    def matcher(self, searcher, context=None):
        """Returns a :class:`~whoosh.matching.Matcher` object you can use to
        retrieve documents and scores matching this query.

        :rtype: :class:`whoosh.matching.Matcher`
        """

        raise NotImplementedError

    def docs(self, searcher):
        """Returns an iterator of docnums matching this query.

        >>> with my_index.searcher() as searcher:
        ...     list(my_query.docs(searcher))
        [10, 34, 78, 103]

        :param searcher: A :class:`whoosh.searching.Searcher` object.
        """

        try:
            context = searcher.boolean_context()
            return self.matcher(searcher, context).all_ids()
        except TermNotFound:
            return iter([])

    def deletion_docs(self, searcher):
        """Returns an iterator of docnums matching this query for the purpose
        of deletion. The :meth:`~whoosh.writing.IndexWriter.delete_by_query`
        method will use this method when deciding what documents to delete,
        allowing special queries (e.g. nested queries) to override what
        documents are deleted. The default implementation just forwards to
        :meth:`Query.docs`.
        """

        return self.docs(searcher)

    def normalize(self):
        """Returns a recursively "normalized" form of this query. The
        normalized form removes redundancy and empty queries. This is called
        automatically on query trees created by the query parser, but you may
        want to call it yourself if you're writing your own parser or building
        your own queries.

        >>> q = And([And([Term("f", u"a"),
        ...               Term("f", u"b")]),
        ...               Term("f", u"c"), Or([])])
        >>> q.normalize()
        And([Term("f", u"a"), Term("f", u"b"), Term("f", u"c")])

        Note that this returns a *new, normalized* query. It *does not* modify
        the original query "in place".
        """
        return self

    def simplify(self, ixreader):
        """Returns a recursively simplified form of this query, where
        "second-order" queries (such as Prefix and Variations) are re-written
        into lower-level queries (such as Term and Or).
        """
        return self


# Null query

class _NullQuery(Query):
    "Represents a query that won't match anything."

    boost = 1.0

    def __init__(self):
        self.error = None

    def __unicode__(self):
        return u("<_NullQuery>")

    def __call__(self):
        return self

    def __repr__(self):
        return "<%s>" % (self.__class__.__name__)

    def __eq__(self, other):
        return isinstance(other, _NullQuery)

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return id(self)

    def __copy__(self):
        return self

    def __deepcopy__(self, memo):
        return self

    def field(self):
        return None

    def estimate_size(self, ixreader):
        return 0

    def normalize(self):
        return self

    def simplify(self, ixreader):
        return self

    def docs(self, searcher):
        return []

    def matcher(self, searcher, context=None):
        return matching.NullMatcher()


NullQuery = _NullQuery()


# Every

class Every(Query):
    """A query that matches every document containing any term in a given
    field. If you don't specify a field, the query matches every document.

    >>> # Match any documents with something in the "path" field
    >>> q = Every("path")
    >>> # Matcher every document
    >>> q = Every()

    The unfielded form (matching every document) is efficient.

    The fielded is more efficient than a prefix query with an empty prefix or a
    '*' wildcard, but it can still be very slow on large indexes. It requires
    the searcher to read the full posting list of every term in the given
    field.

    Instead of using this query it is much more efficient when you create the
    index to include a single term that appears in all documents that have the
    field you want to match.

    For example, instead of this::

        # Match all documents that have something in the "path" field
        q = Every("path")

    Do this when indexing::

        # Add an extra field that indicates whether a document has a path
        schema = fields.Schema(path=fields.ID, has_path=fields.ID)

        # When indexing, set the "has_path" field based on whether the document
        # has anything in the "path" field
        writer.add_document(text=text_value1)
        writer.add_document(text=text_value2, path=path_value2, has_path="t")

    Then to find all documents with a path::

        q = Term("has_path", "t")
    """

    def __init__(self, fieldname=None, boost=1.0):
        """
        :param fieldname: the name of the field to match, or ``None`` or ``*``
            to match all documents.
        """

        if not fieldname or fieldname == "*":
            fieldname = None
        self.fieldname = fieldname
        self.boost = boost

    def __repr__(self):
        return "%s(%r, boost=%s)" % (self.__class__.__name__, self.fieldname,
                                     self.boost)

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.fieldname == other.fieldname
                and self.boost == other.boost)

    def __unicode__(self):
        return u("%s:*") % self.fieldname

    __str__ = __unicode__

    def __hash__(self):
        return hash(self.fieldname)

    def estimate_size(self, ixreader):
        return ixreader.doc_count()

    def matcher(self, searcher, context=None):
        fieldname = self.fieldname
        reader = searcher.reader()

        if fieldname in (None, "", "*"):
            # This takes into account deletions
            doclist = array("I", reader.all_doc_ids())
        else:
            # This is a hacky hack, but just create an in-memory set of all the
            # document numbers of every term in the field. This is SLOOOW for
            # large indexes
            doclist = set()
            for text in searcher.lexicon(fieldname):
                pr = searcher.postings(fieldname, text)
                doclist.update(pr.all_ids())
            doclist = sorted(doclist)

        return matching.ListMatcher(doclist, all_weights=self.boost)
