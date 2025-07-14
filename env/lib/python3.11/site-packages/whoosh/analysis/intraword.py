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

import re
from collections import deque

from whoosh.compat import u, text_type
from whoosh.compat import xrange
from whoosh.analysis.filters import Filter


class CompoundWordFilter(Filter):
    """Given a set of words (or any object with a ``__contains__`` method),
    break any tokens in the stream that are composites of words in the word set
    into their individual parts.

    Given the correct set of words, this filter can break apart run-together
    words and trademarks (e.g. "turbosquid", "applescript"). It can also be
    useful for agglutinative languages such as German.

    The ``keep_compound`` argument lets you decide whether to keep the
    compound word in the token stream along with the word segments.

    >>> cwf = CompoundWordFilter(wordset, keep_compound=True)
    >>> analyzer = RegexTokenizer(r"\S+") | cwf
    >>> [t.text for t in analyzer("I do not like greeneggs and ham")
    ["I", "do", "not", "like", "greeneggs", "green", "eggs", "and", "ham"]
    >>> cwf.keep_compound = False
    >>> [t.text for t in analyzer("I do not like greeneggs and ham")
    ["I", "do", "not", "like", "green", "eggs", "and", "ham"]
    """

    def __init__(self, wordset, keep_compound=True):
        """
        :param wordset: an object with a ``__contains__`` method, such as a
            set, containing strings to look for inside the tokens.
        :param keep_compound: if True (the default), the original compound
            token will be retained in the stream before the subwords.
        """

        self.wordset = wordset
        self.keep_compound = keep_compound

    def subwords(self, s, memo):
        if s in self.wordset:
            return [s]
        if s in memo:
            return memo[s]

        for i in xrange(1, len(s)):
            prefix = s[:i]
            if prefix in self.wordset:
                suffix = s[i:]
                suffix_subs = self.subwords(suffix, memo)
                if suffix_subs:
                    result = [prefix] + suffix_subs
                    memo[s] = result
                    return result

        return None

    def __call__(self, tokens):
        keep_compound = self.keep_compound
        memo = {}
        subwords = self.subwords
        for t in tokens:
            subs = subwords(t.text, memo)
            if subs:
                if len(subs) > 1 and keep_compound:
                    yield t
                for subword in subs:
                    t.text = subword
                    yield t
            else:
                yield t


class BiWordFilter(Filter):
    """Merges adjacent tokens into "bi-word" tokens, so that for example::

        "the", "sign", "of", "four"

    becomes::

        "the-sign", "sign-of", "of-four"

    This can be used to create fields for pseudo-phrase searching, where if
    all the terms match the document probably contains the phrase, but the
    searching is faster than actually doing a phrase search on individual word
    terms.

    The ``BiWordFilter`` is much faster than using the otherwise equivalent
    ``ShingleFilter(2)``.
    """

    def __init__(self, sep="-"):
        self.sep = sep

    def __call__(self, tokens):
        sep = self.sep
        prev_text = None
        prev_startchar = None
        prev_pos = None
        atleastone = False

        for token in tokens:
            # Save the original text of this token
            text = token.text

            # Save the original position
            positions = token.positions
            if positions:
                ps = token.pos

            # Save the original start char
            chars = token.chars
            if chars:
                sc = token.startchar

            if prev_text is not None:
                # Use the pos and startchar from the previous token
                if positions:
                    token.pos = prev_pos
                if chars:
                    token.startchar = prev_startchar

                # Join the previous token text and the current token text to
                # form the biword token
                token.text = "".join((prev_text, sep, text))
                yield token
                atleastone = True

            # Save the originals and the new "previous" values
            prev_text = text
            if chars:
                prev_startchar = sc
            if positions:
                prev_pos = ps

        # If no bi-words were emitted, that is, the token stream only had
        # a single token, then emit that single token.
        if not atleastone:
            yield token


class ShingleFilter(Filter):
    """Merges a certain number of adjacent tokens into multi-word tokens, so
    that for example::

        "better", "a", "witty", "fool", "than", "a", "foolish", "wit"

    with ``ShingleFilter(3, ' ')`` becomes::

        'better a witty', 'a witty fool', 'witty fool than', 'fool than a',
        'than a foolish', 'a foolish wit'

    This can be used to create fields for pseudo-phrase searching, where if
    all the terms match the document probably contains the phrase, but the
    searching is faster than actually doing a phrase search on individual word
    terms.

    If you're using two-word shingles, you should use the functionally
    equivalent ``BiWordFilter`` instead because it's faster than
    ``ShingleFilter``.
    """

    def __init__(self, size=2, sep="-"):
        self.size = size
        self.sep = sep

    def __call__(self, tokens):
        size = self.size
        sep = self.sep
        buf = deque()
        atleastone = False

        def make_token():
            tk = buf[0]
            tk.text = sep.join([t.text for t in buf])
            if tk.chars:
                tk.endchar = buf[-1].endchar
            return tk

        for token in tokens:
            if not token.stopped:
                buf.append(token.copy())
                if len(buf) == size:
                    atleastone = True
                    yield make_token()
                    buf.popleft()

        # If no shingles were emitted, that is, the token stream had fewer than
        # 'size' tokens, then emit a single token with whatever tokens there
        # were
        if not atleastone and buf:
            yield make_token()


class IntraWordFilter(Filter):
    """Splits words into subwords and performs optional transformations on
    subword groups. This filter is funtionally based on yonik's
    WordDelimiterFilter in Solr, but shares no code with it.

    * Split on intra-word delimiters, e.g. `Wi-Fi` -> `Wi`, `Fi`.
    * When splitwords=True, split on case transitions,
      e.g. `PowerShot` -> `Power`, `Shot`.
    * When splitnums=True, split on letter-number transitions,
      e.g. `SD500` -> `SD`, `500`.
    * Leading and trailing delimiter characters are ignored.
    * Trailing possesive "'s" removed from subwords,
      e.g. `O'Neil's` -> `O`, `Neil`.

    The mergewords and mergenums arguments turn on merging of subwords.

    When the merge arguments are false, subwords are not merged.

    * `PowerShot` -> `0`:`Power`, `1`:`Shot` (where `0` and `1` are token
      positions).

    When one or both of the merge arguments are true, consecutive runs of
    alphabetic and/or numeric subwords are merged into an additional token with
    the same position as the last sub-word.

    * `PowerShot` -> `0`:`Power`, `1`:`Shot`, `1`:`PowerShot`
    * `A's+B's&C's` -> `0`:`A`, `1`:`B`, `2`:`C`, `2`:`ABC`
    * `Super-Duper-XL500-42-AutoCoder!` -> `0`:`Super`, `1`:`Duper`, `2`:`XL`,
      `2`:`SuperDuperXL`,
      `3`:`500`, `4`:`42`, `4`:`50042`, `5`:`Auto`, `6`:`Coder`,
      `6`:`AutoCoder`

    When using this filter you should use a tokenizer that only splits on
    whitespace, so the tokenizer does not remove intra-word delimiters before
    this filter can see them, and put this filter before any use of
    LowercaseFilter.

    >>> rt = RegexTokenizer(r"\\S+")
    >>> iwf = IntraWordFilter()
    >>> lcf = LowercaseFilter()
    >>> analyzer = rt | iwf | lcf

    One use for this filter is to help match different written representations
    of a concept. For example, if the source text contained `wi-fi`, you
    probably want `wifi`, `WiFi`, `wi-fi`, etc. to match. One way of doing this
    is to specify mergewords=True and/or mergenums=True in the analyzer used
    for indexing, and mergewords=False / mergenums=False in the analyzer used
    for querying.

    >>> iwf_i = IntraWordFilter(mergewords=True, mergenums=True)
    >>> iwf_q = IntraWordFilter(mergewords=False, mergenums=False)
    >>> iwf = MultiFilter(index=iwf_i, query=iwf_q)
    >>> analyzer = RegexTokenizer(r"\S+") | iwf | LowercaseFilter()

    (See :class:`MultiFilter`.)
    """

    is_morph = True

    __inittypes__ = dict(delims=text_type, splitwords=bool, splitnums=bool,
                         mergewords=bool, mergenums=bool)

    def __init__(self, delims=u("-_'\"()!@#$%^&*[]{}<>\|;:,./?`~=+"),
                 splitwords=True, splitnums=True,
                 mergewords=False, mergenums=False):
        """
        :param delims: a string of delimiter characters.
        :param splitwords: if True, split at case transitions,
            e.g. `PowerShot` -> `Power`, `Shot`
        :param splitnums: if True, split at letter-number transitions,
            e.g. `SD500` -> `SD`, `500`
        :param mergewords: merge consecutive runs of alphabetic subwords into
            an additional token with the same position as the last subword.
        :param mergenums: merge consecutive runs of numeric subwords into an
            additional token with the same position as the last subword.
        """

        from whoosh.support.unicode import digits, lowercase, uppercase

        self.delims = re.escape(delims)

        # Expression for text between delimiter characters
        self.between = re.compile(u("[^%s]+") % (self.delims,), re.UNICODE)
        # Expression for removing "'s" from the end of sub-words
        dispat = u("(?<=[%s%s])'[Ss](?=$|[%s])") % (lowercase, uppercase,
                                                    self.delims)
        self.possessive = re.compile(dispat, re.UNICODE)

        # Expression for finding case and letter-number transitions
        lower2upper = u("[%s][%s]") % (lowercase, uppercase)
        letter2digit = u("[%s%s][%s]") % (lowercase, uppercase, digits)
        digit2letter = u("[%s][%s%s]") % (digits, lowercase, uppercase)
        if splitwords and splitnums:
            splitpat = u("(%s|%s|%s)") % (lower2upper, letter2digit,
                                          digit2letter)
            self.boundary = re.compile(splitpat, re.UNICODE)
        elif splitwords:
            self.boundary = re.compile(text_type(lower2upper), re.UNICODE)
        elif splitnums:
            numpat = u("(%s|%s)") % (letter2digit, digit2letter)
            self.boundary = re.compile(numpat, re.UNICODE)

        self.splitting = splitwords or splitnums
        self.mergewords = mergewords
        self.mergenums = mergenums

    def __eq__(self, other):
        return other and self.__class__ is other.__class__\
        and self.__dict__ == other.__dict__

    def _split(self, string):
        bound = self.boundary

        # Yields (startchar, endchar) pairs for each indexable substring in
        # the given string, e.g. "WikiWord" -> (0, 4), (4, 8)

        # Whether we're splitting on transitions (case changes, letter -> num,
        # num -> letter, etc.)
        splitting = self.splitting

        # Make a list (dispos, for "dispossessed") of (startchar, endchar)
        # pairs for runs of text between "'s"
        if "'" in string:
            # Split on possessive 's
            dispos = []
            prev = 0
            for match in self.possessive.finditer(string):
                dispos.append((prev, match.start()))
                prev = match.end()
            if prev < len(string):
                dispos.append((prev, len(string)))
        else:
            # Shortcut if there's no apostrophe in the string
            dispos = ((0, len(string)),)

        # For each run between 's
        for sc, ec in dispos:
            # Split on boundary characters
            for part_match in self.between.finditer(string, sc, ec):
                part_start = part_match.start()
                part_end = part_match.end()

                if splitting:
                    # The point to start splitting at
                    prev = part_start
                    # Find transitions (e.g. "iW" or "a0")
                    for bmatch in bound.finditer(string, part_start, part_end):
                        # The point in the middle of the transition
                        pivot = bmatch.start() + 1
                        # Yield from the previous match to the transition
                        yield (prev, pivot)
                        # Make the transition the new starting point
                        prev = pivot

                    # If there's leftover text at the end, yield it too
                    if prev < part_end:
                        yield (prev, part_end)
                else:
                    # Not splitting on transitions, just yield the part
                    yield (part_start, part_end)

    def _merge(self, parts):
        mergewords = self.mergewords
        mergenums = self.mergenums

        # Current type (1=alpah, 2=digit)
        last = 0
        # Where to insert a merged term in the original list
        insertat = 0
        # Buffer for parts to merge
        buf = []
        # Iterate on a copy of the parts list so we can modify the original as
        # we go

        def insert_item(buf, at, newpos):
            newtext = "".join(item[0] for item in buf)
            newsc = buf[0][2]  # start char of first item in buffer
            newec = buf[-1][3]  # end char of last item in buffer
            parts.insert(insertat, (newtext, newpos, newsc, newec))

        for item in list(parts):
            # item = (text, pos, startchar, endchar)
            text = item[0]
            pos = item[1]

            # Set the type of this part
            if text.isalpha():
                this = 1
            elif text.isdigit():
                this = 2
            else:
                this = None

            # Is this the same type as the previous part?
            if (buf and (this == last == 1 and mergewords)
                or (this == last == 2 and mergenums)):
                # This part is the same type as the previous. Add it to the
                # buffer of parts to merge.
                buf.append(item)
            else:
                # This part is different than the previous.
                if len(buf) > 1:
                    # If the buffer has at least two parts in it, merge them
                    # and add them to the original list of parts.
                    insert_item(buf, insertat, pos - 1)
                    insertat += 1
                # Reset the buffer
                buf = [item]
                last = this
            insertat += 1

        # If there are parts left in the buffer at the end, merge them and add
        # them to the original list.
        if len(buf) > 1:
            insert_item(buf, len(parts), pos)

    def __call__(self, tokens):
        mergewords = self.mergewords
        mergenums = self.mergenums

        # This filter renumbers tokens as it expands them. New position
        # counter.
        newpos = None
        for t in tokens:
            text = t.text

            # If this is the first token we've seen, use it to set the new
            # position counter
            if newpos is None:
                if t.positions:
                    newpos = t.pos
                else:
                    # Token doesn't have positions, just use 0
                    newpos = 0

            if ((text.isalpha() and (text.islower() or text.isupper()))
                or text.isdigit()):
                # Short-circuit the common cases of no delimiters, no case
                # transitions, only digits, etc.
                t.pos = newpos
                yield t
                newpos += 1
            else:
                # Split the token text on delimiters, word and/or number
                # boundaries into a list of (text, pos, startchar, endchar)
                # tuples
                ranges = self._split(text)
                parts = [(text[sc:ec], i + newpos, sc, ec)
                         for i, (sc, ec) in enumerate(ranges)]

                # Did the split yield more than one part?
                if len(parts) > 1:
                    # If the options are set, merge consecutive runs of all-
                    # letters and/or all-numbers.
                    if mergewords or mergenums:
                        self._merge(parts)

                # Yield tokens for the parts
                chars = t.chars
                if chars:
                    base = t.startchar
                for text, pos, startchar, endchar in parts:
                    t.text = text
                    t.pos = pos
                    if t.chars:
                        t.startchar = base + startchar
                        t.endchar = base + endchar
                    yield t

                if parts:
                    # Set the new position counter based on the last part
                    newpos = parts[-1][1] + 1
