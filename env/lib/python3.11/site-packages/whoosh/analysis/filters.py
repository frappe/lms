# coding=utf-8

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

from itertools import chain

from whoosh.compat import next, xrange
from whoosh.analysis.acore import Composable
from whoosh.util.text import rcompile


# Default list of stop words (words so common it's usually wasteful to index
# them). This list is used by the StopFilter class, which allows you to supply
# an optional list to override this one.

STOP_WORDS = frozenset(('a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can',
                        'for', 'from', 'have', 'if', 'in', 'is', 'it', 'may',
                        'not', 'of', 'on', 'or', 'tbd', 'that', 'the', 'this',
                        'to', 'us', 'we', 'when', 'will', 'with', 'yet',
                        'you', 'your'))


# Simple pattern for filtering URLs, may be useful

url_pattern = rcompile("""
(
    [A-Za-z+]+://          # URL protocol
    \\S+?                  # URL body
    (?=\\s|[.]\\s|$|[.]$)  # Stop at space/end, or a dot followed by space/end
) | (                      # or...
    \w+([:.]?\w+)*         # word characters, with opt. internal colons/dots
)
""", verbose=True)


# Filters

class Filter(Composable):
    """Base class for Filter objects. A Filter subclass must implement a
    filter() method that takes a single argument, which is an iterator of Token
    objects, and yield a series of Token objects in return.

    Filters that do morphological transformation of tokens (e.g. stemming)
    should set their ``is_morph`` attribute to True.
    """

    def __eq__(self, other):
        return (other
                and self.__class__ is other.__class__
                and self.__dict__ == other.__dict__)

    def __ne__(self, other):
        return not self == other

    def __call__(self, tokens):
        raise NotImplementedError


class PassFilter(Filter):
    """An identity filter: passes the tokens through untouched.
    """

    def __call__(self, tokens):
        return tokens


class LoggingFilter(Filter):
    """Prints the contents of every filter that passes through as a debug
    log entry.
    """

    def __init__(self, logger=None):
        """
        :param target: the logger to use. If omitted, the "whoosh.analysis"
            logger is used.
        """

        if logger is None:
            import logging
            logger = logging.getLogger("whoosh.analysis")
        self.logger = logger

    def __call__(self, tokens):
        logger = self.logger
        for t in tokens:
            logger.debug(repr(t))
            yield t


class MultiFilter(Filter):
    """Chooses one of two or more sub-filters based on the 'mode' attribute
    of the token stream.
    """

    default_filter = PassFilter()

    def __init__(self, **kwargs):
        """Use keyword arguments to associate mode attribute values with
        instantiated filters.

        >>> iwf_for_index = IntraWordFilter(mergewords=True, mergenums=False)
        >>> iwf_for_query = IntraWordFilter(mergewords=False, mergenums=False)
        >>> mf = MultiFilter(index=iwf_for_index, query=iwf_for_query)

        This class expects that the value of the mode attribute is consistent
        among all tokens in a token stream.
        """
        self.filters = kwargs

    def __eq__(self, other):
        return (other
                and self.__class__ is other.__class__
                and self.filters == other.filters)

    def __call__(self, tokens):
        # Only selects on the first token
        t = next(tokens)
        filter = self.filters.get(t.mode, self.default_filter)
        return filter(chain([t], tokens))


class TeeFilter(Filter):
    """Interleaves the results of two or more filters (or filter chains).

    NOTE: because it needs to create copies of each token for each sub-filter,
    this filter is quite slow.

    >>> target = "ALFA BRAVO CHARLIE"
    >>> # In one branch, we'll lower-case the tokens
    >>> f1 = LowercaseFilter()
    >>> # In the other branch, we'll reverse the tokens
    >>> f2 = ReverseTextFilter()
    >>> ana = RegexTokenizer(r"\S+") | TeeFilter(f1, f2)
    >>> [token.text for token in ana(target)]
    ["alfa", "AFLA", "bravo", "OVARB", "charlie", "EILRAHC"]

    To combine the incoming token stream with the output of a filter chain, use
    ``TeeFilter`` and make one of the filters a :class:`PassFilter`.

    >>> f1 = PassFilter()
    >>> f2 = BiWordFilter()
    >>> ana = RegexTokenizer(r"\S+") | TeeFilter(f1, f2) | LowercaseFilter()
    >>> [token.text for token in ana(target)]
    ["alfa", "alfa-bravo", "bravo", "bravo-charlie", "charlie"]
    """

    def __init__(self, *filters):
        if len(filters) < 2:
            raise Exception("TeeFilter requires two or more filters")
        self.filters = filters

    def __eq__(self, other):
        return (self.__class__ is other.__class__
                and self.filters == other.fitlers)

    def __call__(self, tokens):
        from itertools import tee

        count = len(self.filters)
        # Tee the token iterator and wrap each teed iterator with the
        # corresponding filter
        gens = [filter(t.copy() for t in gen) for filter, gen
                in zip(self.filters, tee(tokens, count))]
        # Keep a count of the number of running iterators
        running = count
        while running:
            for i, gen in enumerate(gens):
                if gen is not None:
                    try:
                        yield next(gen)
                    except StopIteration:
                        gens[i] = None
                        running -= 1


class ReverseTextFilter(Filter):
    """Reverses the text of each token.

    >>> ana = RegexTokenizer() | ReverseTextFilter()
    >>> [token.text for token in ana("hello there")]
    ["olleh", "ereht"]
    """

    def __call__(self, tokens):
        for t in tokens:
            t.text = t.text[::-1]
            yield t


class LowercaseFilter(Filter):
    """Uses unicode.lower() to lowercase token text.

    >>> rext = RegexTokenizer()
    >>> stream = rext("This is a TEST")
    >>> [token.text for token in LowercaseFilter(stream)]
    ["this", "is", "a", "test"]
    """

    def __call__(self, tokens):
        for t in tokens:
            t.text = t.text.lower()
            yield t


class StripFilter(Filter):
    """Calls unicode.strip() on the token text.
    """

    def __call__(self, tokens):
        for t in tokens:
            t.text = t.text.strip()
            yield t


class StopFilter(Filter):
    """Marks "stop" words (words too common to index) in the stream (and by
    default removes them).

    Make sure you precede this filter with a :class:`LowercaseFilter`.

    >>> stopper = RegexTokenizer() | StopFilter()
    >>> [token.text for token in stopper(u"this is a test")]
    ["test"]
    >>> es_stopper = RegexTokenizer() | StopFilter(lang="es")
    >>> [token.text for token in es_stopper(u"el lapiz es en la mesa")]
    ["lapiz", "mesa"]

    The list of available languages is in `whoosh.lang.languages`.
    You can use :func:`whoosh.lang.has_stopwords` to check if a given language
    has a stop word list available.
    """

    def __init__(self, stoplist=STOP_WORDS, minsize=2, maxsize=None,
                 renumber=True, lang=None):
        """
        :param stoplist: A collection of words to remove from the stream.
            This is converted to a frozenset. The default is a list of
            common English stop words.
        :param minsize: The minimum length of token texts. Tokens with
            text smaller than this will be stopped. The default is 2.
        :param maxsize: The maximum length of token texts. Tokens with text
            larger than this will be stopped. Use None to allow any length.
        :param renumber: Change the 'pos' attribute of unstopped tokens
            to reflect their position with the stopped words removed.
        :param lang: Automatically get a list of stop words for the given
            language
        """

        stops = set()
        if stoplist:
            stops.update(stoplist)
        if lang:
            from whoosh.lang import stopwords_for_language

            stops.update(stopwords_for_language(lang))

        self.stops = frozenset(stops)
        self.min = minsize
        self.max = maxsize
        self.renumber = renumber

    def __eq__(self, other):
        return (other
                and self.__class__ is other.__class__
                and self.stops == other.stops
                and self.min == other.min
                and self.renumber == other.renumber)

    def __call__(self, tokens):
        stoplist = self.stops
        minsize = self.min
        maxsize = self.max
        renumber = self.renumber

        pos = None
        for t in tokens:
            text = t.text
            if (len(text) >= minsize
                and (maxsize is None or len(text) <= maxsize)
                and text not in stoplist):
                # This is not a stop word
                if renumber and t.positions:
                    if pos is None:
                        pos = t.pos
                    else:
                        pos += 1
                        t.pos = pos
                t.stopped = False
                yield t
            else:
                # This is a stop word
                if not t.removestops:
                    # This IS a stop word, but we're not removing them
                    t.stopped = True
                    yield t


class CharsetFilter(Filter):
    """Translates the text of tokens by calling unicode.translate() using the
    supplied character mapping object. This is useful for case and accent
    folding.

    The ``whoosh.support.charset`` module has a useful map for accent folding.

    >>> from whoosh.support.charset import accent_map
    >>> retokenizer = RegexTokenizer()
    >>> chfilter = CharsetFilter(accent_map)
    >>> [t.text for t in chfilter(retokenizer(u'café'))]
    [u'cafe']

    Another way to get a character mapping object is to convert a Sphinx
    charset table file using
    :func:`whoosh.support.charset.charset_table_to_dict`.

    >>> from whoosh.support.charset import charset_table_to_dict
    >>> from whoosh.support.charset import default_charset
    >>> retokenizer = RegexTokenizer()
    >>> charmap = charset_table_to_dict(default_charset)
    >>> chfilter = CharsetFilter(charmap)
    >>> [t.text for t in chfilter(retokenizer(u'Stra\\xdfe'))]
    [u'strase']

    The Sphinx charset table format is described at
    http://www.sphinxsearch.com/docs/current.html#conf-charset-table.
    """

    __inittypes__ = dict(charmap=dict)

    def __init__(self, charmap):
        """
        :param charmap: a dictionary mapping from integer character numbers to
            unicode characters, as required by the unicode.translate() method.
        """

        self.charmap = charmap

    def __eq__(self, other):
        return (other
                and self.__class__ is other.__class__
                and self.charmap == other.charmap)

    def __call__(self, tokens):
        assert hasattr(tokens, "__iter__")
        charmap = self.charmap
        for t in tokens:
            t.text = t.text.translate(charmap)
            yield t


class DelimitedAttributeFilter(Filter):
    """Looks for delimiter characters in the text of each token and stores the
    data after the delimiter in a named attribute on the token.

    The defaults are set up to use the ``^`` character as a delimiter and store
    the value after the ``^`` as the boost for the token.

    >>> daf = DelimitedAttributeFilter(delimiter="^", attribute="boost")
    >>> ana = RegexTokenizer("\\\\S+") | DelimitedAttributeFilter()
    >>> for t in ana(u("image render^2 file^0.5"))
    ...    print("%r %f" % (t.text, t.boost))
    'image' 1.0
    'render' 2.0
    'file' 0.5

    Note that you need to make sure your tokenizer includes the delimiter and
    data as part of the token!
    """

    def __init__(self, delimiter="^", attribute="boost", default=1.0,
                 type=float):
        """
        :param delimiter: a string that, when present in a token's text,
            separates the actual text from the "data" payload.
        :param attribute: the name of the attribute in which to store the
            data on the token.
        :param default: the value to use for the attribute for tokens that
            don't have delimited data.
        :param type: the type of the data, for example ``str`` or ``float``.
            This is used to convert the string value of the data before
            storing it in the attribute.
        """

        self.delim = delimiter
        self.attr = attribute
        self.default = default
        self.type = type

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.delim == other.delim
                and self.attr == other.attr
                and self.default == other.default)

    def __call__(self, tokens):
        delim = self.delim
        attr = self.attr
        default = self.default
        type_ = self.type

        for t in tokens:
            text = t.text
            pos = text.find(delim)
            if pos > -1:
                setattr(t, attr, type_(text[pos + 1:]))
                if t.chars:
                    t.endchar -= len(t.text) - pos
                t.text = text[:pos]
            else:
                setattr(t, attr, default)

            yield t


class SubstitutionFilter(Filter):
    """Performs a regular expression substitution on the token text.

    This is especially useful for removing text from tokens, for example
    hyphens::

        ana = RegexTokenizer(r"\\S+") | SubstitutionFilter("-", "")

    Because it has the full power of the re.sub() method behind it, this filter
    can perform some fairly complex transformations. For example, to take
    tokens like ``'a=b', 'c=d', 'e=f'`` and change them to ``'b=a', 'd=c',
    'f=e'``::

        # Analyzer that swaps the text on either side of an equal sign
        rt = RegexTokenizer(r"\\S+")
        sf = SubstitutionFilter("([^/]*)/(./*)", r"\\2/\\1")
        ana = rt | sf
    """

    def __init__(self, pattern, replacement):
        """
        :param pattern: a pattern string or compiled regular expression object
            describing the text to replace.
        :param replacement: the substitution text.
        """

        self.pattern = rcompile(pattern)
        self.replacement = replacement

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.pattern == other.pattern
                and self.replacement == other.replacement)

    def __call__(self, tokens):
        pattern = self.pattern
        replacement = self.replacement

        for t in tokens:
            t.text = pattern.sub(replacement, t.text)
            yield t
