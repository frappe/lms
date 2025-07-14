# Copyright 2011 Matt Chaput. All rights reserved.
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

from whoosh.util.text import rcompile


# Tagger objects

class Tagger(object):
    """Base class for taggers, objects which match syntax in the query string
    and translate it into a :class:`whoosh.qparser.syntax.SyntaxNode` object.
    """

    def match(self, parser, text, pos):
        """This method should see if this tagger matches the query string at
        the given position. If it matches, it should return

        :param parser: the :class:`whoosh.qparser.default.QueryParser` object.
        :param text: the text being parsed.
        :param pos: the position in the text at which the tagger should try to
            match.
        """

        raise NotImplementedError


class RegexTagger(Tagger):
    """Tagger class that uses regular expressions to match the query string.
    Subclasses should override ``create()`` instead of ``match()``.
    """

    def __init__(self, expr):
        self.expr = rcompile(expr)

    def match(self, parser, text, pos):
        match = self.expr.match(text, pos)
        if match:
            node = self.create(parser, match)
            if node is not None:
                node = node.set_range(match.start(), match.end())
                return node

    def create(self, parser, match):
        """When the regular expression matches, this method is called to
        translate the regex match object into a syntax node.

        :param parser: the :class:`whoosh.qparser.default.QueryParser` object.
        :param match: the regex match object.
        """

        raise NotImplementedError


class FnTagger(RegexTagger):
    """Tagger that takes a regular expression and a class or function, and for
    matches calls the class/function with the regex match's named groups as
    keyword arguments.
    """

    def __init__(self, expr, fn, memo=""):
        RegexTagger.__init__(self, expr)
        self.fn = fn
        self.memo = memo

    def __repr__(self):
        return "<%s %r (%s)>" % (self.__class__.__name__, self.expr, self.memo)

    def create(self, parser, match):
        return self.fn(**match.groupdict())
