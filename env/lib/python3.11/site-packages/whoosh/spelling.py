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

"""
This module contains helper functions for correcting typos in user queries.
"""

from bisect import bisect_left
from heapq import heappush, heapreplace

from whoosh import highlight
from whoosh.compat import iteritems, xrange


# Corrector objects

class Corrector(object):
    """
    Base class for spelling correction objects. Concrete sub-classes should
    implement the ``_suggestions`` method.
    """

    def suggest(self, text, limit=5, maxdist=2, prefix=0):
        """
        :param text: the text to check. This word will **not** be added to the
            suggestions, even if it appears in the word graph.
        :param limit: only return up to this many suggestions. If there are not
            enough terms in the field within ``maxdist`` of the given word, the
            returned list will be shorter than this number.
        :param maxdist: the largest edit distance from the given word to look
            at. Values higher than 2 are not very effective or efficient.
        :param prefix: require suggestions to share a prefix of this length
            with the given word. This is often justifiable since most
            misspellings do not involve the first letter of the word. Using a
            prefix dramatically decreases the time it takes to generate the
            list of words.
        """

        _suggestions = self._suggestions

        heap = []
        for item in _suggestions(text, maxdist, prefix):
            # Note that the *higher* scores (item[0]) are better!
            if len(heap) < limit:
                heappush(heap, item)
            elif item > heap[0]:
                heapreplace(heap, item)

        sugs = sorted(heap, key=lambda x: (0 - x[0], x[1]))
        return [sug for _, sug in sugs]

    def _suggestions(self, text, maxdist, prefix):
        """
        Low-level method that yields a series of (score, "suggestion")
        tuples.

        :param text: the text to check.
        :param maxdist: the maximum edit distance.
        :param prefix: require suggestions to share a prefix of this length
            with the given word.
        """

        raise NotImplementedError


class ReaderCorrector(Corrector):
    """
    Suggests corrections based on the content of a field in a reader.

    Ranks suggestions by the edit distance, then by highest to lowest
    frequency.
    """

    def __init__(self, reader, fieldname, fieldobj):
        self.reader = reader
        self.fieldname = fieldname
        self.fieldobj = fieldobj

    def _suggestions(self, text, maxdist, prefix):
        reader = self.reader
        freq = reader.frequency

        fieldname = self.fieldname
        fieldobj = reader.schema[fieldname]
        sugfield = fieldobj.spelling_fieldname(fieldname)

        for sug in reader.terms_within(sugfield, text, maxdist, prefix=prefix):
            # Higher scores are better, so negate the distance and frequency
            f = freq(fieldname, sug) or 1
            score = 0 - (maxdist + (1.0 / f * 0.5))
            yield (score, sug)


class ListCorrector(Corrector):
    """
    Suggests corrections based on the content of a sorted list of strings.
    """

    def __init__(self, wordlist):
        self.wordlist = wordlist

    def _suggestions(self, text, maxdist, prefix):
        from whoosh.automata.lev import levenshtein_automaton
        from whoosh.automata.fsa import find_all_matches

        seen = set()
        for i in xrange(1, maxdist + 1):
            dfa = levenshtein_automaton(text, maxdist, prefix).to_dfa()
            sk = self.Skipper(self.wordlist)
            for sug in find_all_matches(dfa, sk):
                if sug not in seen:
                    seen.add(sug)
                    yield (0 - maxdist), sug

    class Skipper(object):
        def __init__(self, data):
            self.data = data
            self.i = 0

        def __call__(self, w):
            if self.data[self.i] == w:
                return w
            self.i += 1
            pos = bisect_left(self.data, w, self.i)
            if pos < len(self.data):
                return self.data[pos]
            else:
                return None


class MultiCorrector(Corrector):
    """
    Merges suggestions from a list of sub-correctors.
    """

    def __init__(self, correctors, op):
        self.correctors = correctors
        self.op = op

    def _suggestions(self, text, maxdist, prefix):
        op = self.op
        seen = {}
        for corr in self.correctors:
            for score, sug in corr._suggestions(text, maxdist, prefix):
                if sug in seen:
                    seen[sug] = op(seen[sug], score)
                else:
                    seen[sug] = score
        return iteritems(seen)


# Query correction

class Correction(object):
    """
    Represents the corrected version of a user query string. Has the
    following attributes:

    ``query``
        The corrected :class:`whoosh.query.Query` object.
    ``string``
        The corrected user query string.
    ``original_query``
        The original :class:`whoosh.query.Query` object that was corrected.
    ``original_string``
        The original user query string.
    ``tokens``
        A list of token objects representing the corrected words.

    You can also use the :meth:`Correction.format_string` method to reformat the
    corrected query string using a :class:`whoosh.highlight.Formatter` class.
    For example, to display the corrected query string as HTML with the
    changed words emphasized::

        from whoosh import highlight

        correction = mysearcher.correct_query(q, qstring)

        hf = highlight.HtmlFormatter(classname="change")
        html = correction.format_string(hf)
    """

    def __init__(self, q, qstring, corr_q, tokens):
        self.original_query = q
        self.query = corr_q
        self.original_string = qstring
        self.tokens = tokens

        if self.original_string:
            self.string = self.format_string(highlight.NullFormatter())
        else:
            self.string = ''

    def __repr__(self):
        return "%s(%r, %r)" % (self.__class__.__name__, self.query,
                               self.string)

    def format_string(self, formatter):
        """
        Highlights the corrected words in the original query string using the
        given :class:`~whoosh.highlight.Formatter`.

        :param formatter: A :class:`whoosh.highlight.Formatter` instance.
        :return: the output of the formatter (usually a string).
        """

        if not self.original_string:
            return ''
        if isinstance(formatter, type):
            formatter = formatter()

        fragment = highlight.Fragment(self.original_string, self.tokens)
        return formatter.format_fragment(fragment, replace=True)


# QueryCorrector objects

class QueryCorrector(object):
    """
    Base class for objects that correct words in a user query.
    """

    def __init__(self, fieldname):
        self.fieldname = fieldname

    def correct_query(self, q, qstring):
        """
        Returns a :class:`Correction` object representing the corrected
        form of the given query.

        :param q: the original :class:`whoosh.query.Query` tree to be
            corrected.
        :param qstring: the original user query. This may be None if the
            original query string is not available, in which case the
            ``Correction.string`` attribute will also be None.
        :rtype: :class:`Correction`
        """

        raise NotImplementedError

    def field(self):
        return self.fieldname


class SimpleQueryCorrector(QueryCorrector):
    """
    A simple query corrector based on a mapping of field names to
    :class:`Corrector` objects, and a list of ``("fieldname", "text")`` tuples
    to correct. And terms in the query that appear in list of term tuples are
    corrected using the appropriate corrector.
    """

    def __init__(self, correctors, terms, aliases=None, prefix=0, maxdist=2):
        """
        :param correctors: a dictionary mapping field names to
            :class:`Corrector` objects.
        :param terms: a sequence of ``("fieldname", "text")`` tuples
            representing terms to be corrected.
        :param aliases: a dictionary mapping field names in the query to
            field names for spelling suggestions.
        :param prefix: suggested replacement words must share this number of
            initial characters with the original word. Increasing this even to
            just ``1`` can dramatically speed up suggestions, and may be
            justifiable since spellling mistakes rarely involve the first
            letter of a word.
        :param maxdist: the maximum number of "edits" (insertions, deletions,
            subsitutions, or transpositions of letters) allowed between the
            original word and any suggestion. Values higher than ``2`` may be
            slow.
        """

        self.correctors = correctors
        self.aliases = aliases or {}
        self.termset = frozenset(terms)
        self.prefix = prefix
        self.maxdist = maxdist

    def correct_query(self, q, qstring):
        correctors = self.correctors
        aliases = self.aliases
        termset = self.termset
        prefix = self.prefix
        maxdist = self.maxdist

        # A list of tokens that were changed by a corrector
        corrected_tokens = []

        # The corrected query tree. We don't need to deepcopy the original
        # because we use Query.replace() to find-and-replace the corrected
        # words and it returns a copy of the query tree.
        corrected_q = q

        # For every word in the original query...
        # Note we can't put these in a set, because we must preserve WHERE
        # in the query each token occured so we can format them later
        for token in q.all_tokens():
            fname = token.fieldname
            aname = aliases.get(fname, fname)

            # If this is one of the words we're supposed to correct...
            if (fname, token.text) in termset:
                c = correctors[aname]
                sugs = c.suggest(token.text, prefix=prefix, maxdist=maxdist)
                if sugs:
                    # This is a "simple" corrector, so we just pick the first
                    # suggestion :/
                    sug = sugs[0]

                    # Return a new copy of the original query with this word
                    # replaced by the correction
                    corrected_q = corrected_q.replace(token.fieldname,
                                                      token.text, sug)
                    # Add the token to the list of corrected tokens (for the
                    # formatter to use later)
                    token.original = token.text
                    token.text = sug
                    corrected_tokens.append(token)

        return Correction(q, qstring, corrected_q, corrected_tokens)
