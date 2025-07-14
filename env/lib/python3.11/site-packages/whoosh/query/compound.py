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

from whoosh import matching
from whoosh.compat import text_type, u
from whoosh.compat import xrange
from whoosh.query import qcore
from whoosh.util import make_binary_tree, make_weighted_tree


class CompoundQuery(qcore.Query):
    """Abstract base class for queries that combine or manipulate the results
    of multiple sub-queries .
    """

    def __init__(self, subqueries, boost=1.0):
        for subq in subqueries:
            if not isinstance(subq, qcore.Query):
                raise qcore.QueryError("%r is not a query" % subq)
        self.subqueries = subqueries
        self.boost = boost

    def __repr__(self):
        r = "%s(%r" % (self.__class__.__name__, self.subqueries)
        if hasattr(self, "boost") and self.boost != 1:
            r += ", boost=%s" % self.boost
        r += ")"
        return r

    def __unicode__(self):
        r = u("(")
        r += self.JOINT.join([text_type(s) for s in self.subqueries])
        r += u(")")
        return r

    __str__ = __unicode__

    def __eq__(self, other):
        return (other
                and self.__class__ is other.__class__
                and self.subqueries == other.subqueries
                and self.boost == other.boost)

    def __getitem__(self, i):
        return self.subqueries.__getitem__(i)

    def __len__(self):
        return len(self.subqueries)

    def __iter__(self):
        return iter(self.subqueries)

    def __hash__(self):
        h = hash(self.__class__.__name__) ^ hash(self.boost)
        for q in self.subqueries:
            h ^= hash(q)
        return h

    def is_leaf(self):
        return False

    def children(self):
        return iter(self.subqueries)

    def apply(self, fn):
        return self.__class__([fn(q) for q in self.subqueries],
                              boost=self.boost)

    def field(self):
        if self.subqueries:
            f = self.subqueries[0].field()
            if all(q.field() == f for q in self.subqueries[1:]):
                return f

    def estimate_size(self, ixreader):
        est = sum(q.estimate_size(ixreader) for q in self.subqueries)
        return min(est, ixreader.doc_count())

    def estimate_min_size(self, ixreader):
        from whoosh.query import Not

        subs = self.subqueries
        qs = [(q, q.estimate_min_size(ixreader)) for q in subs
              if not isinstance(q, Not)]
        pos = [minsize for q, minsize in qs if minsize > 0]
        if pos:
            neg = [q.estimate_size(ixreader) for q in subs
                   if isinstance(q, Not)]
            size = min(pos) - sum(neg)
            if size > 0:
                return size
        return 0

    def normalize(self):
        from whoosh.query import Every, TermRange, NumericRange

        # Normalize subqueries and merge nested instances of this class
        subqueries = []
        for s in self.subqueries:
            s = s.normalize()
            if isinstance(s, self.__class__):
                subqueries += [ss.with_boost(ss.boost * s.boost) for ss in s]
            else:
                subqueries.append(s)

        # If every subquery is Null, this query is Null
        if all(q is qcore.NullQuery for q in subqueries):
            return qcore.NullQuery

        # If there's an unfielded Every inside, then this query is Every
        if any((isinstance(q, Every) and q.fieldname is None)
               for q in subqueries):
            return Every()

        # Merge ranges and Everys
        everyfields = set()
        i = 0
        while i < len(subqueries):
            q = subqueries[i]
            f = q.field()
            if f in everyfields:
                subqueries.pop(i)
                continue

            if isinstance(q, (TermRange, NumericRange)):
                j = i + 1
                while j < len(subqueries):
                    if q.overlaps(subqueries[j]):
                        qq = subqueries.pop(j)
                        q = q.merge(qq, intersect=self.intersect_merge)
                    else:
                        j += 1
                q = subqueries[i] = q.normalize()

            if isinstance(q, Every):
                everyfields.add(q.fieldname)
            i += 1

        # Eliminate duplicate queries
        subqs = []
        seenqs = set()
        for s in subqueries:
            if not isinstance(s, Every) and s.field() in everyfields:
                continue
            if s in seenqs:
                continue
            seenqs.add(s)
            subqs.append(s)

        # Remove NullQuerys
        subqs = [q for q in subqs if q is not qcore.NullQuery]

        if not subqs:
            return qcore.NullQuery

        if len(subqs) == 1:
            sub = subqs[0]
            sub_boost = getattr(sub, "boost", 1.0)
            if not (self.boost == 1.0 and sub_boost == 1.0):
                sub = sub.with_boost(sub_boost * self.boost)
            return sub

        return self.__class__(subqs, boost=self.boost)

    def simplify(self, ixreader):
        subs = self.subqueries
        if subs:
            q = self.__class__([subq.simplify(ixreader) for subq in subs],
                                boost=self.boost).normalize()
        else:
            q = qcore.NullQuery
        return q

    def matcher(self, searcher, context=None):
        # This method does a little sanity checking and then passes the info
        # down to the _matcher() method which subclasses must implement

        subs = self.subqueries
        if not subs:
            return matching.NullMatcher()

        if len(subs) == 1:
            m = subs[0].matcher(searcher, context)
        else:
            m = self._matcher(subs, searcher, context)
        return m

    def _matcher(self, subs, searcher, context):
        # Subclasses must implement this method

        raise NotImplementedError

    def _tree_matcher(self, subs, mcls, searcher, context, q_weight_fn,
                      **kwargs):
        # q_weight_fn is a function which is called on each query and returns a
        # "weight" value which is used to build a huffman-like matcher tree. If
        # q_weight_fn is None, an order-preserving binary tree is used instead.

        # Create a matcher from the list of subqueries
        subms = [q.matcher(searcher, context) for q in subs]

        if len(subms) == 1:
            m = subms[0]
        elif q_weight_fn is None:
            m = make_binary_tree(mcls, subms, **kwargs)
        else:
            w_subms = [(q_weight_fn(q), m) for q, m in zip(subs, subms)]
            m = make_weighted_tree(mcls, w_subms, **kwargs)

        # If this query had a boost, add a wrapping matcher to apply the boost
        if self.boost != 1.0:
            m = matching.WrappingMatcher(m, self.boost)

        return m


class And(CompoundQuery):
    """Matches documents that match ALL of the subqueries.

    >>> And([Term("content", u"render"),
    ...      Term("content", u"shade"),
    ...      Not(Term("content", u"texture"))])
    >>> # You can also do this
    >>> Term("content", u"render") & Term("content", u"shade")
    """

    # This is used by the superclass's __unicode__ method.
    JOINT = " AND "
    intersect_merge = True

    def requires(self):
        s = set()
        for q in self.subqueries:
            s |= q.requires()
        return s

    def estimate_size(self, ixreader):
        return min(q.estimate_size(ixreader) for q in self.subqueries)

    def _matcher(self, subs, searcher, context):
        r = searcher.reader()
        q_weight_fn = lambda q: 0 - q.estimate_size(r)
        return self._tree_matcher(subs, matching.IntersectionMatcher, searcher,
                                  context, q_weight_fn)


class Or(CompoundQuery):
    """Matches documents that match ANY of the subqueries.

    >>> Or([Term("content", u"render"),
    ...     And([Term("content", u"shade"), Term("content", u"texture")]),
    ...     Not(Term("content", u"network"))])
    >>> # You can also do this
    >>> Term("content", u"render") | Term("content", u"shade")
    """

    # This is used by the superclass's __unicode__ method.
    JOINT = " OR "
    intersect_merge = False
    TOO_MANY_CLAUSES = 1024

    # For debugging: set the array_type property to control matcher selection
    AUTO_MATCHER = 0  # Use automatic heuristics to choose matcher
    DEFAULT_MATCHER = 1  # Use a binary tree of UnionMatchers
    SPLIT_MATCHER = 2  # Use a different strategy for short and long queries
    ARRAY_MATCHER = 3  # Use a matcher that pre-loads docnums and scores
    matcher_type = AUTO_MATCHER

    def __init__(self, subqueries, boost=1.0, minmatch=0, scale=None):
        """
        :param subqueries: a list of :class:`Query` objects to search for.
        :param boost: a boost factor to apply to the scores of all matching
            documents.
        :param minmatch: not yet implemented.
        :param scale: a scaling factor for a "coordination bonus". If this
            value is not None, it should be a floating point number greater
            than 0 and less than 1. The scores of the matching documents are
            boosted/penalized based on the number of query terms that matched
            in the document. This number scales the effect of the bonuses.
        """

        CompoundQuery.__init__(self, subqueries, boost=boost)
        self.minmatch = minmatch
        self.scale = scale

    def __unicode__(self):
        r = u("(")
        r += (self.JOINT).join([text_type(s) for s in self.subqueries])
        r += u(")")
        if self.minmatch:
            r += u(">%s") % self.minmatch
        return r

    __str__ = __unicode__

    def normalize(self):
        norm = CompoundQuery.normalize(self)
        if norm.__class__ is self.__class__:
            norm.minmatch = self.minmatch
            norm.scale = self.scale
        return norm

    def requires(self):
        if len(self.subqueries) == 1:
            return self.subqueries[0].requires()
        else:
            return set()

    def _matcher(self, subs, searcher, context):
        needs_current = context.needs_current if context else True
        weighting = context.weighting if context else None
        matcher_type = self.matcher_type

        if matcher_type == self.AUTO_MATCHER:
            dc = searcher.doc_count_all()
            if (len(subs) < self.TOO_MANY_CLAUSES
                and (needs_current
                     or self.scale
                     or len(subs) == 2
                     or dc > 5000)):
                # If the parent matcher needs the current match, or there's just
                # two sub-matchers, use the standard binary tree of Unions
                matcher_type = self.DEFAULT_MATCHER
            else:
                # For small indexes, or too many clauses, just preload all
                # matches
                matcher_type = self.ARRAY_MATCHER

        if matcher_type == self.DEFAULT_MATCHER:
            # Implementation of Or that creates a binary tree of Union matchers
            cls = DefaultOr
        elif matcher_type == self.SPLIT_MATCHER:
            # Hybrid of pre-loading small queries and a binary tree of union
            # matchers for big queries
            cls = SplitOr
        elif matcher_type == self.ARRAY_MATCHER:
            # Implementation that pre-loads docnums and scores into an array
            cls = PreloadedOr
        else:
            raise ValueError("Unknown matcher_type %r" % self.matcher_type)

        return cls(subs, boost=self.boost, minmatch=self.minmatch,
                   scale=self.scale).matcher(searcher, context)


class DefaultOr(Or):
    JOINT = " dOR "

    def _matcher(self, subs, searcher, context):
        reader = searcher.reader()
        q_weight_fn = lambda q: q.estimate_size(reader)
        m = self._tree_matcher(subs, matching.UnionMatcher, searcher, context,
                               q_weight_fn)

        # If a scaling factor was given, wrap the matcher in a CoordMatcher to
        # alter scores based on term coordination
        if self.scale and any(m.term_matchers()):
            m = matching.CoordMatcher(m, scale=self.scale)

        return m


class SplitOr(Or):
    JOINT = " sOr "
    SPLIT_DOC_LIMIT = 8000

    def matcher(self, searcher, context=None):
        from whoosh import collectors

        # Get the subqueries
        subs = self.subqueries
        if not subs:
            return matching.NullMatcher()
        elif len(subs) == 1:
            return subs[0].matcher(searcher, context)

        # Sort the subqueries into "small" and "big" queries based on their
        # estimated size. This works best for term queries.
        reader = searcher.reader()
        smallqs = []
        bigqs = []
        for q in subs:
            size = q.estimate_size(reader)
            if size <= self.SPLIT_DOC_LIMIT:
                smallqs.append(q)
            else:
                bigqs.append(q)

        # Build a pre-scored matcher for the small queries
        minscore = 0
        smallmatcher = None
        if smallqs:
            smallmatcher = DefaultOr(smallqs).matcher(searcher, context)
            smallmatcher = matching.ArrayMatcher(smallmatcher, context.limit)
            minscore = smallmatcher.limit_quality()
        if bigqs:
            # Get a matcher for the big queries
            m = DefaultOr(bigqs).matcher(searcher, context)
            # Add the prescored matcher for the small queries
            if smallmatcher:
                m = matching.UnionMatcher(m, smallmatcher)
                # Set the minimum score based on the prescored matcher
                m.set_min_quality(minscore)
        elif smallmatcher:
            # If there are no big queries, just return the prescored matcher
            m = smallmatcher
        else:
            m = matching.NullMatcher()

        return m


class PreloadedOr(Or):
    JOINT = " pOR "

    def _matcher(self, subs, searcher, context):
        if context:
            scored = context.weighting is not None
        else:
            scored = True

        ms = [sub.matcher(searcher, context) for sub in subs]
        doccount = searcher.doc_count_all()
        am = matching.ArrayUnionMatcher(ms, doccount, boost=self.boost,
                                        scored=scored)
        return am


class DisjunctionMax(CompoundQuery):
    """Matches all documents that match any of the subqueries, but scores each
    document using the maximum score from the subqueries.
    """

    def __init__(self, subqueries, boost=1.0, tiebreak=0.0):
        CompoundQuery.__init__(self, subqueries, boost=boost)
        self.tiebreak = tiebreak

    def __unicode__(self):
        r = u("DisMax(")
        r += " ".join(sorted(text_type(s) for s in self.subqueries))
        r += u(")")
        if self.tiebreak:
            r += u("~") + text_type(self.tiebreak)
        return r

    __str__ = __unicode__

    def normalize(self):
        norm = CompoundQuery.normalize(self)
        if norm.__class__ is self.__class__:
            norm.tiebreak = self.tiebreak
        return norm

    def requires(self):
        if len(self.subqueries) == 1:
            return self.subqueries[0].requires()
        else:
            return set()

    def _matcher(self, subs, searcher, context):
        r = searcher.reader()
        q_weight_fn = lambda q: q.estimate_size(r)
        return self._tree_matcher(subs, matching.DisjunctionMaxMatcher,
                                  searcher, context, q_weight_fn,
                                  tiebreak=self.tiebreak)


# Boolean queries

class BinaryQuery(CompoundQuery):
    """Base class for binary queries (queries which are composed of two
    sub-queries). Subclasses should set the ``matcherclass`` attribute or
    override ``matcher()``, and may also need to override ``normalize()``,
    ``estimate_size()``, and/or ``estimate_min_size()``.
    """

    boost = 1.0

    def __init__(self, a, b):
        self.a = a
        self.b = b
        self.subqueries = (a, b)

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.a == other.a and self.b == other.b)

    def __hash__(self):
        return (hash(self.__class__.__name__) ^ hash(self.a) ^ hash(self.b))

    def needs_spans(self):
        return self.a.needs_spans() or self.b.needs_spans()

    def apply(self, fn):
        return self.__class__(fn(self.a), fn(self.b))

    def field(self):
        f = self.a.field()
        if self.b.field() == f:
            return f

    def with_boost(self, boost):
        return self.__class__(self.a.with_boost(boost),
                              self.b.with_boost(boost))

    def normalize(self):
        a = self.a.normalize()
        b = self.b.normalize()
        if a is qcore.NullQuery and b is qcore.NullQuery:
            return qcore.NullQuery
        elif a is qcore.NullQuery:
            return b
        elif b is qcore.NullQuery:
            return a

        return self.__class__(a, b)

    def matcher(self, searcher, context=None):
        return self.matcherclass(self.a.matcher(searcher, context),
                                 self.b.matcher(searcher, context))


class AndNot(BinaryQuery):
    """Binary boolean query of the form 'a ANDNOT b', where documents that
    match b are removed from the matches for a.
    """

    JOINT = " ANDNOT "

    def with_boost(self, boost):
        return self.__class__(self.a.with_boost(boost), self.b)

    def normalize(self):
        a = self.a.normalize()
        b = self.b.normalize()

        if a is qcore.NullQuery:
            return qcore.NullQuery
        elif b is qcore.NullQuery:
            return a

        return self.__class__(a, b)

    def requires(self):
        return self.a.requires()

    def matcher(self, searcher, context=None):
        scoredm = self.a.matcher(searcher, context)
        notm = self.b.matcher(searcher, searcher.boolean_context())
        return matching.AndNotMatcher(scoredm, notm)


class Otherwise(BinaryQuery):
    """A binary query that only matches the second clause if the first clause
    doesn't match any documents.
    """

    JOINT = " OTHERWISE "

    def matcher(self, searcher, context=None):
        m = self.a.matcher(searcher, context)
        if not m.is_active():
            m = self.b.matcher(searcher, context)
        return m


class Require(BinaryQuery):
    """Binary query returns results from the first query that also appear in
    the second query, but only uses the scores from the first query. This lets
    you filter results without affecting scores.
    """

    JOINT = " REQUIRE "
    matcherclass = matching.RequireMatcher

    def requires(self):
        return self.a.requires() | self.b.requires()

    def estimate_size(self, ixreader):
        return self.b.estimate_size(ixreader)

    def estimate_min_size(self, ixreader):
        return self.b.estimate_min_size(ixreader)

    def with_boost(self, boost):
        return self.__class__(self.a.with_boost(boost), self.b)

    def normalize(self):
        a = self.a.normalize()
        b = self.b.normalize()
        if a is qcore.NullQuery or b is qcore.NullQuery:
            return qcore.NullQuery
        return self.__class__(a, b)

    def docs(self, searcher):
        return And(self.subqueries).docs(searcher)

    def matcher(self, searcher, context=None):
        scoredm = self.a.matcher(searcher, context)
        requiredm = self.b.matcher(searcher, searcher.boolean_context())
        return matching.AndNotMatcher(scoredm, requiredm)


class AndMaybe(BinaryQuery):
    """Binary query takes results from the first query. If and only if the
    same document also appears in the results from the second query, the score
    from the second query will be added to the score from the first query.
    """

    JOINT = " ANDMAYBE "
    matcherclass = matching.AndMaybeMatcher

    def normalize(self):
        a = self.a.normalize()
        b = self.b.normalize()
        if a is qcore.NullQuery:
            return qcore.NullQuery
        if b is qcore.NullQuery:
            return a
        return self.__class__(a, b)

    def requires(self):
        return self.a.requires()

    def estimate_min_size(self, ixreader):
        return self.subqueries[0].estimate_min_size(ixreader)

    def docs(self, searcher):
        return self.subqueries[0].docs(searcher)


def BooleanQuery(required, should, prohibited):
    return AndNot(AndMaybe(And(required), Or(should)),
                  Or(prohibited)).normalize()
