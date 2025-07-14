# Copyright 2008 Matt Chaput. All rights reserved.
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

"""The highlight module contains classes and functions for displaying short
excerpts from hit documents in the search results you present to the user, with
query terms highlighted.

The highlighting system has four main elements.

* **Fragmenters** chop up the original text into __fragments__, based on the
  locations of matched terms in the text.

* **Scorers** assign a score to each fragment, allowing the system to rank the
  best fragments by whatever criterion.

* **Order functions** control in what order the top-scoring fragments are
  presented to the user. For example, you can show the fragments in the order
  they appear in the document (FIRST) or show higher-scoring fragments first
  (SCORE)

* **Formatters** turn the fragment objects into human-readable output, such as
  an HTML string.

See :doc:`/highlight` for more information.
"""

from __future__ import division
from collections import deque
from heapq import nlargest
from itertools import groupby

from whoosh.compat import htmlescape
from whoosh.analysis import Token


# The default value for the maximum chars to examine when fragmenting
DEFAULT_CHARLIMIT = 2 ** 15


# Fragment object

def mkfrag(text, tokens, startchar=None, endchar=None,
           charsbefore=0, charsafter=0):
    """Returns a :class:`Fragment` object based on the :class:`analysis.Token`
    objects in ``tokens`.
    """

    if startchar is None:
        startchar = tokens[0].startchar if tokens else 0
    if endchar is None:
        endchar = tokens[-1].endchar if tokens else len(text)

    startchar = max(0, startchar - charsbefore)
    endchar = min(len(text), endchar + charsafter)

    return Fragment(text, tokens, startchar, endchar)


class Fragment(object):
    """Represents a fragment (extract) from a hit document. This object is
    mainly used to keep track of the start and end points of the fragment and
    the "matched" character ranges inside; it does not contain the text of the
    fragment or do much else.

    The useful attributes are:

    ``Fragment.text``
        The entire original text from which this fragment is taken.

    ``Fragment.matches``
        An ordered list of objects representing the matched terms in the
        fragment. These objects have ``startchar`` and ``endchar`` attributes.

    ``Fragment.startchar``
        The index of the first character in the fragment.

    ``Fragment.endchar``
        The index of the last character in the fragment.

    ``Fragment.matched_terms``
        A ``set`` of the ``text`` of the matched terms in the fragment (if
        available).
    """

    def __init__(self, text, matches, startchar=0, endchar= -1):
        """
        :param text: the source text of the fragment.
        :param matches: a list of objects which have ``startchar`` and
            ``endchar`` attributes, and optionally a ``text`` attribute.
        :param startchar: the index into ``text`` at which the fragment starts.
            The default is 0.
        :param endchar: the index into ``text`` at which the fragment ends.
            The default is -1, which is interpreted as the length of ``text``.
        """

        self.text = text
        self.matches = matches

        if endchar == -1:
            endchar = len(text)
        self.startchar = startchar
        self.endchar = endchar

        self.matched_terms = set()
        for t in matches:
            if hasattr(t, "text"):
                self.matched_terms.add(t.text)

    def __repr__(self):
        return "<Fragment %d:%d %d>" % (self.startchar, self.endchar,
                                        len(self.matches))

    def __len__(self):
        return self.endchar - self.startchar

    def overlaps(self, fragment):
        sc = self.startchar
        ec = self.endchar
        fsc = fragment.startchar
        fec = fragment.endchar
        return (sc < fsc < ec) or (sc < fec < ec)

    def overlapped_length(self, fragment):
        sc = self.startchar
        ec = self.endchar
        fsc = fragment.startchar
        fec = fragment.endchar
        return max(ec, fec) - min(sc, fsc)

    def __lt__(self, other):
        return id(self) < id(other)


# Tokenizing

def set_matched_filter(tokens, termset):
    for t in tokens:
        t.matched = t.text in termset
        yield t


# Fragmenters

class Fragmenter(object):
    def must_retokenize(self):
        """Returns True if this fragmenter requires retokenized text.

        If this method returns True, the fragmenter's ``fragment_tokens``
        method  will be called with an iterator of ALL tokens from the text,
        with the tokens for matched terms having the ``matched`` attribute set
        to True.

        If this method returns False, the fragmenter's ``fragment_matches``
        method will be called with a LIST of matching tokens.
        """

        return True

    def fragment_tokens(self, text, all_tokens):
        """Yields :class:`Fragment` objects based on the tokenized text.

        :param text: the string being highlighted.
        :param all_tokens: an iterator of :class:`analysis.Token`
            objects from the string.
        """

        raise NotImplementedError

    def fragment_matches(self, text, matched_tokens):
        """Yields :class:`Fragment` objects based on the text and the matched
        terms.

        :param text: the string being highlighted.
        :param matched_tokens: a list of :class:`analysis.Token` objects
            representing the term matches in the string.
        """

        raise NotImplementedError


class WholeFragmenter(Fragmenter):
    """Doesn't fragment the token stream. This object just returns the entire
    entire stream as one "fragment". This is useful if you want to highlight
    the entire text.

    Note that even if you use the `WholeFragmenter`, the highlight code will
    return no fragment if no terms matched in the given field. To return the
    whole fragment even in that case, call `highlights()` with `minscore=0`::

        # Query where no terms match in the "text" field
        q = query.Term("tag", "new")

        r = mysearcher.search(q)
        r.fragmenter = highlight.WholeFragmenter()
        r.formatter = highlight.UppercaseFormatter()
        # Since no terms in the "text" field matched, we get no fragments back
        assert r[0].highlights("text") == ""

        # If we lower the minimum score to 0, we get a fragment even though it
        # has no matching terms
        assert r[0].highlights("text", minscore=0) == "This is the text field."

    """

    def __init__(self, charlimit=DEFAULT_CHARLIMIT):
        self.charlimit = charlimit

    def fragment_tokens(self, text, tokens):
        charlimit = self.charlimit
        matches = []
        for t in tokens:
            if charlimit and t.endchar > charlimit:
                break
            if t.matched:
                matches.append(t.copy())
        return [Fragment(text, matches)]


# Backwards compatiblity
NullFragmeter = WholeFragmenter


class SentenceFragmenter(Fragmenter):
    """Breaks the text up on sentence end punctuation characters
    (".", "!", or "?"). This object works by looking in the original text for a
    sentence end as the next character after each token's 'endchar'.

    When highlighting with this fragmenter, you should use an analyzer that
    does NOT remove stop words, for example::

        sa = StandardAnalyzer(stoplist=None)
    """

    def __init__(self, maxchars=200, sentencechars=".!?",
                 charlimit=DEFAULT_CHARLIMIT):
        """
        :param maxchars: The maximum number of characters allowed in a
            fragment.
        """

        self.maxchars = maxchars
        self.sentencechars = frozenset(sentencechars)
        self.charlimit = charlimit

    def fragment_tokens(self, text, tokens):
        maxchars = self.maxchars
        sentencechars = self.sentencechars
        charlimit = self.charlimit

        textlen = len(text)
        # startchar of first token in the current sentence
        first = None
        # Buffer for matched tokens in the current sentence
        tks = []
        endchar = None
        # Number of chars in the current sentence
        currentlen = 0

        for t in tokens:
            startchar = t.startchar
            endchar = t.endchar
            if charlimit and endchar > charlimit:
                break

            if first is None:
                # Remember the startchar of the first token in a sentence
                first = startchar
                currentlen = 0

            tlength = endchar - startchar
            currentlen += tlength

            if t.matched:
                tks.append(t.copy())

            # If the character after the current token is end-of-sentence
            # punctuation, finish the sentence and reset
            if endchar < textlen and text[endchar] in sentencechars:
                # Don't break for two periods in a row (e.g. ignore "...")
                if endchar + 1 < textlen and text[endchar + 1] in sentencechars:
                    continue

                # If the sentence had matches and it's not too long, yield it
                # as a token
                if tks and currentlen <= maxchars:
                    yield mkfrag(text, tks, startchar=first, endchar=endchar)
                # Reset the counts
                tks = []
                first = None
                currentlen = 0

        # If we get to the end of the text and there's still a sentence
        # in the buffer, yield it
        if tks:
            yield mkfrag(text, tks, startchar=first, endchar=endchar)


class ContextFragmenter(Fragmenter):
    """Looks for matched terms and aggregates them with their surrounding
    context.
    """

    def __init__(self, maxchars=200, surround=20, charlimit=DEFAULT_CHARLIMIT):
        """
        :param maxchars: The maximum number of characters allowed in a
            fragment.
        :param surround: The number of extra characters of context to add both
            before the first matched term and after the last matched term.
        """

        self.maxchars = maxchars
        self.surround = surround
        self.charlimit = charlimit

    def fragment_tokens(self, text, tokens):
        maxchars = self.maxchars
        surround = self.surround
        charlimit = self.charlimit

        # startchar of the first token in the fragment
        first = None
        # Stack of startchars
        firsts = deque()
        # Each time we see a matched token, we reset the countdown to finishing
        # the fragment. This also indicates whether we're currently inside a
        # fragment (< 0 not in fragment, >= 0 in fragment)
        countdown = -1
        # Tokens in current fragment
        tks = []
        endchar = None
        # Number of chars in the current fragment
        currentlen = 0

        for t in tokens:
            startchar = t.startchar
            endchar = t.endchar
            tlength = endchar - startchar
            if charlimit and endchar > charlimit:
                break

            if countdown < 0 and not t.matched:
                # We're not in a fragment currently, so just maintain the
                # "charsbefore" buffer
                firsts.append(startchar)
                while firsts and endchar - firsts[0] > surround:
                    firsts.popleft()
            elif currentlen + tlength > maxchars:
                # We're in a fragment, but adding this token would put us past
                # the maximum size. Zero the countdown so the code below will
                # cause the fragment to be emitted
                countdown = 0
            elif t.matched:
                # Start/restart the countdown
                countdown = surround
                # Remember the first char of this fragment
                if first is None:
                    if firsts:
                        first = firsts[0]
                    else:
                        first = startchar
                        # Add on unused front context
                        countdown += surround
                tks.append(t.copy())

            # If we're in a fragment...
            if countdown >= 0:
                # Update the counts
                currentlen += tlength
                countdown -= tlength

                # If the countdown is expired
                if countdown <= 0:
                    # Finish the fragment
                    yield mkfrag(text, tks, startchar=first, endchar=endchar)
                    # Reset the counts
                    tks = []
                    firsts = deque()
                    first = None
                    currentlen = 0

        # If there's a fragment left over at the end, yield it
        if tks:
            yield mkfrag(text, tks, startchar=first, endchar=endchar)


class PinpointFragmenter(Fragmenter):
    """This is a NON-RETOKENIZING fragmenter. It builds fragments from the
    positions of the matched terms.
    """

    def __init__(self, maxchars=200, surround=20, autotrim=False,
                 charlimit=DEFAULT_CHARLIMIT):
        """
        :param maxchars: The maximum number of characters allowed in a
            fragment.
        :param surround: The number of extra characters of context to add both
            before the first matched term and after the last matched term.
        :param autotrim: automatically trims text before the first space and
            after the last space in the fragments, to try to avoid truncated
            words at the start and end. For short fragments or fragments with
            long runs between spaces this may give strange results.
        """

        self.maxchars = maxchars
        self.surround = surround
        self.autotrim = autotrim
        self.charlimit = charlimit

    def must_retokenize(self):
        return False

    def fragment_tokens(self, text, tokens):
        matched = [t for t in tokens if t.matched]
        return self.fragment_matches(text, matched)

    @staticmethod
    def _autotrim(fragment):
        text = fragment.text
        startchar = fragment.startchar
        endchar = fragment.endchar

        firstspace = text.find(" ", startchar, endchar)
        if firstspace > 0:
            startchar = firstspace + 1
        lastspace = text.rfind(" ", startchar, endchar)
        if lastspace > 0:
            endchar = lastspace

        if fragment.matches:
            startchar = min(startchar, fragment.matches[0].startchar)
            endchar = max(endchar, fragment.matches[-1].endchar)

        fragment.startchar = startchar
        fragment.endchar = endchar

    def fragment_matches(self, text, tokens):
        maxchars = self.maxchars
        surround = self.surround
        autotrim = self.autotrim
        charlimit = self.charlimit

        j = -1

        for i, t in enumerate(tokens):
            if j >= i:
                continue
            j = i
            left = t.startchar
            right = t.endchar
            if charlimit and right > charlimit:
                break

            currentlen = right - left
            while j < len(tokens) - 1 and currentlen < maxchars:
                next = tokens[j + 1]
                ec = next.endchar
                if ec - right <= surround and ec - left <= maxchars:
                    j += 1
                    right = ec
                    currentlen += (ec - next.startchar)
                else:
                    break

            left = max(0, left - surround)
            right = min(len(text), right + surround)
            fragment = Fragment(text, tokens[i:j + 1], left, right)
            if autotrim:
                self._autotrim(fragment)
            yield fragment


# Fragment scorers

class FragmentScorer(object):
    pass


class BasicFragmentScorer(FragmentScorer):
    def __call__(self, f):
        # Add up the boosts for the matched terms in this passage
        score = sum(t.boost for t in f.matches)

        # Favor diversity: multiply score by the number of separate
        # terms matched
        score *= (len(f.matched_terms) * 100) or 1

        return score


# Fragment sorters

def SCORE(fragment):
    "Sorts higher scored passages first."
    return 1


def FIRST(fragment):
    "Sorts passages from earlier in the document first."
    return fragment.startchar


def LONGER(fragment):
    "Sorts longer passages first."
    return 0 - len(fragment)


def SHORTER(fragment):
    "Sort shorter passages first."
    return len(fragment)


# Formatters

def get_text(original, token, replace):
    """Convenience function for getting the text to use for a match when
    formatting.

    If ``replace`` is False, returns the part of ``original`` between
    ``token.startchar`` and ``token.endchar``. If ``replace`` is True, returns
    ``token.text``.
    """

    if replace:
        return token.text
    else:
        return original[token.startchar:token.endchar]


class Formatter(object):
    """Base class for formatters.

    For highlighters that return strings, it is usually only necessary to
    override :meth:`Formatter.format_token`.

    Use the :func:`get_text` function as a convenience to get the token text::

        class MyFormatter(Formatter):
            def format_token(text, token, replace=False):
                ttext = get_text(text, token, replace)
                return "[%s]" % ttext
    """

    between = "..."

    def _text(self, text):
        return text

    def format_token(self, text, token, replace=False):
        """Returns a formatted version of the given "token" object, which
        should have at least ``startchar`` and ``endchar`` attributes, and
        a ``text`` attribute if ``replace`` is True.

        :param text: the original fragment text being highlighted.
        :param token: an object having ``startchar`` and ``endchar`` attributes
            and optionally a ``text`` attribute (if ``replace`` is True).
        :param replace: if True, the original text between the token's
            ``startchar`` and ``endchar`` indices will be replaced with the
            value of the token's ``text`` attribute.
        """

        raise NotImplementedError

    def format_fragment(self, fragment, replace=False):
        """Returns a formatted version of the given text, using the "token"
        objects in the given :class:`Fragment`.

        :param fragment: a :class:`Fragment` object representing a list of
            matches in the text.
        :param replace: if True, the original text corresponding to each
            match will be replaced with the value of the token object's
            ``text`` attribute.
        """

        output = []
        index = fragment.startchar
        text = fragment.text

        for t in fragment.matches:
            if t.startchar is None:
                continue
            if t.startchar < index:
                continue
            if t.startchar > index:
                output.append(self._text(text[index:t.startchar]))
            output.append(self.format_token(text, t, replace))
            index = t.endchar
        output.append(self._text(text[index:fragment.endchar]))

        out_string = "".join(output)
        return out_string

    def format(self, fragments, replace=False):
        """Returns a formatted version of the given text, using a list of
        :class:`Fragment` objects.
        """

        formatted = [self.format_fragment(f, replace=replace)
                     for f in fragments]
        return self.between.join(formatted)

    def __call__(self, text, fragments):
        # For backwards compatibility
        return self.format(fragments)


class NullFormatter(Formatter):
    """Formatter that does not modify the string.
    """

    def format_token(self, text, token, replace=False):
        return get_text(text, token, replace)


class UppercaseFormatter(Formatter):
    """Returns a string in which the matched terms are in UPPERCASE.
    """

    def __init__(self, between="..."):
        """
        :param between: the text to add between fragments.
        """

        self.between = between

    def format_token(self, text, token, replace=False):
        ttxt = get_text(text, token, replace)
        return ttxt.upper()


class HtmlFormatter(Formatter):
    """Returns a string containing HTML formatting around the matched terms.

    This formatter wraps matched terms in an HTML element with two class names.
    The first class name (set with the constructor argument ``classname``) is
    the same for each match. The second class name (set with the constructor
    argument ``termclass`` is different depending on which term matched. This
    allows you to give different formatting (for example, different background
    colors) to the different terms in the excerpt.

    >>> hf = HtmlFormatter(tagname="span", classname="match", termclass="term")
    >>> hf(mytext, myfragments)
    "The <span class="match term0">template</span> <span class="match term1">geometry</span> is..."

    This object maintains a dictionary mapping terms to HTML class names (e.g.
    ``term0`` and ``term1`` above), so that multiple excerpts will use the same
    class for the same term. If you want to re-use the same HtmlFormatter
    object with different searches, you should call HtmlFormatter.clear()
    between searches to clear the mapping.
    """

    template = '<%(tag)s class=%(q)s%(cls)s%(tn)s%(q)s>%(t)s</%(tag)s>'

    def __init__(self, tagname="strong", between="...",
                 classname="match", termclass="term", maxclasses=5,
                 attrquote='"'):
        """
        :param tagname: the tag to wrap around matching terms.
        :param between: the text to add between fragments.
        :param classname: the class name to add to the elements wrapped around
            matching terms.
        :param termclass: the class name prefix for the second class which is
            different for each matched term.
        :param maxclasses: the maximum number of term classes to produce. This
            limits the number of classes you have to define in CSS by recycling
            term class names. For example, if you set maxclasses to 3 and have
            5 terms, the 5 terms will use the CSS classes ``term0``, ``term1``,
            ``term2``, ``term0``, ``term1``.
        """

        self.between = between
        self.tagname = tagname
        self.classname = classname
        self.termclass = termclass
        self.attrquote = attrquote
        self.maxclasses = maxclasses
        self.seen = {}
        self.htmlclass = " ".join((self.classname, self.termclass))

    def _text(self, text):
        return htmlescape(text, quote=False)

    def format_token(self, text, token, replace=False):
        seen = self.seen
        ttext = self._text(get_text(text, token, replace))
        if ttext in seen:
            termnum = seen[ttext]
        else:
            termnum = len(seen) % self.maxclasses
            seen[ttext] = termnum

        return self.template % {"tag": self.tagname, "q": self.attrquote,
                                "cls": self.htmlclass, "t": ttext,
                                "tn": termnum}

    def clean(self):
        """Clears the dictionary mapping terms to HTML classnames.
        """
        self.seen = {}


class GenshiFormatter(Formatter):
    """Returns a Genshi event stream containing HTML formatting around the
    matched terms.
    """

    def __init__(self, qname="strong", between="..."):
        """
        :param qname: the QName for the tag to wrap around matched terms.
        :param between: the text to add between fragments.
        """

        self.qname = qname
        self.between = between

        from genshi.core import START, END, TEXT  # @UnresolvedImport
        from genshi.core import Attrs, Stream  # @UnresolvedImport
        self.START, self.END, self.TEXT = START, END, TEXT
        self.Attrs, self.Stream = Attrs, Stream

    def _add_text(self, text, output):
        if output and output[-1][0] == self.TEXT:
            output[-1] = (self.TEXT, output[-1][1] + text, output[-1][2])
        else:
            output.append((self.TEXT, text, (None, -1, -1)))

    def format_token(self, text, token, replace=False):
        qn = self.qname
        txt = get_text(text, token, replace)
        return self.Stream([(self.START, (qn, self.Attrs()), (None, -1, -1)),
                            (self.TEXT, txt, (None, -1, -1)),
                            (self.END, qn, (None, -1, -1))])

    def format_fragment(self, fragment, replace=False):
        output = []
        index = fragment.startchar
        text = fragment.text

        for t in fragment.matches:
            if t.startchar > index:
                self._add_text(text[index:t.startchar], output)
            output.append((text, t, replace))
            index = t.endchar
        if index < len(text):
            self._add_text(text[index:], output)
        return self.Stream(output)

    def format(self, fragments, replace=False):
        output = []
        first = True
        for fragment in fragments:
            if not first:
                self._add_text(self.between, output)
            output += self.format_fragment(fragment, replace=replace)
            first = False
        return self.Stream(output)


# Highlighting

def top_fragments(fragments, count, scorer, order, minscore=1):
    scored_fragments = ((scorer(f), f) for f in fragments)
    scored_fragments = nlargest(count, scored_fragments)
    best_fragments = [sf for score, sf in scored_fragments if score >= minscore]
    best_fragments.sort(key=order)
    return best_fragments


def highlight(text, terms, analyzer, fragmenter, formatter, top=3,
              scorer=None, minscore=1, order=FIRST, mode="query"):

    if scorer is None:
        scorer = BasicFragmentScorer()

    if type(fragmenter) is type:
        fragmenter = fragmenter()
    if type(formatter) is type:
        formatter = formatter()
    if type(scorer) is type:
        scorer = scorer()

    if scorer is None:
        scorer = BasicFragmentScorer()

    termset = frozenset(terms)
    tokens = analyzer(text, chars=True, mode=mode, removestops=False)
    tokens = set_matched_filter(tokens, termset)
    fragments = fragmenter.fragment_tokens(text, tokens)
    fragments = top_fragments(fragments, top, scorer, order, minscore)
    return formatter(text, fragments)


class Highlighter(object):
    def __init__(self, fragmenter=None, scorer=None, formatter=None,
                 always_retokenize=False, order=FIRST):
        self.fragmenter = fragmenter or ContextFragmenter()
        self.scorer = scorer or BasicFragmentScorer()
        self.formatter = formatter or HtmlFormatter(tagname="b")
        self.order = order
        self.always_retokenize = always_retokenize

    def can_load_chars(self, results, fieldname):
        # Is it possible to build a mapping between the matched terms/docs and
        # their start and end chars for "pinpoint" highlighting (ie not require
        # re-tokenizing text)?

        if self.always_retokenize:
            # No, we've been configured to always retokenize some text
            return False
        if not results.has_matched_terms():
            # No, we don't know what the matched terms are yet
            return False
        if self.fragmenter.must_retokenize():
            # No, the configured fragmenter doesn't support it
            return False

        # Maybe, if the field was configured to store characters
        field = results.searcher.schema[fieldname]
        return field.supports("characters")

    @staticmethod
    def _load_chars(results, fieldname, texts, to_bytes):
        # For each docnum, create a mapping of text -> [(startchar, endchar)]
        # for the matched terms

        results._char_cache[fieldname] = cache = {}
        sorted_ids = sorted(docnum for _, docnum in results.top_n)

        for docnum in sorted_ids:
            cache[docnum] = {}

        for text in texts:
            btext = to_bytes(text)
            m = results.searcher.postings(fieldname, btext)
            docset = set(results.termdocs[(fieldname, btext)])
            for docnum in sorted_ids:
                if docnum in docset:
                    m.skip_to(docnum)
                    assert m.id() == docnum
                    cache[docnum][text] = m.value_as("characters")

    @staticmethod
    def _merge_matched_tokens(tokens):
        # Merges consecutive matched tokens together, so they are highlighted
        # as one

        token = None

        for t in tokens:
            if not t.matched:
                if token is not None:
                    yield token
                    token = None
                yield t
                continue

            if token is None:
                token = t.copy()
            elif t.startchar <= token.endchar:
                if t.endchar > token.endchar:
                    token.text += t.text[token.endchar-t.endchar:]
                    token.endchar = t.endchar
            else:
                yield token
                token = None
                # t was not merged, also has to be yielded
                yield t

        if token is not None:
            yield token

    def highlight_hit(self, hitobj, fieldname, text=None, top=3, minscore=1):
        results = hitobj.results
        schema = results.searcher.schema
        field = schema[fieldname]
        to_bytes = field.to_bytes
        from_bytes = field.from_bytes

        if text is None:
            if fieldname not in hitobj:
                raise KeyError("Field %r is not stored." % fieldname)
            text = hitobj[fieldname]

        # Get the terms searched for/matched in this field
        if results.has_matched_terms():
            bterms = (term for term in results.matched_terms()
                      if term[0] == fieldname)
        else:
            bterms = results.query_terms(expand=True, fieldname=fieldname)
        # Convert bytes to unicode
        words = frozenset(from_bytes(term[1]) for term in bterms)

        # If we can do "pinpoint" highlighting...
        if self.can_load_chars(results, fieldname):
            # Build the docnum->[(startchar, endchar),] map
            if fieldname not in results._char_cache:
                self._load_chars(results, fieldname, words, to_bytes)

            hitterms = (from_bytes(term[1]) for term in hitobj.matched_terms()
                        if term[0] == fieldname)

            # Grab the word->[(startchar, endchar)] map for this docnum
            cmap = results._char_cache[fieldname][hitobj.docnum]
            # A list of Token objects for matched words
            tokens = []
            charlimit = self.fragmenter.charlimit
            for word in hitterms:
                chars = cmap[word]
                for pos, startchar, endchar in chars:
                    if charlimit and endchar > charlimit:
                        break
                    tokens.append(Token(text=word, pos=pos,
                                        startchar=startchar, endchar=endchar))
            tokens.sort(key=lambda t: t.startchar)
            tokens = [max(group, key=lambda t: t.endchar - t.startchar)
                      for key, group in groupby(tokens, lambda t: t.startchar)]
            fragments = self.fragmenter.fragment_matches(text, tokens)
        else:
            # Retokenize the text
            analyzer = results.searcher.schema[fieldname].analyzer
            tokens = analyzer(text, positions=True, chars=True, mode="index",
                              removestops=False)
            # Set Token.matched attribute for tokens that match a query term
            tokens = set_matched_filter(tokens, words)
            tokens = self._merge_matched_tokens(tokens)
            fragments = self.fragmenter.fragment_tokens(text, tokens)

        fragments = top_fragments(fragments, top, self.scorer, self.order,
                                  minscore=minscore)
        output = self.formatter.format(fragments)
        return output
