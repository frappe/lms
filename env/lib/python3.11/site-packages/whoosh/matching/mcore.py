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

"""
This module contains "matcher" classes. Matchers deal with posting lists. The
most basic matcher, which reads the list of postings for a term, will be
provided by the backend implementation (for example,
:class:`whoosh.filedb.filepostings.FilePostingReader`). The classes in this
module provide additional functionality, such as combining the results of two
matchers, or modifying the results of a matcher.

You do not need to deal with the classes in this module unless you need to
write your own Matcher implementation to provide some new functionality. These
classes are not instantiated by the user. They are usually created by a
:class:`~whoosh.query.Query` object's :meth:`~whoosh.query.Query.matcher()`
method, which returns the appropriate matcher to implement the query (for
example, the :class:`~whoosh.query.Or` query's
:meth:`~whoosh.query.Or.matcher()` method returns a
:py:class:`~whoosh.matching.UnionMatcher` object).

Certain backends support "quality" optimizations. These backends have the
ability to skip ahead if it knows the current block of postings can't
contribute to the top N documents. If the matcher tree and backend support
these optimizations, the matcher's :meth:`Matcher.supports_block_quality()`
method will return ``True``.
"""

import sys
from itertools import repeat

from whoosh.compat import izip, xrange
from whoosh.compat import abstractmethod


# Exceptions

class ReadTooFar(Exception):
    """Raised when :meth:`~whoosh.matching.Matcher.next()` or
    :meth:`~whoosh.matching.Matcher.skip_to()` are called on an inactive
    matcher.
    """


class NoQualityAvailable(Exception):
    """Raised when quality methods are called on a matcher that does not
    support block quality optimizations.
    """


# Classes

class Matcher(object):
    """Base class for all matchers.
    """

    @abstractmethod
    def is_active(self):
        """Returns True if this matcher is still "active", that is, it has not
        yet reached the end of the posting list.
        """

        raise NotImplementedError

    @abstractmethod
    def reset(self):
        """Returns to the start of the posting list.

        Note that reset() may not do what you expect after you call
        :meth:`Matcher.replace()`, since this can mean calling reset() not on
        the original matcher, but on an optimized replacement.
        """

        raise NotImplementedError

    def term(self):
        """Returns a ``("fieldname", "termtext")`` tuple for the term this
        matcher matches, or None if this matcher is not a term matcher.
        """

        return None

    def term_matchers(self):
        """Returns an iterator of term matchers in this tree.
        """

        if self.term() is not None:
            yield self
        else:
            for cm in self.children():
                for m in cm.term_matchers():
                    yield m

    def matching_terms(self, id=None):
        """Returns an iterator of ``("fieldname", "termtext")`` tuples for the
        **currently matching** term matchers in this tree.
        """

        if not self.is_active():
            return

        if id is None:
            id = self.id()
        elif id != self.id():
            return

        t = self.term()
        if t is None:
            for c in self.children():
                for t in c.matching_terms(id):
                    yield t
        else:
            yield t

    def is_leaf(self):
        return not bool(self.children())

    def children(self):
        """Returns an (possibly empty) list of the submatchers of this
        matcher.
        """

        return []

    def replace(self, minquality=0):
        """Returns a possibly-simplified version of this matcher. For example,
        if one of the children of a UnionMatcher is no longer active, calling
        this method on the UnionMatcher will return the other child.
        """

        return self

    @abstractmethod
    def copy(self):
        """Returns a copy of this matcher.
        """

        raise NotImplementedError

    def depth(self):
        """Returns the depth of the tree under this matcher, or 0 if this
        matcher does not have any children.
        """

        return 0

    def supports_block_quality(self):
        """Returns True if this matcher supports the use of ``quality`` and
        ``block_quality``.
        """

        return False

    def max_quality(self):
        """Returns the maximum possible quality measurement for this matcher,
        according to the current weighting algorithm. Raises
        ``NoQualityAvailable`` if the matcher or weighting do not support
        quality measurements.
        """

        raise NoQualityAvailable(self.__class__)

    def block_quality(self):
        """Returns a quality measurement of the current block of postings,
        according to the current weighting algorithm. Raises
        ``NoQualityAvailable`` if the matcher or weighting do not support
        quality measurements.
        """

        raise NoQualityAvailable(self.__class__)

    @abstractmethod
    def id(self):
        """Returns the ID of the current posting.
        """

        raise NotImplementedError

    def all_ids(self):
        """Returns a generator of all IDs in the matcher.

        What this method returns for a matcher that has already read some
        postings (whether it only yields the remaining postings or all postings
        from the beginning) is undefined, so it's best to only use this method
        on fresh matchers.
        """

        i = 0
        m = self
        while m.is_active():
            yield m.id()
            m.next()
            i += 1
            if i == 10:
                m = m.replace()
                i = 0

    def all_items(self):
        """Returns a generator of all (ID, encoded value) pairs in the matcher.

        What this method returns for a matcher that has already read some
        postings (whether it only yields the remaining postings or all postings
        from the beginning) is undefined, so it's best to only use this method
        on fresh matchers.
        """

        i = 0
        m = self
        while self.is_active():
            yield (m.id(), m.value())
            m.next()
            i += 1
            if i == 10:
                m = m.replace()
                i = 0

    def items_as(self, astype):
        """Returns a generator of all (ID, decoded value) pairs in the matcher.

        What this method returns for a matcher that has already read some
        postings (whether it only yields the remaining postings or all postings
        from the beginning) is undefined, so it's best to only use this method
        on fresh matchers.
        """

        while self.is_active():
            yield (self.id(), self.value_as(astype))
            self.next()

    @abstractmethod
    def value(self):
        """Returns the encoded value of the current posting.
        """

        raise NotImplementedError

    @abstractmethod
    def supports(self, astype):
        """Returns True if the field's format supports the named data type,
        for example 'frequency' or 'characters'.
        """

        raise NotImplementedError("supports not implemented in %s"
                                  % self.__class__)

    @abstractmethod
    def value_as(self, astype):
        """Returns the value(s) of the current posting as the given type.
        """

        raise NotImplementedError("value_as not implemented in %s"
                                  % self.__class__)

    def spans(self):
        """Returns a list of :class:`~whoosh.query.spans.Span` objects for the
        matches in this document. Raises an exception if the field being
        searched does not store positions.
        """

        from whoosh.query.spans import Span

        if self.supports("characters"):
            return [Span(pos, startchar=startchar, endchar=endchar)
                    for pos, startchar, endchar in self.value_as("characters")]
        elif self.supports("positions"):
            return [Span(pos) for pos in self.value_as("positions")]
        else:
            raise Exception("Field does not support spans")

    def skip_to(self, id):
        """Moves this matcher to the first posting with an ID equal to or
        greater than the given ID.
        """

        while self.is_active() and self.id() < id:
            self.next()

    def skip_to_quality(self, minquality):
        """Moves this matcher to the next block with greater than the given
        minimum quality value.
        """

        raise NotImplementedError(self.__class__.__name__)

    @abstractmethod
    def next(self):
        """Moves this matcher to the next posting.
        """

        raise NotImplementedError(self.__class__.__name__)

    def weight(self):
        """Returns the weight of the current posting.
        """

        return self.value_as("weight")

    @abstractmethod
    def score(self):
        """Returns the score of the current posting.
        """

        raise NotImplementedError(self.__class__.__name__)

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


# Simple intermediate classes

class ConstantScoreMatcher(Matcher):
    def __init__(self, score=1.0):
        self._score = score

    def supports_block_quality(self):
        return True

    def max_quality(self):
        return self._score

    def block_quality(self):
        return self._score

    def skip_to_quality(self, minquality):
        if minquality >= self._score:
            self.go_inactive()

    def score(self):
        return self._score


# Null matcher

class NullMatcherClass(Matcher):
    """Matcher with no postings which is never active.
    """

    def __call__(self):
        return self

    def __repr__(self):
        return "<NullMatcher>"

    def supports_block_quality(self):
        return True

    def max_quality(self):
        return 0

    def block_quality(self):
        return 0

    def skip_to_quality(self, minquality):
        return 0

    def is_active(self):
        return False

    def reset(self):
        pass

    def all_ids(self):
        return []

    def copy(self):
        return self


# Singleton instance
NullMatcher = NullMatcherClass()


class ListMatcher(Matcher):
    """Synthetic matcher backed by a list of IDs.
    """

    def __init__(self, ids, weights=None, values=None, format=None,
                 scorer=None, position=0, all_weights=None, term=None,
                 terminfo=None):
        """
        :param ids: a list of doc IDs.
        :param weights: a list of weights corresponding to the list of IDs.
            If this argument is not supplied, a list of 1.0 values is used.
        :param values: a list of encoded values corresponding to the list of
            IDs.
        :param format: a :class:`whoosh.formats.Format` object representing the
            format of the field.
        :param scorer: a :class:`whoosh.scoring.BaseScorer` object for scoring
            the postings.
        :param term: a ``("fieldname", "text")`` tuple, or None if this is not
            a term matcher.
        """

        self._ids = ids
        self._weights = weights
        self._all_weights = all_weights
        self._values = values
        self._i = position
        self._format = format
        self._scorer = scorer
        self._term = term
        self._terminfo = terminfo

    def __repr__(self):
        return "<%s>" % self.__class__.__name__

    def is_active(self):
        return self._i < len(self._ids)

    def reset(self):
        self._i = 0

    def skip_to(self, id):
        if not self.is_active():
            raise ReadTooFar
        if id < self.id():
            return

        while self._i < len(self._ids) and self._ids[self._i] < id:
            self._i += 1

    def term(self):
        return self._term

    def copy(self):
        return self.__class__(self._ids, self._weights, self._values,
                              self._format, self._scorer, self._i,
                              self._all_weights)

    def replace(self, minquality=0):
        if not self.is_active():
            return NullMatcher()
        elif minquality and self.max_quality() < minquality:
            return NullMatcher()
        else:
            return self

    def supports_block_quality(self):
        return (self._scorer is not None
                and self._scorer.supports_block_quality())

    def max_quality(self):
        # This matcher treats all postings in the list as one "block", so the
        # block quality is the same as the quality of the entire list
        if self._scorer:
            return self._scorer.block_quality(self)
        else:
            return self.block_max_weight()

    def block_quality(self):
        return self._scorer.block_quality(self)

    def skip_to_quality(self, minquality):
        while self._i < len(self._ids) and self.block_quality() <= minquality:
            self._i += 1
        return 0

    def id(self):
        return self._ids[self._i]

    def all_ids(self):
        return iter(self._ids)

    def all_items(self):
        values = self._values
        if values is None:
            values = repeat('')

        return izip(self._ids, values)

    def value(self):
        if self._values:
            v = self._values[self._i]

            if isinstance(v, list):
                # This object supports "values" that are actually lists of
                # value strings. This is to support combining the results of
                # several different matchers into a single ListMatcher (see the
                # TOO_MANY_CLAUSES functionality of MultiTerm). We combine the
                # values here instead of combining them first and then making
                # the ListMatcher to avoid wasting time combining values if the
                # consumer never asks for them.
                assert len(v) > 0
                if len(v) == 1:
                    v = v[0]
                else:
                    v = self._format.combine(v)
                # Replace the list with the computed value string
                self._values[self._i] = v

            return v
        else:
            return ''

    def value_as(self, astype):
        decoder = self._format.decoder(astype)
        return decoder(self.value())

    def supports(self, astype):
        return self._format.supports(astype)

    def next(self):
        self._i += 1

    def weight(self):
        if self._all_weights:
            return self._all_weights
        elif self._weights:
            return self._weights[self._i]
        else:
            return 1.0

    def block_min_length(self):
        return self._terminfo.min_length()

    def block_max_length(self):
        return self._terminfo.max_length()

    def block_max_weight(self):
        if self._all_weights:
            return self._all_weights
        elif self._weights:
            return max(self._weights)
        elif self._terminfo is not None:
            return self._terminfo.max_weight()
        else:
            return 1.0

    def score(self):
        if self._scorer:
            return self._scorer.score(self)
        else:
            return self.weight()


# Term/vector leaf posting matcher middleware

class LeafMatcher(Matcher):
    # Subclasses need to set
    #   self.scorer -- a Scorer object or None
    #   self.format -- Format object for the posting values

    def __repr__(self):
        return "%s(%r, %s)" % (self.__class__.__name__, self.term(),
                               self.is_active())

    def term(self):
        return self._term

    def items_as(self, astype):
        decoder = self.format.decoder(astype)
        for id, value in self.all_items():
            yield (id, decoder(value))

    def supports(self, astype):
        return self.format.supports(astype)

    def value_as(self, astype):
        decoder = self.format.decoder(astype)
        return decoder(self.value())

    def spans(self):
        from whoosh.query.spans import Span

        if self.supports("characters"):
            return [Span(pos, startchar=startchar, endchar=endchar)
                    for pos, startchar, endchar in self.value_as("characters")]
        elif self.supports("positions"):
            return [Span(pos) for pos in self.value_as("positions")]
        else:
            raise Exception("Field does not support positions (%r)"
                            % self.term())

    def supports_block_quality(self):
        return self.scorer and self.scorer.supports_block_quality()

    def max_quality(self):
        return self.scorer.max_quality()

    def block_quality(self):
        return self.scorer.block_quality(self)

    def score(self):
        return self.scorer.score(self)
