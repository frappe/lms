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

from whoosh.compat import iteritems


# Exceptions

class CompositionError(Exception):
    pass


# Utility functions

def unstopped(tokenstream):
    """Removes tokens from a token stream where token.stopped = True.
    """
    return (t for t in tokenstream if not t.stopped)


def entoken(textstream, positions=False, chars=False, start_pos=0,
            start_char=0, **kwargs):
    """Takes a sequence of unicode strings and yields a series of Token objects
    (actually the same Token object over and over, for performance reasons),
    with the attributes filled in with reasonable values (for example, if
    ``positions`` or ``chars`` is True, the function assumes each token was
    separated by one space).
    """

    pos = start_pos
    char = start_char
    t = Token(positions=positions, chars=chars, **kwargs)

    for text in textstream:
        t.text = text

        if positions:
            t.pos = pos
            pos += 1

        if chars:
            t.startchar = char
            char = char + len(text)
            t.endchar = char

        yield t


# Token object

class Token(object):
    """
    Represents a "token" (usually a word) extracted from the source text being
    indexed.

    See "Advanced analysis" in the user guide for more information.

    Because object instantiation in Python is slow, tokenizers should create
    ONE SINGLE Token object and YIELD IT OVER AND OVER, changing the attributes
    each time.

    This trick means that consumers of tokens (i.e. filters) must never try to
    hold onto the token object between loop iterations, or convert the token
    generator into a list. Instead, save the attributes between iterations,
    not the object::

        def RemoveDuplicatesFilter(self, stream):
            # Removes duplicate words.
            lasttext = None
            for token in stream:
                # Only yield the token if its text doesn't
                # match the previous token.
                if lasttext != token.text:
                    yield token
                lasttext = token.text

    ...or, call token.copy() to get a copy of the token object.
    """

    def __init__(self, positions=False, chars=False, removestops=True, mode='',
                 **kwargs):
        """
        :param positions: Whether tokens should have the token position in the
            'pos' attribute.
        :param chars: Whether tokens should have character offsets in the
            'startchar' and 'endchar' attributes.
        :param removestops: whether to remove stop words from the stream (if
            the tokens pass through a stop filter).
        :param mode: contains a string describing the purpose for which the
            analyzer is being called, i.e. 'index' or 'query'.
        """

        self.positions = positions
        self.chars = chars
        self.stopped = False
        self.boost = 1.0
        self.removestops = removestops
        self.mode = mode
        self.__dict__.update(kwargs)

    def __repr__(self):
        parms = ", ".join("%s=%r" % (name, value)
                          for name, value in iteritems(self.__dict__))
        return "%s(%s)" % (self.__class__.__name__, parms)

    def copy(self):
        # This is faster than using the copy module
        return Token(**self.__dict__)


# Composition support

class Composable(object):
    is_morph = False

    def __or__(self, other):
        from whoosh.analysis.analyzers import CompositeAnalyzer

        if not isinstance(other, Composable):
            raise TypeError("%r is not composable with %r" % (self, other))
        return CompositeAnalyzer(self, other)

    def __repr__(self):
        attrs = ""
        if self.__dict__:
            attrs = ", ".join("%s=%r" % (key, value)
                              for key, value
                              in iteritems(self.__dict__))
        return self.__class__.__name__ + "(%s)" % attrs

    def has_morph(self):
        return self.is_morph
