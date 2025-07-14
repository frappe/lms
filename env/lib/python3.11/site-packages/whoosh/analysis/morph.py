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

from whoosh.analysis.filters import Filter
from whoosh.compat import integer_types
from whoosh.lang.dmetaphone import double_metaphone
from whoosh.lang.porter import stem
from whoosh.util.cache import lfu_cache, unbound_cache


class StemFilter(Filter):
    """Stems (removes suffixes from) the text of tokens using the Porter
    stemming algorithm. Stemming attempts to reduce multiple forms of the same
    root word (for example, "rendering", "renders", "rendered", etc.) to a
    single word in the index.

    >>> stemmer = RegexTokenizer() | StemFilter()
    >>> [token.text for token in stemmer("fundamentally willows")]
    ["fundament", "willow"]

    You can pass your own stemming function to the StemFilter. The default
    is the Porter stemming algorithm for English.

    >>> stemfilter = StemFilter(stem_function)

    You can also use one of the Snowball stemming functions by passing the
    `lang` keyword argument.

    >>> stemfilter = StemFilter(lang="ru")

    The list of available languages is in `whoosh.lang.languages`.
    You can use :func:`whoosh.lang.has_stemmer` to check if a given language has
    a stemming function available.

    By default, this class wraps an LRU cache around the stemming function. The
    ``cachesize`` keyword argument sets the size of the cache. To make the
    cache unbounded (the class caches every input), use ``cachesize=-1``. To
    disable caching, use ``cachesize=None``.

    If you compile and install the py-stemmer library, the
    :class:`PyStemmerFilter` provides slightly easier access to the language
    stemmers in that library.
    """

    __inittypes__ = dict(stemfn=object, ignore=list)

    is_morph = True

    def __init__(self, stemfn=stem, lang=None, ignore=None, cachesize=50000):
        """
        :param stemfn: the function to use for stemming.
        :param lang: if not None, overrides the stemfn with a language stemmer
            from the ``whoosh.lang.snowball`` package.
        :param ignore: a set/list of words that should not be stemmed. This is
            converted into a frozenset. If you omit this argument, all tokens
            are stemmed.
        :param cachesize: the maximum number of words to cache. Use ``-1`` for
            an unbounded cache, or ``None`` for no caching.
        """

        self.stemfn = stemfn
        self.lang = lang
        self.ignore = frozenset() if ignore is None else frozenset(ignore)
        self.cachesize = cachesize
        # clear() sets the _stem attr to a cached wrapper around self.stemfn
        self.clear()

    def __getstate__(self):
        # Can't pickle a dynamic function, so we have to remove the _stem
        # attribute from the state
        return dict([(k, self.__dict__[k]) for k in self.__dict__
                      if k != "_stem"])

    def __setstate__(self, state):
        # Check for old instances of StemFilter class, which didn't have a
        # cachesize attribute and pickled the cache attribute
        if "cachesize" not in state:
            self.cachesize = 50000
        if "ignores" in state:
            self.ignore = state["ignores"]
        elif "ignore" not in state:
            self.ignore = frozenset()
        if "lang" not in state:
            self.lang = None
        if "cache" in state:
            del state["cache"]

        self.__dict__.update(state)
        # Set the _stem attribute
        self.clear()

    def clear(self):
        if self.lang:
            from whoosh.lang import stemmer_for_language
            stemfn = stemmer_for_language(self.lang)
        else:
            stemfn = self.stemfn

        if isinstance(self.cachesize, integer_types) and self.cachesize != 0:
            if self.cachesize < 0:
                self._stem = unbound_cache(stemfn)
            elif self.cachesize > 1:
                self._stem = lfu_cache(self.cachesize)(stemfn)
        else:
            self._stem = stemfn

    def cache_info(self):
        if self.cachesize <= 1:
            return None
        return self._stem.cache_info()

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.stemfn == other.stemfn)

    def __call__(self, tokens):
        stemfn = self._stem
        ignore = self.ignore

        for t in tokens:
            if not t.stopped:
                text = t.text
                if text not in ignore:
                    t.text = stemfn(text)
            yield t


class PyStemmerFilter(StemFilter):
    """This is a simple subclass of StemFilter that works with the py-stemmer
    third-party library. You must have the py-stemmer library installed to use
    this filter.

    >>> PyStemmerFilter("spanish")
    """

    def __init__(self, lang="english", ignore=None, cachesize=10000):
        """
        :param lang: a string identifying the stemming algorithm to use. You
            can get a list of available algorithms by with the
            :meth:`PyStemmerFilter.algorithms` method. The identification
            strings are directly from the py-stemmer library.
        :param ignore: a set/list of words that should not be stemmed. This is
            converted into a frozenset. If you omit this argument, all tokens
            are stemmed.
        :param cachesize: the maximum number of words to cache.
        """

        self.lang = lang
        self.ignore = frozenset() if ignore is None else frozenset(ignore)
        self.cachesize = cachesize
        self._stem = self._get_stemmer_fn()

    def algorithms(self):
        """Returns a list of stemming algorithms provided by the py-stemmer
        library.
        """

        import Stemmer  # @UnresolvedImport

        return Stemmer.algorithms()

    def cache_info(self):
        return None

    def _get_stemmer_fn(self):
        import Stemmer  # @UnresolvedImport

        stemmer = Stemmer.Stemmer(self.lang)
        stemmer.maxCacheSize = self.cachesize
        return stemmer.stemWord

    def __getstate__(self):
        # Can't pickle a dynamic function, so we have to remove the _stem
        # attribute from the state
        return dict([(k, self.__dict__[k]) for k in self.__dict__
                     if k != "_stem"])

    def __setstate__(self, state):
        # Check for old instances of StemFilter class, which didn't have a
        # cachesize attribute and pickled the cache attribute
        if "cachesize" not in state:
            self.cachesize = 10000
        if "ignores" in state:
            self.ignore = state["ignores"]
        elif "ignore" not in state:
            self.ignore = frozenset()
        if "cache" in state:
            del state["cache"]

        self.__dict__.update(state)
        # Set the _stem attribute
        self._stem = self._get_stemmer_fn()


class DoubleMetaphoneFilter(Filter):
    """Transforms the text of the tokens using Lawrence Philips's Double
    Metaphone algorithm. This algorithm attempts to encode words in such a way
    that similar-sounding words reduce to the same code. This may be useful for
    fields containing the names of people and places, and other uses where
    tolerance of spelling differences is desireable.
    """

    is_morph = True

    def __init__(self, primary_boost=1.0, secondary_boost=0.5, combine=False):
        """
        :param primary_boost: the boost to apply to the token containing the
            primary code.
        :param secondary_boost: the boost to apply to the token containing the
            secondary code, if any.
        :param combine: if True, the original unencoded tokens are kept in the
            stream, preceding the encoded tokens.
        """

        self.primary_boost = primary_boost
        self.secondary_boost = secondary_boost
        self.combine = combine

    def __eq__(self, other):
        return (other
                and self.__class__ is other.__class__
                and self.primary_boost == other.primary_boost)

    def __call__(self, tokens):
        primary_boost = self.primary_boost
        secondary_boost = self.secondary_boost
        combine = self.combine

        for t in tokens:
            if combine:
                yield t

            primary, secondary = double_metaphone(t.text)
            b = t.boost
            # Overwrite the token's text and boost and yield it
            if primary:
                t.text = primary
                t.boost = b * primary_boost
                yield t
            if secondary:
                t.text = secondary
                t.boost = b * secondary_boost
                yield t
