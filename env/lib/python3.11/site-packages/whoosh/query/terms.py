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

from __future__ import division
import copy
import fnmatch
import re
from collections import defaultdict

from whoosh import matching
from whoosh.analysis import Token
from whoosh.compat import bytes_type, text_type, u
from whoosh.lang.morph_en import variations
from whoosh.query import qcore


class Term(qcore.Query):
    """Matches documents containing the given term (fieldname+text pair).

    >>> Term("content", u"render")
    """

    __inittypes__ = dict(fieldname=str, text=text_type, boost=float)

    def __init__(self, fieldname, text, boost=1.0, minquality=None):
        self.fieldname = fieldname
        self.text = text
        self.boost = boost
        self.minquality = minquality

    def __eq__(self, other):
        return (other
                and self.__class__ is other.__class__
                and self.fieldname == other.fieldname
                and self.text == other.text
                and self.boost == other.boost)

    def __repr__(self):
        r = "%s(%r, %r" % (self.__class__.__name__, self.fieldname, self.text)
        if self.boost != 1.0:
            r += ", boost=%s" % self.boost
        r += ")"
        return r

    def __unicode__(self):
        text = self.text
        if isinstance(text, bytes_type):
            try:
                text = text.decode("ascii")
            except UnicodeDecodeError:
                text = repr(text)

        t = u("%s:%s") % (self.fieldname, text)
        if self.boost != 1:
            t += u("^") + text_type(self.boost)
        return t

    __str__ = __unicode__

    def __hash__(self):
        return hash(self.fieldname) ^ hash(self.text) ^ hash(self.boost)

    def has_terms(self):
        return True

    def tokens(self, boost=1.0):
        yield Token(fieldname=self.fieldname, text=self.text,
                    boost=boost * self.boost, startchar=self.startchar,
                    endchar=self.endchar, chars=True)

    def terms(self, phrases=False):
        if self.field():
            yield (self.field(), self.text)

    def replace(self, fieldname, oldtext, newtext):
        q = copy.copy(self)
        if q.fieldname == fieldname and q.text == oldtext:
            q.text = newtext
        return q

    def estimate_size(self, ixreader):
        fieldname = self.fieldname
        if fieldname not in ixreader.schema:
            return 0

        field = ixreader.schema[fieldname]
        try:
            text = field.to_bytes(self.text)
        except ValueError:
            return 0

        return ixreader.doc_frequency(fieldname, text)

    def matcher(self, searcher, context=None):
        fieldname = self.fieldname
        text = self.text
        if fieldname not in searcher.schema:
            return matching.NullMatcher()

        field = searcher.schema[fieldname]
        try:
            text = field.to_bytes(text)
        except ValueError:
            return matching.NullMatcher()

        if (self.fieldname, text) in searcher.reader():
            if context is None:
                w = searcher.weighting
            else:
                w = context.weighting

            m = searcher.postings(self.fieldname, text, weighting=w)
            if self.minquality:
                m.set_min_quality(self.minquality)
            if self.boost != 1.0:
                m = matching.WrappingMatcher(m, boost=self.boost)
            return m
        else:
            return matching.NullMatcher()


class MultiTerm(qcore.Query):
    """Abstract base class for queries that operate on multiple terms in the
    same field.
    """

    constantscore = False

    def _btexts(self, ixreader):
        raise NotImplementedError(self.__class__.__name__)

    def expanded_terms(self, ixreader, phrases=False):
        fieldname = self.field()
        if fieldname:
            for btext in self._btexts(ixreader):
                yield (fieldname, btext)

    def tokens(self, boost=1.0, exreader=None):
        fieldname = self.field()
        if exreader is None:
            btexts = [self.text]
        else:
            btexts = self._btexts(exreader)

        for btext in btexts:
            yield Token(fieldname=fieldname, text=btext,
                        boost=boost * self.boost, startchar=self.startchar,
                        endchar=self.endchar, chars=True)

    def simplify(self, ixreader):
        fieldname = self.field()

        if fieldname not in ixreader.schema:
            return qcore.NullQuery()
        field = ixreader.schema[fieldname]

        existing = []
        for btext in sorted(set(self._btexts(ixreader))):
            text = field.from_bytes(btext)
            existing.append(Term(fieldname, text, boost=self.boost))

        if len(existing) == 1:
            return existing[0]
        elif existing:
            from whoosh.query import Or
            return Or(existing)
        else:
            return qcore.NullQuery

    def estimate_size(self, ixreader):
        fieldname = self.field()
        return sum(ixreader.doc_frequency(fieldname, btext)
                   for btext in self._btexts(ixreader))

    def estimate_min_size(self, ixreader):
        fieldname = self.field()
        return min(ixreader.doc_frequency(fieldname, text)
                   for text in self._btexts(ixreader))

    def matcher(self, searcher, context=None):
        from whoosh.query import Or

        fieldname = self.field()
        constantscore = self.constantscore

        reader = searcher.reader()
        qs = [Term(fieldname, word) for word in self._btexts(reader)
              if word]
        if not qs:
            return matching.NullMatcher()

        if len(qs) == 1:
            # If there's only one term, just use it
            m = qs[0].matcher(searcher, context)
        else:
            if constantscore:
                # To tell the sub-query that score doesn't matter, set weighting
                # to None
                if context:
                    context = context.set(weighting=None)
                else:
                    from whoosh.searching import SearchContext
                    context = SearchContext(weighting=None)
            # Or the terms together
            m = Or(qs, boost=self.boost).matcher(searcher, context)
        return m


class PatternQuery(MultiTerm):
    """An intermediate base class for common methods of Prefix and Wildcard.
    """

    __inittypes__ = dict(fieldname=str, text=text_type, boost=float)

    def __init__(self, fieldname, text, boost=1.0, constantscore=True):
        self.fieldname = fieldname
        self.text = text
        self.boost = boost
        self.constantscore = constantscore

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.fieldname == other.fieldname
                and self.text == other.text and self.boost == other.boost
                and self.constantscore == other.constantscore)

    def __repr__(self):
        r = "%s(%r, %r" % (self.__class__.__name__, self.fieldname, self.text)
        if self.boost != 1:
            r += ", boost=%s" % self.boost
        r += ")"
        return r

    def __hash__(self):
        return (hash(self.fieldname) ^ hash(self.text) ^ hash(self.boost)
                ^ hash(self.constantscore))

    def _get_pattern(self):
        raise NotImplementedError

    def _find_prefix(self, text):
        # Subclasses/instances should set the SPECIAL_CHARS attribute to a set
        # of characters that mark the end of the literal prefix
        specialchars = self.SPECIAL_CHARS
        i = 0
        for i, char in enumerate(text):
            if char in specialchars:
                break
        return text[:i]

    def _btexts(self, ixreader):
        field = ixreader.schema[self.fieldname]

        exp = re.compile(self._get_pattern())
        prefix = self._find_prefix(self.text)
        if prefix:
            candidates = ixreader.expand_prefix(self.fieldname, prefix)
        else:
            candidates = ixreader.lexicon(self.fieldname)

        from_bytes = field.from_bytes
        for btext in candidates:
            text = from_bytes(btext)
            if exp.match(text):
                yield btext


class Prefix(PatternQuery):
    """Matches documents that contain any terms that start with the given text.

    >>> # Match documents containing words starting with 'comp'
    >>> Prefix("content", u"comp")
    """

    def __unicode__(self):
        return "%s:%s*" % (self.fieldname, self.text)

    __str__ = __unicode__

    def _btexts(self, ixreader):
        return ixreader.expand_prefix(self.fieldname, self.text)

    def matcher(self, searcher, context=None):
        if self.text == "":
            from whoosh.query import Every
            eq = Every(self.fieldname, boost=self.boost)
            return eq.matcher(searcher, context)
        else:
            return PatternQuery.matcher(self, searcher, context)


class Wildcard(PatternQuery):
    """Matches documents that contain any terms that match a "glob" pattern.
    See the Python ``fnmatch`` module for information about globs.

    >>> Wildcard("content", u"in*f?x")
    """

    SPECIAL_CHARS = frozenset("*?[")

    def __unicode__(self):
        return "%s:%s" % (self.fieldname, self.text)

    __str__ = __unicode__

    def _get_pattern(self):
        return fnmatch.translate(self.text)

    def normalize(self):
        # If there are no wildcard characters in this "wildcard", turn it into
        # a simple Term
        text = self.text
        if text == "*":
            from whoosh.query import Every
            return Every(self.fieldname, boost=self.boost)
        if "*" not in text and "?" not in text:
            # If no wildcard chars, convert to a normal term.
            return Term(self.fieldname, self.text, boost=self.boost)
        elif ("?" not in text and text.endswith("*")
              and text.find("*") == len(text) - 1):
            # If the only wildcard char is an asterisk at the end, convert to a
            # Prefix query.
            return Prefix(self.fieldname, self.text[:-1], boost=self.boost)
        else:
            return self

    def matcher(self, searcher, context=None):
        if self.text == "*":
            from whoosh.query import Every
            eq = Every(self.fieldname, boost=self.boost)
            return eq.matcher(searcher, context)
        else:
            return PatternQuery.matcher(self, searcher, context)

    # _btexts() implemented in PatternQuery


class Regex(PatternQuery):
    """Matches documents that contain any terms that match a regular
    expression. See the Python ``re`` module for information about regular
    expressions.
    """

    SPECIAL_CHARS = frozenset("{}()[].?*+^$\\")

    def __unicode__(self):
        return '%s:r"%s"' % (self.fieldname, self.text)

    __str__ = __unicode__

    def _get_pattern(self):
        return self.text

    def _find_prefix(self, text):
        if "|" in text:
            return ""
        if text.startswith("^"):
            text = text[1:]
        elif text.startswith("\\A"):
            text = text[2:]

        prefix = PatternQuery._find_prefix(self, text)

        lp = len(prefix)
        if lp < len(text) and text[lp] in "*?":
            # we stripped something starting from * or ? - they both MAY mean
            # "0 times". As we had stripped starting from FIRST special char,
            # that implies there were only ordinary chars left of it. Thus,
            # the very last of them is not part of the real prefix:
            prefix = prefix[:-1]
        return prefix

    def matcher(self, searcher, context=None):
        if self.text == ".*":
            from whoosh.query import Every
            eq = Every(self.fieldname, boost=self.boost)
            return eq.matcher(searcher, context)
        else:
            return PatternQuery.matcher(self, searcher, context)

    # _btexts() implemented in PatternQuery


class ExpandingTerm(MultiTerm):
    """Intermediate base class for queries such as FuzzyTerm and Variations
    that expand into multiple queries, but come from a single term.
    """

    def has_terms(self):
        return True

    def terms(self, phrases=False):
        if self.field():
            yield (self.field(), self.text)


class FuzzyTerm(ExpandingTerm):
    """Matches documents containing words similar to the given term.
    """

    __inittypes__ = dict(fieldname=str, text=text_type, boost=float,
                         maxdist=float, prefixlength=int)

    def __init__(self, fieldname, text, boost=1.0, maxdist=1,
                 prefixlength=1, constantscore=True):
        """
        :param fieldname: The name of the field to search.
        :param text: The text to search for.
        :param boost: A boost factor to apply to scores of documents matching
            this query.
        :param maxdist: The maximum edit distance from the given text.
        :param prefixlength: The matched terms must share this many initial
            characters with 'text'. For example, if text is "light" and
            prefixlength is 2, then only terms starting with "li" are checked
            for similarity.
        """

        self.fieldname = fieldname
        self.text = text
        self.boost = boost
        self.maxdist = maxdist
        self.prefixlength = prefixlength
        self.constantscore = constantscore

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.fieldname == other.fieldname
                and self.text == other.text
                and self.maxdist == other.maxdist
                and self.prefixlength == other.prefixlength
                and self.boost == other.boost
                and self.constantscore == other.constantscore)

    def __repr__(self):
        r = "%s(%r, %r, boost=%f, maxdist=%d, prefixlength=%d)"
        return r % (self.__class__.__name__, self.fieldname, self.text,
                    self.boost, self.maxdist, self.prefixlength)

    def __unicode__(self):
        r = u("%s:%s") % (self.fieldname, self.text) + u("~")
        if self.maxdist > 1:
            r += u("%d") % self.maxdist
        if self.boost != 1.0:
            r += u("^%f") % self.boost
        return r

    __str__ = __unicode__

    def __hash__(self):
        return (hash(self.fieldname) ^ hash(self.text) ^ hash(self.boost)
                ^ hash(self.maxdist) ^ hash(self.prefixlength)
                ^ hash(self.constantscore))

    def _btexts(self, ixreader):
        return ixreader.terms_within(self.fieldname, self.text, self.maxdist,
                                     prefix=self.prefixlength)

    def replace(self, fieldname, oldtext, newtext):
        q = copy.copy(self)
        if q.fieldname == fieldname and q.text == oldtext:
            q.text = newtext
        return q


class Variations(ExpandingTerm):
    """Query that automatically searches for morphological variations of the
    given word in the same field.
    """

    def __init__(self, fieldname, text, boost=1.0):
        self.fieldname = fieldname
        self.text = text
        self.boost = boost

    def __repr__(self):
        r = "%s(%r, %r" % (self.__class__.__name__, self.fieldname, self.text)
        if self.boost != 1:
            r += ", boost=%s" % self.boost
        r += ")"
        return r

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.fieldname == other.fieldname
                and self.text == other.text and self.boost == other.boost)

    def __hash__(self):
        return hash(self.fieldname) ^ hash(self.text) ^ hash(self.boost)

    def _btexts(self, ixreader):
        fieldname = self.fieldname
        to_bytes = ixreader.schema[fieldname].to_bytes
        for word in variations(self.text):
            try:
                btext = to_bytes(word)
            except ValueError:
                continue

            if (fieldname, btext) in ixreader:
                yield btext

    def __unicode__(self):
        return u("%s:<%s>") % (self.fieldname, self.text)

    __str__ = __unicode__

    def replace(self, fieldname, oldtext, newtext):
        q = copy.copy(self)
        if q.fieldname == fieldname and q.text == oldtext:
            q.text = newtext
        return q
