# Copyright 2010 Matt Chaput. All rights reserved.
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

from whoosh.compat import xrange
from whoosh.matching import mcore


class WrappingMatcher(mcore.Matcher):
    """Base class for matchers that wrap sub-matchers.
    """

    def __init__(self, child, boost=1.0):
        self.child = child
        self.boost = boost

    def __repr__(self):
        return "%s(%r, boost=%s)" % (self.__class__.__name__, self.child,
                                     self.boost)

    def copy(self):
        kwargs = {}
        if hasattr(self, "boost"):
            kwargs["boost"] = self.boost
        return self.__class__(self.child.copy(), **kwargs)

    def depth(self):
        return 1 + self.child.depth()

    def _replacement(self, newchild):
        return self.__class__(newchild, boost=self.boost)

    def replace(self, minquality=0):
        # Replace the child matcher
        r = self.child.replace(minquality)
        if r is not self.child:
            # If the child changed, return a new wrapper on the new child
            return self._replacement(r)
        else:
            return self

    def id(self):
        return self.child.id()

    def all_ids(self):
        return self.child.all_ids()

    def is_active(self):
        return self.child.is_active()

    def reset(self):
        self.child.reset()

    def children(self):
        return [self.child]

    def supports(self, astype):
        return self.child.supports(astype)

    def value(self):
        return self.child.value()

    def value_as(self, astype):
        return self.child.value_as(astype)

    def spans(self):
        return self.child.spans()

    def skip_to(self, id):
        return self.child.skip_to(id)

    def next(self):
        self.child.next()

    def supports_block_quality(self):
        return self.child.supports_block_quality()

    def skip_to_quality(self, minquality):
        return self.child.skip_to_quality(minquality / self.boost)

    def max_quality(self):
        return self.child.max_quality() * self.boost

    def block_quality(self):
        return self.child.block_quality() * self.boost

    def weight(self):
        return self.child.weight() * self.boost

    def score(self):
        return self.child.score() * self.boost


class MultiMatcher(mcore.Matcher):
    """Serializes the results of a list of sub-matchers.
    """

    def __init__(self, matchers, idoffsets, scorer=None, current=0):
        """
        :param matchers: a list of Matcher objects.
        :param idoffsets: a list of offsets corresponding to items in the
            ``matchers`` list.
        """

        self.matchers = matchers
        self.offsets = idoffsets
        self.scorer = scorer
        self.current = current
        self._next_matcher()

    def __repr__(self):
        return "%s(%r, %r, current=%s)" % (self.__class__.__name__,
                                           self.matchers, self.offsets,
                                           self.current)

    def is_active(self):
        return self.current < len(self.matchers)

    def reset(self):
        for mr in self.matchers:
            mr.reset()
        self.current = 0

    def children(self):
        return [self.matchers[self.current]]

    def _next_matcher(self):
        matchers = self.matchers
        while (self.current < len(matchers)
               and not matchers[self.current].is_active()):
            self.current += 1

    def copy(self):
        return self.__class__([mr.copy() for mr in self.matchers],
                              self.offsets, current=self.current)

    def depth(self):
        if self.is_active():
            return 1 + max(mr.depth() for mr in self.matchers[self.current:])
        else:
            return 0

    def replace(self, minquality=0):
        m = self
        if minquality:
            # Skip sub-matchers that don't have a high enough max quality to
            # contribute
            while (m.is_active()
                   and m.matchers[m.current].max_quality() < minquality):
                m = self.__class__(self.matchers, self.offsets, self.scorer,
                                   m.current + 1)
                m._next_matcher()

        if not m.is_active():
            return mcore.NullMatcher()

        # TODO: Possible optimization: if the last matcher is current, replace
        # this with the last matcher, but wrap it with a matcher that adds the
        # offset. Have to check whether that's actually faster, though.
        return m

    def id(self):
        current = self.current
        return self.matchers[current].id() + self.offsets[current]

    def all_ids(self):
        offsets = self.offsets
        for i, mr in enumerate(self.matchers):
            for id in mr.all_ids():
                yield id + offsets[i]

    def spans(self):
        return self.matchers[self.current].spans()

    def supports(self, astype):
        return self.matchers[self.current].supports(astype)

    def value(self):
        return self.matchers[self.current].value()

    def value_as(self, astype):
        return self.matchers[self.current].value_as(astype)

    def next(self):
        if not self.is_active():
            raise mcore.ReadTooFar

        self.matchers[self.current].next()
        if not self.matchers[self.current].is_active():
            self._next_matcher()

    def skip_to(self, id):
        if not self.is_active():
            raise mcore.ReadTooFar
        if id <= self.id():
            return

        matchers = self.matchers
        offsets = self.offsets
        r = False

        while self.current < len(matchers) and id > self.id():
            mr = matchers[self.current]
            sr = mr.skip_to(id - offsets[self.current])
            r = sr or r
            if mr.is_active():
                break

            self._next_matcher()

        return r

    def supports_block_quality(self):
        return all(mr.supports_block_quality() for mr
                   in self.matchers[self.current:])

    def max_quality(self):
        return max(m.max_quality() for m in self.matchers[self.current:])

    def block_quality(self):
        return self.matchers[self.current].block_quality()

    def weight(self):
        return self.matchers[self.current].weight()

    def score(self):
        return self.scorer.score(self)


def ExcludeMatcher(child, excluded, boost=1.0):
    return FilterMatcher(child, excluded, exclude=True, boost=boost)


class FilterMatcher(WrappingMatcher):
    """Filters the postings from the wrapped based on whether the IDs are
    present in or absent from a set.
    """

    def __init__(self, child, ids, exclude=False, boost=1.0):
        """
        :param child: the child matcher.
        :param ids: a set of IDs to filter by.
        :param exclude: by default, only IDs from the wrapped matcher that are
            **in** the set are used. If this argument is True, only IDs from
            the wrapped matcher that are **not in** the set are used.
        """

        super(FilterMatcher, self).__init__(child)
        self._ids = ids
        self._exclude = exclude
        self.boost = boost
        self._find_next()

    def __repr__(self):
        return "%s(%r, %r, %r, boost=%s)" % (self.__class__.__name__,
                                             self.child, self._ids,
                                             self._exclude, self.boost)

    def reset(self):
        self.child.reset()
        self._find_next()

    def copy(self):
        return self.__class__(self.child.copy(), self._ids, self._exclude,
                              boost=self.boost)

    def _replacement(self, newchild):
        return self.__class__(newchild, self._ids, exclude=self._exclude,
                              boost=self.boost)

    def _find_next(self):
        child = self.child
        ids = self._ids
        r = False

        if self._exclude:
            while child.is_active() and child.id() in ids:
                r = child.next() or r
        else:
            while child.is_active() and child.id() not in ids:
                r = child.next() or r
        return r

    def next(self):
        self.child.next()
        self._find_next()

    def skip_to(self, id):
        self.child.skip_to(id)
        self._find_next()

    def all_ids(self):
        ids = self._ids
        if self._exclude:
            return (id for id in self.child.all_ids() if id not in ids)
        else:
            return (id for id in self.child.all_ids() if id in ids)

    def all_items(self):
        ids = self._ids
        if self._exclude:
            return (item for item in self.child.all_items()
                    if item[0] not in ids)
        else:
            return (item for item in self.child.all_items() if item[0] in ids)


class InverseMatcher(WrappingMatcher):
    """Synthetic matcher, generates postings that are NOT present in the
    wrapped matcher.
    """

    def __init__(self, child, limit, missing=None, weight=1.0, id=0):
        super(InverseMatcher, self).__init__(child)
        self.limit = limit
        self._weight = weight
        self.missing = missing or (lambda id: False)
        self._id = id
        self._find_next()

    def copy(self):
        return self.__class__(self.child.copy(), self.limit,
                              weight=self._weight, missing=self.missing,
                              id=self._id)

    def _replacement(self, newchild):
        return self.__class__(newchild, self.limit, missing=self.missing,
                              weight=self._weight, id=self._id)

    def is_active(self):
        return self._id < self.limit

    def reset(self):
        self.child.reset()
        self._id = 0
        self._find_next()

    def supports_block_quality(self):
        return False

    def _find_next(self):
        child = self.child
        missing = self.missing

        # If the current docnum isn't missing and the child matcher is
        # exhausted (so we don't have to worry about skipping its matches), we
        # don't have to do anything
        if not child.is_active() and not missing(self._id):
            return

        # Skip missing documents
        while self._id < self.limit and missing(self._id):
            self._id += 1

        # Catch the child matcher up to where this matcher is
        if child.is_active() and child.id() < self._id:
            child.skip_to(self._id)

        # While self._id is missing or is in the child matcher, increase it
        while child.is_active() and self._id < self.limit:
            if missing(self._id):
                self._id += 1
                continue

            if self._id == child.id():
                self._id += 1
                child.next()
                continue

            break

    def id(self):
        return self._id

    def all_ids(self):
        return mcore.Matcher.all_ids(self)

    def next(self):
        if self._id >= self.limit:
            raise mcore.ReadTooFar
        self._id += 1
        self._find_next()

    def skip_to(self, id):
        if self._id >= self.limit:
            raise mcore.ReadTooFar
        if id < self._id:
            return
        self._id = id
        self._find_next()

    def weight(self):
        return self._weight

    def score(self):
        return self._weight


class RequireMatcher(WrappingMatcher):
    """Matches postings that are in both sub-matchers, but only uses scores
    from the first.
    """

    def __init__(self, a, b):
        from whoosh.matching.binary import IntersectionMatcher

        self.a = a
        self.b = b
        WrappingMatcher.__init__(self, IntersectionMatcher(a, b))

    def copy(self):
        return self.__class__(self.a.copy(), self.b.copy())

    def supports_block_quality(self):
        return self.a.supports_block_quality()

    def replace(self, minquality=0):
        if not self.child.is_active():
            # If one of the sub-matchers is inactive, go inactive
            return mcore.NullMatcher()
        elif minquality and self.a.max_quality() < minquality:
            # If the required matcher doesn't have a high enough max quality
            # to possibly contribute, return an inactive matcher
            return mcore.NullMatcher()

        new_a = self.a.replace(minquality)
        new_b = self.b.replace()
        if not new_a.is_active():
            return mcore.NullMatcher()
        elif new_a is not self.a or new_b is not self.b:
            # If one of the sub-matchers changed, return a new Require
            return self.__class__(new_a, self.b)
        else:
            return self

    def max_quality(self):
        return self.a.max_quality()

    def block_quality(self):
        return self.a.block_quality()

    def skip_to_quality(self, minquality):
        skipped = self.a.skip_to_quality(minquality)
        self.child._find_next()
        return skipped

    def weight(self):
        return self.a.weight()

    def score(self):
        return self.a.score()

    def supports(self, astype):
        return self.a.supports(astype)

    def value(self):
        return self.a.value()

    def value_as(self, astype):
        return self.a.value_as(astype)


class ConstantScoreWrapperMatcher(WrappingMatcher):
    def __init__(self, child, score=1.0):
        WrappingMatcher.__init__(self, child)
        self._score = score

    def copy(self):
        return self.__class__(self.child.copy(), score=self._score)

    def _replacement(self, newchild):
        return self.__class__(newchild, score=self._score)

    def max_quality(self):
        return self._score

    def block_quality(self):
        return self._score

    def score(self):
        return self._score


class SingleTermMatcher(WrappingMatcher):
    """Makes a tree of matchers act as if they were a matcher for a single
    term for the purposes of "what terms are matching?" questions.
    """

    def __init__(self, child, term):
        WrappingMatcher.__init__(self, child)
        self._term = term

    def term(self):
        return self._term

    def replace(self, minquality=0):
        return self


class CoordMatcher(WrappingMatcher):
    """Modifies the computed score to penalize documents that don't match all
    terms in the matcher tree.

    Because this matcher modifies the score, it may give unexpected results
    when compared to another matcher returning the unmodified score.
    """

    def __init__(self, child, scale=1.0):
        WrappingMatcher.__init__(self, child)
        self._termcount = len(list(child.term_matchers()))
        self._maxqual = child.max_quality()
        self._scale = scale

    def _replacement(self, newchild):
        return self.__class__(newchild, scale=self._scale)

    def _sqr(self, score, matching):
        # This is the "SQR" (Short Query Ranking) function used by Apple's old
        # V-twin search library, described in the paper "V-Twin: A Lightweight
        # Engine for Interactive Use".
        #
        # http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.56.1916

        # score - document score using the current weighting function
        # matching - number of matching terms in the current document
        termcount = self._termcount  # Number of terms in this tree
        scale = self._scale  # Scaling factor

        sqr = ((score + ((matching - 1) / (termcount - scale) ** 2))
               * ((termcount - 1) / termcount))
        return sqr

    def max_quality(self):
        return self._sqr(self.child.max_quality(), self._termcount)

    def block_quality(self):
        return self._sqr(self.child.block_quality(), self._termcount)

    def score(self):
        child = self.child

        score = child.score()
        matching = 0
        for _ in child.matching_terms(child.id()):
            matching += 1

        return self._sqr(score, matching)
