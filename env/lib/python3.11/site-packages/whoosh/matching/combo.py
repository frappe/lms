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
from array import array

from whoosh.compat import xrange
from whoosh.matching import mcore


class CombinationMatcher(mcore.Matcher):
    def __init__(self, submatchers, boost=1.0):
        self._submatchers = submatchers
        self._boost = boost

    def supports_block_quality(self):
        return all(m.supports_block_quality() for m in self._submatchers)

    def max_quality(self):
        return max(m.max_quality() for m in self._submatchers
                   if m.is_active()) * self._boost

    def supports(self, astype):
        return all(m.supports(astype) for m in self._submatchers)

    def children(self):
        return iter(self._submatchers)

    def score(self):
        return sum(m.score() for m in self._submatchers) * self._boost


class PreloadedUnionMatcher(CombinationMatcher):
    """Instead of marching the sub-matchers along in parallel, this
    matcher pre-reads the scores for EVERY MATCHING DOCUMENT, trading memory
    for speed.

    This is faster than the implementation using a binary tree of
    :class:`~whoosh.matching.binary.UnionMatcher` objects (possibly just
    because of less overhead), but it doesn't allow getting information about
    the "current" document other than the score, because there isn't really a
    current document, just an array of scores.
    """

    def __init__(self, submatchers, doccount, boost=1.0, scored=True):
        CombinationMatcher.__init__(self, submatchers, boost=boost)

        self._doccount = doccount

        a = array("d")
        active = [subm for subm in self._submatchers if subm.is_active()]
        if active:
            offset = self._docnum = min(m.id() for m in active)
            for m in active:
                while m.is_active():
                    if scored:
                        score = m.score() * boost
                    else:
                        score = boost

                    docnum = m.id()
                    place = docnum - offset
                    if len(a) <= place:
                        a.extend(0 for _ in xrange(place - len(a) + 1))
                    a[place] += score
                    m.next()
            self._a = a
            self._offset = offset
        else:
            self._docnum = 0
            self._offset = 0
        self._a = a

    def is_active(self):
        return self._docnum - self._offset < len(self._a)

    def id(self):
        return self._docnum

    def score(self):
        return self._a[self._docnum - self._offset]

    def next(self):
        a = self._a
        offset = self._offset
        place = self._docnum - offset

        place += 1
        while place < len(a) and a[place] == 0:
            place += 1
        self._docnum = place + offset

    def max_quality(self):
        return max(self._a[self._docnum - self._offset:])

    def block_quality(self):
        return self.max_quality()

    def skip_to(self, docnum):
        if docnum < self._docnum:
            return

        self._docnum = docnum
        i = docnum - self._offset
        if i < len(self._a) and self._a[i] == 0:
            self.next()

    def skip_to_quality(self, minquality):
        a = self._a
        offset = self._offset
        place = self._docnum - offset

        skipped = 0
        while place < len(a) and a[place] <= minquality:
            place += 1
            skipped = 1

        self._docnum = place + offset
        return skipped

    def supports(self, astype):
        # This matcher doesn't support any posting values
        return False

    def all_ids(self):
        a = self._a
        offset = self._offset
        place = self._docnum - offset

        while place < len(a):
            if a[place] > 0:
                yield place + offset
            place += 1


class ArrayUnionMatcher(CombinationMatcher):
    """Instead of marching the sub-matchers along in parallel, this matcher
    pre-reads the scores for a large block of documents at a time from each
    matcher, accumulating the scores in an array.

    This is faster than the implementation using a binary tree of
    :class:`~whoosh.matching.binary.UnionMatcher` objects (possibly just
    because of less overhead), but it doesn't allow getting information about
    the "current" document other than the score, because there isn't really a
    current document, just an array of scores.
    """

    def __init__(self, submatchers, doccount, boost=1.0, scored=True,
                 partsize=2048):
        CombinationMatcher.__init__(self, submatchers, boost=boost)
        self._scored = scored
        self._doccount = doccount

        if not partsize:
            partsize = doccount
        self._partsize = partsize

        self._a = array("d", (0 for _ in xrange(self._partsize)))
        self._docnum = self._min_id()
        self._read_part()

    def __repr__(self):
        return ("%s(%r, boost=%f, scored=%r, partsize=%d)"
                % (self.__class__.__name__, self._submatchers, self._boost,
                   self._scored, self._partsize))

    def _min_id(self):
        active = [subm for subm in self._submatchers if subm.is_active()]
        if active:
            return min(subm.id() for subm in active)
        else:
            return self._doccount

    def _read_part(self):
        scored = self._scored
        boost = self._boost
        limit = min(self._docnum + self._partsize, self._doccount)
        offset = self._docnum
        a = self._a

        # Clear the array
        for i in xrange(self._partsize):
            a[i] = 0

        # Add the scores from the submatchers into the array
        for m in self._submatchers:
            while m.is_active() and m.id() < limit:
                i = m.id() - offset
                if scored:
                    a[i] += m.score() * boost
                else:
                    a[i] = 1
                m.next()

        self._offset = offset
        self._limit = limit

    def _find_next(self):
        a = self._a
        docnum = self._docnum
        offset = self._offset
        limit = self._limit

        while docnum < limit:
            if a[docnum - offset] > 0:
                break
            docnum += 1

        if docnum == limit:
            self._docnum = self._min_id()
            self._read_part()
        else:
            self._docnum = docnum

    def supports(self, astype):
        # This matcher doesn't support any posting values
        return False

    def is_active(self):
        return self._docnum < self._doccount

    def max_quality(self):
        return max(m.max_quality() for m in self._submatchers)

    def block_quality(self):
        return max(self._a)

    def skip_to(self, docnum):
        if docnum < self._offset:
            # We've already passed it
            return
        elif docnum < self._limit:
            # It's in the current part
            self._docnum = docnum
            self._find_next()
            return

        # Advance all active submatchers
        submatchers = self._submatchers
        active = False
        for subm in submatchers:
            if subm.is_active():
                subm.skip_to(docnum)

        if any(subm.is_active() for subm in submatchers):
            # Rebuffer
            self._docnum = self._min_id()
            self._read_part()
        else:
            self._docnum = self._doccount

    def skip_to_quality(self, minquality):
        skipped = 0
        while self.is_active() and self.block_quality() <= minquality:
            skipped += 1
            self._docnum = self._limit
            self._read_part()
        if self.is_active():
            self._find_next()
        return skipped

    def id(self):
        return self._docnum

    def all_ids(self):
        doccount = self._doccount
        docnum = self._docnum
        offset = self._offset
        limit = self._limit

        a = self._a
        while docnum < doccount:
            if a[docnum - offset] > 0:
                yield docnum

            docnum += 1
            if docnum == limit:
                self._docnum = docnum
                self._read_part()
                offset = self._offset
                limit = self._limit

    def next(self):
        self._docnum += 1
        return self._find_next()

    def score(self):
        return self._a[self._docnum - self._offset]
