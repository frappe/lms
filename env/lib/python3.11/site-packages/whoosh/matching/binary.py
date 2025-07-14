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

from whoosh.matching import mcore


class BiMatcher(mcore.Matcher):
    """Base class for matchers that combine the results of two sub-matchers in
    some way.
    """

    def __init__(self, a, b):
        super(BiMatcher, self).__init__()
        self.a = a
        self.b = b

    def reset(self):
        self.a.reset()
        self.b.reset()

    def __repr__(self):
        return "%s(%r, %r)" % (self.__class__.__name__, self.a, self.b)

    def children(self):
        return [self.a, self.b]

    def copy(self):
        return self.__class__(self.a.copy(), self.b.copy())

    def depth(self):
        return 1 + max(self.a.depth(), self.b.depth())

    def skip_to(self, id):
        if not self.is_active():
            raise mcore.ReadTooFar
        ra = self.a.skip_to(id)
        rb = self.b.skip_to(id)
        return ra or rb

    def supports_block_quality(self):
        return (self.a.supports_block_quality()
                and self.b.supports_block_quality())

    def supports(self, astype):
        return self.a.supports(astype) and self.b.supports(astype)


class AdditiveBiMatcher(BiMatcher):
    """Base class for binary matchers where the scores of the sub-matchers are
    added together.
    """

    def max_quality(self):
        q = 0.0
        if self.a.is_active():
            q += self.a.max_quality()
        if self.b.is_active():
            q += self.b.max_quality()
        return q

    def block_quality(self):
        bq = 0.0
        if self.a.is_active():
            bq += self.a.block_quality()
        if self.b.is_active():
            bq += self.b.block_quality()
        return bq

    def weight(self):
        return (self.a.weight() + self.b.weight())

    def score(self):
        return (self.a.score() + self.b.score())

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


class UnionMatcher(AdditiveBiMatcher):
    """Matches the union (OR) of the postings in the two sub-matchers.
    """

    _id = None

    def replace(self, minquality=0):
        a = self.a
        b = self.b
        a_active = a.is_active()
        b_active = b.is_active()

        # If neither sub-matcher on its own has a high enough max quality to
        # contribute, convert to an intersection matcher
        if minquality and a_active and b_active:
            a_max = a.max_quality()
            b_max = b.max_quality()
            if a_max < minquality and b_max < minquality:
                return IntersectionMatcher(a, b).replace(minquality)
            elif a_max < minquality:
                return AndMaybeMatcher(b, a)
            elif b_max < minquality:
                return AndMaybeMatcher(a, b)

        # If one or both of the sub-matchers are inactive, convert
        if not (a_active or b_active):
            return mcore.NullMatcher()
        elif not a_active:
            return b.replace(minquality)
        elif not b_active:
            return a.replace(minquality)

        a = a.replace(minquality - b.max_quality() if minquality else 0)
        b = b.replace(minquality - a.max_quality() if minquality else 0)
        # If one of the sub-matchers changed, return a new union
        if a is not self.a or b is not self.b:
            return self.__class__(a, b)
        else:
            self._id = None
            return self

    def is_active(self):
        return self.a.is_active() or self.b.is_active()

    def skip_to(self, id):
        self._id = None
        ra = rb = False

        if self.a.is_active():
            ra = self.a.skip_to(id)
        if self.b.is_active():
            rb = self.b.skip_to(id)

        return ra or rb

    def id(self):
        _id = self._id
        if _id is not None:
            return _id

        a = self.a
        b = self.b
        if not a.is_active():
            _id = b.id()
        elif not b.is_active():
            _id = a.id()
        else:
            _id = min(a.id(), b.id())
        self._id = _id
        return _id

    # Using sets is faster in most cases, but could potentially use a lot of
    # memory. Comment out this method override to not use sets.
    #def all_ids(self):
    #    return iter(sorted(set(self.a.all_ids()) | set(self.b.all_ids())))

    def next(self):
        self._id = None

        a = self.a
        b = self.b
        a_active = a.is_active()
        b_active = b.is_active()

        # Shortcut when one matcher is inactive
        if not (a_active or b_active):
            raise mcore.ReadTooFar
        elif not a_active:
            return b.next()
        elif not b_active:
            return a.next()

        a_id = a.id()
        b_id = b.id()
        ar = br = None

        # After all that, here's the actual implementation
        if a_id <= b_id:
            ar = a.next()
        if b_id <= a_id:
            br = b.next()
        return ar or br

    def spans(self):
        if not self.a.is_active():
            return self.b.spans()
        if not self.b.is_active():
            return self.a.spans()

        id_a = self.a.id()
        id_b = self.b.id()
        if id_a < id_b:
            return self.a.spans()
        elif id_b < id_a:
            return self.b.spans()
        else:
            return sorted(set(self.a.spans()) | set(self.b.spans()))

    def weight(self):
        a = self.a
        b = self.b

        if not a.is_active():
            return b.weight()
        if not b.is_active():
            return a.weight()

        id_a = a.id()
        id_b = b.id()
        if id_a < id_b:
            return a.weight()
        elif id_b < id_a:
            return b.weight()
        else:
            return (a.weight() + b.weight())

    def score(self):
        a = self.a
        b = self.b

        if not a.is_active():
            return b.score()
        if not b.is_active():
            return a.score()

        id_a = a.id()
        id_b = b.id()
        if id_a < id_b:
            return a.score()
        elif id_b < id_a:
            return b.score()
        else:
            return (a.score() + b.score())

    def skip_to_quality(self, minquality):
        self._id = None

        a = self.a
        b = self.b
        if not (a.is_active() or b.is_active()):
            raise mcore.ReadTooFar

        # Short circuit if one matcher is inactive
        if not a.is_active():
            return b.skip_to_quality(minquality)
        elif not b.is_active():
            return a.skip_to_quality(minquality)

        skipped = 0
        aq = a.block_quality()
        bq = b.block_quality()
        while a.is_active() and b.is_active() and aq + bq <= minquality:
            if aq < bq:
                skipped += a.skip_to_quality(minquality - bq)
                aq = a.block_quality()
            else:
                skipped += b.skip_to_quality(minquality - aq)
                bq = b.block_quality()

        return skipped


class DisjunctionMaxMatcher(UnionMatcher):
    """Matches the union (OR) of two sub-matchers. Where both sub-matchers
    match the same posting, returns the weight/score of the higher-scoring
    posting.
    """

    # TODO: this class inherits from AdditiveBiMatcher (through UnionMatcher)
    # but it does not add the scores of the sub-matchers together (it
    # overrides all methods that perform addition). Need to clean up the
    # inheritance.

    def __init__(self, a, b, tiebreak=0.0):
        super(DisjunctionMaxMatcher, self).__init__(a, b)
        self.tiebreak = tiebreak

    def copy(self):
        return self.__class__(self.a.copy(), self.b.copy(),
                              tiebreak=self.tiebreak)

    def replace(self, minquality=0):
        a = self.a
        b = self.b
        a_active = a.is_active()
        b_active = b.is_active()

        # DisMax takes the max of the sub-matcher qualities instead of adding
        # them, so we need special logic here
        if minquality and a_active and b_active:
            a_max = a.max_quality()
            b_max = b.max_quality()

            if a_max < minquality and b_max < minquality:
                # If neither sub-matcher has a high enough max quality to
                # contribute, return an inactive matcher
                return mcore.NullMatcher()
            elif b_max < minquality:
                # If the b matcher can't contribute, return a
                return a.replace(minquality)
            elif a_max < minquality:
                # If the a matcher can't contribute, return b
                return b.replace(minquality)

        if not (a_active or b_active):
            return mcore.NullMatcher()
        elif not a_active:
            return b.replace(minquality)
        elif not b_active:
            return a.replace(minquality)

        # We CAN pass the minquality down here, since we don't add the two
        # scores together
        a = a.replace(minquality)
        b = b.replace(minquality)
        a_active = a.is_active()
        b_active = b.is_active()
        # It's kind of tedious to check for inactive sub-matchers all over
        # again here after we replace them, but it's probably better than
        # returning a replacement with an inactive sub-matcher
        if not (a_active and b_active):
            return mcore.NullMatcher()
        elif not a_active:
            return b
        elif not b_active:
            return a
        elif a is not self.a or b is not self.b:
            # If one of the sub-matchers changed, return a new DisMax
            return self.__class__(a, b)
        else:
            return self

    def score(self):
        if not self.a.is_active():
            return self.b.score()
        elif not self.b.is_active():
            return self.a.score()
        else:
            return max(self.a.score(), self.b.score())

    def max_quality(self):
        return max(self.a.max_quality(), self.b.max_quality())

    def block_quality(self):
        return max(self.a.block_quality(), self.b.block_quality())

    def skip_to_quality(self, minquality):
        a = self.a
        b = self.b

        # Short circuit if one matcher is inactive
        if not a.is_active():
            sk = b.skip_to_quality(minquality)
            return sk
        elif not b.is_active():
            return a.skip_to_quality(minquality)

        skipped = 0
        aq = a.block_quality()
        bq = b.block_quality()
        while a.is_active() and b.is_active() and max(aq, bq) <= minquality:
            if aq <= minquality:
                skipped += a.skip_to_quality(minquality)
                aq = a.block_quality()
            if bq <= minquality:
                skipped += b.skip_to_quality(minquality)
                bq = b.block_quality()
        return skipped


class IntersectionMatcher(AdditiveBiMatcher):
    """Matches the intersection (AND) of the postings in the two sub-matchers.
    """

    def __init__(self, a, b):
        super(IntersectionMatcher, self).__init__(a, b)
        self._find_first()

    def reset(self):
        self.a.reset()
        self.b.reset()
        self._find_first()

    def _find_first(self):
        if (self.a.is_active()
            and self.b.is_active()
            and self.a.id() != self.b.id()):
            self._find_next()

    def replace(self, minquality=0):
        a = self.a
        b = self.b
        a_active = a.is_active()
        b_active = b.is_active()

        if not (a_active and b_active):
            # Intersection matcher requires that both sub-matchers be active
            return mcore.NullMatcher()

        if minquality:
            a_max = a.max_quality()
            b_max = b.max_quality()
            if a_max + b_max < minquality:
                # If the combined quality of the sub-matchers can't contribute,
                # return an inactive matcher
                return mcore.NullMatcher()
            # Require that the replacements be able to contribute results
            # higher than the minquality
            a_min = minquality - b_max
            b_min = minquality - a_max
        else:
            a_min = b_min = 0

        a = a.replace(a_min)
        b = b.replace(b_min)
        a_active = a.is_active()
        b_active = b.is_active()
        if not (a_active or b_active):
            return mcore.NullMatcher()
        elif not a_active:
            return b
        elif not b_active:
            return a
        elif a is not self.a or b is not self.b:
            return self.__class__(a, b)
        else:
            return self

    def is_active(self):
        return self.a.is_active() and self.b.is_active()

    def _find_next(self):
        a = self.a
        b = self.b
        a_id = a.id()
        b_id = b.id()
        assert a_id != b_id
        r = False

        while a.is_active() and b.is_active() and a_id != b_id:
            if a_id < b_id:
                ra = a.skip_to(b_id)
                if not a.is_active():
                    return
                r = r or ra
                a_id = a.id()
            else:
                rb = b.skip_to(a_id)
                if not b.is_active():
                    return
                r = r or rb
                b_id = b.id()
        return r

    def id(self):
        return self.a.id()

    # Using sets is faster in some cases, but could potentially use a lot of
    # memory
    def all_ids(self):
        return iter(sorted(set(self.a.all_ids()) & set(self.b.all_ids())))

    def skip_to(self, id):
        if not self.is_active():
            raise mcore.ReadTooFar
        ra = self.a.skip_to(id)
        rb = self.b.skip_to(id)
        if self.is_active():
            rn = False
            if self.a.id() != self.b.id():
                rn = self._find_next()
            return ra or rb or rn

    def skip_to_quality(self, minquality):
        a = self.a
        b = self.b
        minquality = minquality

        skipped = 0
        aq = a.block_quality()
        bq = b.block_quality()
        while a.is_active() and b.is_active() and aq + bq <= minquality:
            if aq < bq:
                # If the block quality of A is less than B, skip A ahead until
                # it can contribute at least the balance of the required min
                # quality when added to B
                sk = a.skip_to_quality(minquality - bq)
                skipped += sk
                if not sk and a.is_active():
                    # The matcher couldn't skip ahead for some reason, so just
                    # advance and try again
                    a.next()
            else:
                # And vice-versa
                sk = b.skip_to_quality(minquality - aq)
                skipped += sk
                if not sk and b.is_active():
                    b.next()

            if not a.is_active() or not b.is_active():
                # One of the matchers is exhausted
                break
            if a.id() != b.id():
                # We want to always leave in a state where the matchers are at
                # the same document, so call _find_next() to sync them
                self._find_next()

            # Get the block qualities at the new matcher positions
            aq = a.block_quality()
            bq = b.block_quality()
        return skipped

    def next(self):
        if not self.is_active():
            raise mcore.ReadTooFar

        # We must assume that the ids are equal whenever next() is called (they
        # should have been made equal by _find_next), so advance them both
        ar = self.a.next()
        if self.is_active():
            nr = self._find_next()
            return ar or nr

    def spans(self):
        return sorted(set(self.a.spans()) | set(self.b.spans()))


class AndNotMatcher(BiMatcher):
    """Matches the postings in the first sub-matcher that are NOT present in
    the second sub-matcher.
    """

    def __init__(self, a, b):
        super(AndNotMatcher, self).__init__(a, b)
        self._find_first()

    def reset(self):
        self.a.reset()
        self.b.reset()
        self._find_first()

    def _find_first(self):
        if (self.a.is_active()
            and self.b.is_active()
            and self.a.id() == self.b.id()):
            self._find_next()

    def is_active(self):
        return self.a.is_active()

    def _find_next(self):
        pos = self.a
        neg = self.b
        if not neg.is_active():
            return
        pos_id = pos.id()
        r = False

        if neg.id() < pos_id:
            neg.skip_to(pos_id)

        while pos.is_active() and neg.is_active() and pos_id == neg.id():
            nr = pos.next()
            if not pos.is_active():
                break

            r = r or nr
            pos_id = pos.id()
            neg.skip_to(pos_id)

        return r

    def supports_block_quality(self):
        return self.a.supports_block_quality()

    def replace(self, minquality=0):
        if not self.a.is_active():
            # The a matcher is required, so if it's inactive, return an
            # inactive matcher
            return mcore.NullMatcher()
        elif (minquality
              and self.a.max_quality() < minquality):
            # If the quality of the required matcher isn't high enough to
            # contribute, return an inactive matcher
            return mcore.NullMatcher()
        elif not self.b.is_active():
            # If the prohibited matcher is inactive, convert to just the
            # required matcher
            return self.a.replace(minquality)

        a = self.a.replace(minquality)
        b = self.b.replace()
        if a is not self.a or b is not self.b:
            # If one of the sub-matchers was replaced, return a new AndNot
            return self.__class__(a, b)
        else:
            return self

    def max_quality(self):
        return self.a.max_quality()

    def block_quality(self):
        return self.a.block_quality()

    def skip_to_quality(self, minquality):
        skipped = self.a.skip_to_quality(minquality)
        self._find_next()
        return skipped

    def id(self):
        return self.a.id()

    def next(self):
        if not self.a.is_active():
            raise mcore.ReadTooFar
        ar = self.a.next()
        nr = False
        if self.a.is_active() and self.b.is_active():
            nr = self._find_next()
        return ar or nr

    def skip_to(self, id):
        if not self.a.is_active():
            raise mcore.ReadTooFar
        if id < self.a.id():
            return

        self.a.skip_to(id)
        if self.b.is_active():
            self.b.skip_to(id)
            self._find_next()

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


class AndMaybeMatcher(AdditiveBiMatcher):
    """Matches postings in the first sub-matcher, and if the same posting is
    in the second sub-matcher, adds their scores.
    """

    def __init__(self, a, b):
        AdditiveBiMatcher.__init__(self, a, b)
        self._first_b()

    def reset(self):
        self.a.reset()
        self.b.reset()
        self._first_b()

    def _first_b(self):
        a = self.a
        b = self.b
        if a.is_active() and b.is_active() and a.id() != b.id():
            b.skip_to(a.id())

    def is_active(self):
        return self.a.is_active()

    def id(self):
        return self.a.id()

    def next(self):
        if not self.a.is_active():
            raise mcore.ReadTooFar

        ar = self.a.next()
        br = False
        if self.a.is_active() and self.b.is_active():
            br = self.b.skip_to(self.a.id())
        return ar or br

    def skip_to(self, id):
        if not self.a.is_active():
            raise mcore.ReadTooFar

        ra = self.a.skip_to(id)
        rb = False
        if self.a.is_active() and self.b.is_active():
            rb = self.b.skip_to(id)
        return ra or rb

    def replace(self, minquality=0):
        a = self.a
        b = self.b
        a_active = a.is_active()
        b_active = b.is_active()

        if not a_active:
            return mcore.NullMatcher()
        elif minquality and b_active:
            if a.max_quality() + b.max_quality() < minquality:
                # If the combined max quality of the sub-matchers isn't high
                # enough to possibly contribute, return an inactive matcher
                return mcore.NullMatcher()
            elif a.max_quality() < minquality:
                # If the max quality of the main sub-matcher isn't high enough
                # to ever contribute without the optional sub- matcher, change
                # into an IntersectionMatcher
                return IntersectionMatcher(self.a, self.b)
        elif not b_active:
            return a.replace(minquality)

        new_a = a.replace(minquality - b.max_quality())
        new_b = b.replace(minquality - a.max_quality())
        if new_a is not a or new_b is not b:
            # If one of the sub-matchers changed, return a new AndMaybe
            return self.__class__(new_a, new_b)
        else:
            return self

    def skip_to_quality(self, minquality):
        a = self.a
        b = self.b
        minquality = minquality

        if not a.is_active():
            raise mcore.ReadTooFar
        if not b.is_active():
            return a.skip_to_quality(minquality)

        skipped = 0
        aq = a.block_quality()
        bq = b.block_quality()
        while a.is_active() and b.is_active() and aq + bq <= minquality:
            if aq < bq:
                skipped += a.skip_to_quality(minquality - bq)
                aq = a.block_quality()
            else:
                skipped += b.skip_to_quality(minquality - aq)
                bq = b.block_quality()

        return skipped

    def weight(self):
        if self.a.id() == self.b.id():
            return self.a.weight() + self.b.weight()
        else:
            return self.a.weight()

    def score(self):
        if self.b.is_active() and self.a.id() == self.b.id():
            return self.a.score() + self.b.score()
        else:
            return self.a.score()

    def supports(self, astype):
        return self.a.supports(astype)

    def value(self):
        return self.a.value()

    def value_as(self, astype):
        return self.a.value_as(astype)
