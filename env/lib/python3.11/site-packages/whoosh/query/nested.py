# Copyright 2012 Matt Chaput. All rights reserved.
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

from whoosh import matching
from whoosh.compat import text_type, u, xrange
from whoosh.query import qcore
from whoosh.query.wrappers import WrappingQuery


class NestedParent(WrappingQuery):
    """A query that allows you to search for "nested" documents, where you can
    index (possibly multiple levels of) "parent" and "child" documents using
    the :meth:`~whoosh.writing.IndexWriter.group` and/or
    :meth:`~whoosh.writing.IndexWriter.start_group` methods of a
    :class:`whoosh.writing.IndexWriter` to indicate that hierarchically related
    documents should be kept together::

        schema = fields.Schema(type=fields.ID, text=fields.TEXT(stored=True))

        with ix.writer() as w:
            # Say we're indexing chapters (type=chap) and each chapter has a
            # number of paragraphs (type=p)
            with w.group():
                w.add_document(type="chap", text="Chapter 1")
                w.add_document(type="p", text="Able baker")
                w.add_document(type="p", text="Bright morning")
            with w.group():
                w.add_document(type="chap", text="Chapter 2")
                w.add_document(type="p", text="Car trip")
                w.add_document(type="p", text="Dog eared")
                w.add_document(type="p", text="Every day")
            with w.group():
                w.add_document(type="chap", text="Chapter 3")
                w.add_document(type="p", text="Fine day")

    The ``NestedParent`` query wraps two sub-queries: the "parent query"
    matches a class of "parent documents". The "sub query" matches nested
    documents you want to find. For each "sub document" the "sub query" finds,
    this query acts as if it found the corresponding "parent document".

    >>> with ix.searcher() as s:
    ...   r = s.search(query.Term("text", "day"))
    ...   for hit in r:
    ...     print(hit["text"])
    ...
    Chapter 2
    Chapter 3
    """

    def __init__(self, parents, subq, per_parent_limit=None, score_fn=sum):
        """
        :param parents: a query, DocIdSet object, or Results object
            representing the documents you want to use as the "parent"
            documents. Where the sub-query matches, the corresponding document
            in these results will be returned as the match.
        :param subq: a query matching the information you want to find.
        :param per_parent_limit: a maximum number of "sub documents" to search
            per parent. The default is None, meaning no limit.
        :param score_fn: a function to use to combine the scores of matching
            sub-documents to calculate the score returned for the parent
            document. The default is ``sum``, that is, add up the scores of the
            sub-documents.
        """

        self.parents = parents
        self.child = subq
        self.per_parent_limit = per_parent_limit
        self.score_fn = score_fn

    def normalize(self):
        p = self.parents
        if isinstance(p, qcore.Query):
            p = p.normalize()
        q = self.child.normalize()

        if p is qcore.NullQuery or q is qcore.NullQuery:
            return qcore.NullQuery

        return self.__class__(p, q)

    def requires(self):
        return self.child.requires()

    def matcher(self, searcher, context=None):
        bits = searcher._filter_to_comb(self.parents)
        if not bits:
            return matching.NullMatcher
        m = self.child.matcher(searcher, context)
        if not m.is_active():
            return matching.NullMatcher

        return self.NestedParentMatcher(bits, m, self.per_parent_limit,
                                        searcher.doc_count_all(),
                                        self.score_fn)

    def deletion_docs(self, searcher):
        bits = searcher._filter_to_comb(self.parents)
        if not bits:
            return

        m = self.child.matcher(searcher, searcher.boolean_context())
        maxdoc = searcher.doc_count_all()
        while m.is_active():
            docnum = m.id()
            parentdoc = bits.before(docnum + 1)
            nextparent = bits.after(docnum) or maxdoc
            for i in xrange(parentdoc, nextparent):
                yield i
            m.skip_to(nextparent)

    class NestedParentMatcher(matching.Matcher):
        def __init__(self, comb, child, per_parent_limit, maxdoc, score_fn):
            self.comb = comb
            self.child = child
            self.per_parent_limit = per_parent_limit
            self.maxdoc = maxdoc
            self.score_fn = score_fn

            self._nextdoc = None
            if self.child.is_active():
                self._gather()

        def is_active(self):
            return self._nextdoc is not None

        def supports_block_quality(self):
            return False

        def _gather(self):
            # This is where the magic happens ;)
            child = self.child
            pplimit = self.per_parent_limit

            # The next document returned by this matcher is the parent of the
            # child's current document. We don't have to worry about whether
            # the parent is deleted, because the query that gave us the parents
            # wouldn't return deleted documents.
            self._nextdoc = self.comb.before(child.id() + 1)
            # The next parent after the child matcher's current document
            nextparent = self.comb.after(child.id()) or self.maxdoc

            # Sum the scores of all matching documents under the parent
            count = 1
            scores = []
            while child.is_active() and child.id() < nextparent:
                if pplimit and count > pplimit:
                    child.skip_to(nextparent)
                    break

                scores.append(child.score())
                child.next()
                count += 1

            score = self.score_fn(scores) if scores else 0
            self._nextscore = score

        def id(self):
            return self._nextdoc

        def score(self):
            return self._nextscore

        def reset(self):
            self.child.reset()
            self._gather()

        def next(self):
            if self.child.is_active():
                self._gather()
            else:
                if self._nextdoc is None:
                    raise matching.ReadTooFar
                else:
                    self._nextdoc = None

        def skip_to(self, id):
            self.child.skip_to(id)
            self._gather()

        def value(self):
            raise NotImplementedError(self.__class__)

        def spans(self):
            return []


class NestedChildren(WrappingQuery):
    """This is the reverse of a :class:`NestedParent` query: instead of taking
    a query that matches children but returns the parent, this query matches
    parents but returns the children.

    This is useful, for example, to search for an album title and return the
    songs in the album::

        schema = fields.Schema(type=fields.ID(stored=True),
                               album_name=fields.TEXT(stored=True),
                               track_num=fields.NUMERIC(stored=True),
                               track_name=fields.TEXT(stored=True),
                               lyrics=fields.TEXT)
        ix = RamStorage().create_index(schema)

        # Indexing
        with ix.writer() as w:
            # For each album, index a "group" of a parent "album" document and
            # multiple child "track" documents.
            with w.group():
                w.add_document(type="album",
                               artist="The Cure", album_name="Disintegration")
                w.add_document(type="track", track_num=1,
                               track_name="Plainsong")
                w.add_document(type="track", track_num=2,
                               track_name="Pictures of You")
                # ...
            # ...


        # Find songs where the song name has "heaven" in the title and the
        # album the song is on has "hell" in the title
        qp = QueryParser("lyrics", ix.schema)
        with ix.searcher() as s:
            # A query that matches all parents
            all_albums = qp.parse("type:album")

            # A query that matches the parents we want
            albums_with_hell = qp.parse("album_name:hell")

            # A query that matches the desired albums but returns the tracks
            songs_on_hell_albums = NestedChildren(all_albums, albums_with_hell)

            # A query that matches tracks with heaven in the title
            songs_with_heaven = qp.parse("track_name:heaven")

            # A query that finds tracks with heaven in the title on albums
            # with hell in the title
            q = query.And([songs_on_hell_albums, songs_with_heaven])

    """

    def __init__(self, parents, subq, boost=1.0):
        self.parents = parents
        self.child = subq
        self.boost = boost

    def matcher(self, searcher, context=None):
        bits = searcher._filter_to_comb(self.parents)
        if not bits:
            return matching.NullMatcher

        m = self.child.matcher(searcher, context)
        if not m.is_active():
            return matching.NullMatcher

        return self.NestedChildMatcher(bits, m, searcher.doc_count_all(),
                                       searcher.reader().is_deleted,
                                       boost=self.boost)

    class NestedChildMatcher(matching.WrappingMatcher):
        def __init__(self, parent_comb, wanted_parent_matcher, limit,
                     is_deleted, boost=1.0):
            self.parent_comb = parent_comb
            self.child = wanted_parent_matcher
            self.limit = limit
            self.is_deleted = is_deleted
            self.boost = boost
            self._nextchild = -1
            self._nextparent = -1
            self._find_next_children()

        def __repr__(self):
            return "%s(%r, %r)" % (self.__class__.__name__,
                                   self.parent_comb,
                                   self.child)

        def reset(self):
            self.child.reset()
            self._reset()

        def _reset(self):
            self._nextchild = -1
            self._nextparent = -1
            self._find_next_children()

        def is_active(self):
            return self._nextchild < self._nextparent

        def replace(self, minquality=0):
            return self

        def _find_next_children(self):
            # "comb" contains the doc IDs of all parent documents
            comb = self.parent_comb
            # "m" is the matcher for "wanted" parents
            m = self.child
            # Last doc ID + 1
            limit = self.limit
            # A function that returns True if a doc ID is deleted
            is_deleted = self.is_deleted
            nextchild = self._nextchild
            nextparent = self._nextparent

            while m.is_active():
                # Move the "child id" to the document after the current match
                nextchild = m.id() + 1
                # Move the parent matcher to the next match
                m.next()

                # Find the next parent document (matching or not) after this
                nextparent = comb.after(nextchild)
                if nextparent is None:
                    nextparent = limit

                # Skip any deleted child documents
                while is_deleted(nextchild):
                    nextchild += 1

                # If skipping deleted documents put us to or past the next
                # parent doc, go again
                if nextchild >= nextparent:
                    continue
                else:
                    # Otherwise, we're done
                    break

            self._nextchild = nextchild
            self._nextparent = nextparent

        def id(self):
            return self._nextchild

        def all_ids(self):
            while self.is_active():
                yield self.id()
                self.next()

        def next(self):
            is_deleted = self.is_deleted
            limit = self.limit
            nextparent = self._nextparent

            # Go to the next document
            nextchild = self._nextchild
            nextchild += 1

            # Skip over any deleted child documents
            while nextchild < nextparent and is_deleted(nextchild):
                nextchild += 1

            self._nextchild = nextchild
            # If we're at or past the next parent doc, go to the next set of
            # children
            if nextchild >= limit:
                return
            elif nextchild >= nextparent:
                self._find_next_children()

        def skip_to(self, docid):
            comb = self.parent_comb
            wanted = self.child

            # self._nextchild is the "current" matching child ID
            if docid <= self._nextchild:
                return

            # self._nextparent is the next parent ID (matching or not)
            if docid < self._nextparent:
                # Just iterate
                while self.is_active() and self.id() < docid:
                    self.next()
            elif wanted.is_active():
                # Find the parent before the target ID
                pid = comb.before(docid)
                # Skip the parent matcher to that ID
                wanted.skip_to(pid)
                # If that made the matcher inactive, then we're done
                if not wanted.is_active():
                    self._nextchild = self._nextparent = self.limit
                else:
                    # Reestablish for the next child after the next matching
                    # parent
                    self._find_next_children()
            else:
                self._nextchild = self._nextparent = self.limit

        def value(self):
            raise NotImplementedError(self.__class__)

        def score(self):
            return self.boost

        def spans(self):
            return []
