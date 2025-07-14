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
from array import array

from whoosh import matching
from whoosh.compat import text_type, u, xrange
from whoosh.query import qcore


class WrappingQuery(qcore.Query):
    def __init__(self, child):
        self.child = child

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self.child)

    def __hash__(self):
        return hash(self.__class__.__name__) ^ hash(self.child)

    def _rewrap(self, child):
        return self.__class__(child)

    def is_leaf(self):
        return False

    def children(self):
        yield self.child

    def apply(self, fn):
        return self._rewrap(fn(self.child))

    def requires(self):
        return self.child.requires()

    def field(self):
        return self.child.field()

    def with_boost(self, boost):
        return self._rewrap(self.child.with_boost(boost))

    def estimate_size(self, ixreader):
        return self.child.estimate_size(ixreader)

    def estimate_min_size(self, ixreader):
        return self.child.estimate_min_size(ixreader)

    def matcher(self, searcher, context=None):
        return self.child.matcher(searcher, context)


class Not(qcore.Query):
    """Excludes any documents that match the subquery.

    >>> # Match documents that contain 'render' but not 'texture'
    >>> And([Term("content", u"render"),
    ...      Not(Term("content", u"texture"))])
    >>> # You can also do this
    >>> Term("content", u"render") - Term("content", u"texture")
    """

    __inittypes__ = dict(query=qcore.Query)

    def __init__(self, query, boost=1.0):
        """
        :param query: A :class:`Query` object. The results of this query
            are *excluded* from the parent query.
        :param boost: Boost is meaningless for excluded documents but this
            keyword argument is accepted for the sake of a consistent
            interface.
        """

        self.query = query
        self.boost = boost

    def __eq__(self, other):
        return other and self.__class__ is other.__class__ and\
        self.query == other.query

    def __repr__(self):
        return "%s(%s)" % (self.__class__.__name__, repr(self.query))

    def __unicode__(self):
        return u("NOT ") + text_type(self.query)

    __str__ = __unicode__

    def __hash__(self):
        return (hash(self.__class__.__name__)
                ^ hash(self.query)
                ^ hash(self.boost))

    def is_leaf(self):
        return False

    def children(self):
        yield self.query

    def apply(self, fn):
        return self.__class__(fn(self.query))

    def normalize(self):
        q = self.query.normalize()
        if q is qcore.NullQuery:
            return q
        else:
            return self.__class__(q, boost=self.boost)

    def field(self):
        return None

    def estimate_size(self, ixreader):
        return ixreader.doc_count()

    def estimate_min_size(self, ixreader):
        return 1 if ixreader.doc_count() else 0

    def matcher(self, searcher, context=None):
        # Usually only called if Not is the root query. Otherwise, queries such
        # as And and Or do special handling of Not subqueries.
        reader = searcher.reader()
        child = self.query.matcher(searcher, searcher.boolean_context())
        return matching.InverseMatcher(child, reader.doc_count_all(),
                                       missing=reader.is_deleted)


class ConstantScoreQuery(WrappingQuery):
    """Wraps a query and uses a matcher that always gives a constant score
    to all matching documents. This is a useful optimization when you don't
    care about scores from a certain branch of the query tree because it is
    simply acting as a filter. See also the :class:`AndMaybe` query.
    """

    def __init__(self, child, score=1.0):
        WrappingQuery.__init__(self, child)
        self.score = score

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.child == other.child and self.score == other.score)

    def __hash__(self):
        return hash(self.child) ^ hash(self.score)

    def _rewrap(self, child):
        return self.__class__(child, self.score)

    def matcher(self, searcher, context=None):
        from whoosh.searching import SearchContext

        context = context or SearchContext()
        m = self.child.matcher(searcher, context)
        if context.needs_current or isinstance(m, matching.NullMatcherClass):
            return m
        else:
            ids = array("I", m.all_ids())
            return matching.ListMatcher(ids, all_weights=self.score,
                                        term=m.term())


class WeightingQuery(WrappingQuery):
    """Wraps a query and uses a specific :class:`whoosh.sorting.WeightingModel`
    to score documents that match the wrapped query.
    """

    def __init__(self, child, weighting):
        WrappingQuery.__init__(self, child)
        self.weighting = weighting

    def matcher(self, searcher, context=None):
        # Replace the passed-in weighting with the one configured on this query
        context.set(weighting=self.weighting)
        return self.child.matcher(searcher, context)
