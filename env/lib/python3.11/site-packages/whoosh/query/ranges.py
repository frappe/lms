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

from whoosh.compat import b, u
from whoosh.query import qcore, terms, compound, wrappers
from whoosh.util.times import datetime_to_long


class RangeMixin(object):
    # Contains methods shared by TermRange and NumericRange

    def __repr__(self):
        return ('%s(%r, %r, %r, %s, %s, boost=%s, constantscore=%s)'
                % (self.__class__.__name__, self.fieldname, self.start,
                   self.end, self.startexcl, self.endexcl, self.boost,
                   self.constantscore))

    def __unicode__(self):
        startchar = "{" if self.startexcl else "["
        endchar = "}" if self.endexcl else "]"
        start = '' if self.start is None else self.start
        end = '' if self.end is None else self.end
        return u("%s:%s%s TO %s%s") % (self.fieldname, startchar, start, end,
                                     endchar)

    __str__ = __unicode__

    def __eq__(self, other):
        return (other and self.__class__ is other.__class__
                and self.fieldname == other.fieldname
                and self.start == other.start and self.end == other.end
                and self.startexcl == other.startexcl
                and self.endexcl == other.endexcl
                and self.boost == other.boost
                and self.constantscore == other.constantscore)

    def __hash__(self):
        return (hash(self.fieldname) ^ hash(self.start) ^ hash(self.startexcl)
                ^ hash(self.end) ^ hash(self.endexcl) ^ hash(self.boost))

    def is_range(self):
        return True

    def _comparable_start(self):
        if self.start is None:
            return (qcore.Lowest, 0)
        else:
            second = 1 if self.startexcl else 0
            return (self.start, second)

    def _comparable_end(self):
        if self.end is None:
            return (qcore.Highest, 0)
        else:
            second = -1 if self.endexcl else 0
            return (self.end, second)

    def overlaps(self, other):
        if not isinstance(other, TermRange):
            return False
        if self.fieldname != other.fieldname:
            return False

        start1 = self._comparable_start()
        start2 = other._comparable_start()
        end1 = self._comparable_end()
        end2 = other._comparable_end()

        return ((start1 >= start2 and start1 <= end2)
                or (end1 >= start2 and end1 <= end2)
                or (start2 >= start1 and start2 <= end1)
                or (end2 >= start1 and end2 <= end1))

    def merge(self, other, intersect=True):
        assert self.fieldname == other.fieldname

        start1 = self._comparable_start()
        start2 = other._comparable_start()
        end1 = self._comparable_end()
        end2 = other._comparable_end()

        if start1 >= start2 and end1 <= end2:
            start = start2
            end = end2
        elif start2 >= start1 and end2 <= end1:
            start = start1
            end = end1
        elif intersect:
            start = max(start1, start2)
            end = min(end1, end2)
        else:
            start = min(start1, start2)
            end = max(end1, end2)

        startval = None if start[0] is qcore.Lowest else start[0]
        startexcl = start[1] == 1
        endval = None if end[0] is qcore.Highest else end[0]
        endexcl = end[1] == -1

        boost = max(self.boost, other.boost)
        constantscore = self.constantscore or other.constantscore

        return self.__class__(self.fieldname, startval, endval, startexcl,
                              endexcl, boost=boost,
                              constantscore=constantscore)


class TermRange(RangeMixin, terms.MultiTerm):
    """Matches documents containing any terms in a given range.

    >>> # Match documents where the indexed "id" field is greater than or equal
    >>> # to 'apple' and less than or equal to 'pear'.
    >>> TermRange("id", u"apple", u"pear")
    """

    def __init__(self, fieldname, start, end, startexcl=False, endexcl=False,
                 boost=1.0, constantscore=True):
        """
        :param fieldname: The name of the field to search.
        :param start: Match terms equal to or greater than this.
        :param end: Match terms equal to or less than this.
        :param startexcl: If True, the range start is exclusive. If False, the
            range start is inclusive.
        :param endexcl: If True, the range end is exclusive. If False, the
            range end is inclusive.
        :param boost: Boost factor that should be applied to the raw score of
            results matched by this query.
        """

        self.fieldname = fieldname
        self.start = start
        self.end = end
        self.startexcl = startexcl
        self.endexcl = endexcl
        self.boost = boost
        self.constantscore = constantscore

    def normalize(self):
        if self.start in ('', None) and self.end in (u('\uffff'), None):
            from whoosh.query import Every
            return Every(self.fieldname, boost=self.boost)
        elif self.start == self.end:
            if self.startexcl or self.endexcl:
                return qcore.NullQuery
            return terms.Term(self.fieldname, self.start, boost=self.boost)
        else:
            return TermRange(self.fieldname, self.start, self.end,
                             self.startexcl, self.endexcl,
                             boost=self.boost)

    #def replace(self, fieldname, oldtext, newtext):
    #    q = self.copy()
    #    if q.fieldname == fieldname:
    #        if q.start == oldtext:
    #            q.start = newtext
    #        if q.end == oldtext:
    #            q.end = newtext
    #    return q

    def _btexts(self, ixreader):
        fieldname = self.fieldname
        field = ixreader.schema[fieldname]
        startexcl = self.startexcl
        endexcl = self.endexcl

        if self.start is None:
            start = b("")
        else:
            try:
                start = field.to_bytes(self.start)
            except ValueError:
                return

        if self.end is None:
            end = b("\xFF\xFF\xFF\xFF")
        else:
            try:
                end = field.to_bytes(self.end)
            except ValueError:
                return

        for fname, t in ixreader.terms_from(fieldname, start):
            if fname != fieldname:
                break
            if t == start and startexcl:
                continue
            if t == end and endexcl:
                break
            if t > end:
                break
            yield t


class NumericRange(RangeMixin, qcore.Query):
    """A range query for NUMERIC fields. Takes advantage of tiered indexing
    to speed up large ranges by matching at a high resolution at the edges of
    the range and a low resolution in the middle.

    >>> # Match numbers from 10 to 5925 in the "number" field.
    >>> nr = NumericRange("number", 10, 5925)
    """

    def __init__(self, fieldname, start, end, startexcl=False, endexcl=False,
                 boost=1.0, constantscore=True):
        """
        :param fieldname: The name of the field to search.
        :param start: Match terms equal to or greater than this number. This
            should be a number type, not a string.
        :param end: Match terms equal to or less than this number. This should
            be a number type, not a string.
        :param startexcl: If True, the range start is exclusive. If False, the
            range start is inclusive.
        :param endexcl: If True, the range end is exclusive. If False, the
            range end is inclusive.
        :param boost: Boost factor that should be applied to the raw score of
            results matched by this query.
        :param constantscore: If True, the compiled query returns a constant
            score (the value of the ``boost`` keyword argument) instead of
            actually scoring the matched terms. This gives a nice speed boost
            and won't affect the results in most cases since numeric ranges
            will almost always be used as a filter.
        """

        self.fieldname = fieldname
        self.start = start
        self.end = end
        self.startexcl = startexcl
        self.endexcl = endexcl
        self.boost = boost
        self.constantscore = constantscore

    def simplify(self, ixreader):
        return self._compile_query(ixreader).simplify(ixreader)

    def estimate_size(self, ixreader):
        return self._compile_query(ixreader).estimate_size(ixreader)

    def estimate_min_size(self, ixreader):
        return self._compile_query(ixreader).estimate_min_size(ixreader)

    def docs(self, searcher):
        q = self._compile_query(searcher.reader())
        return q.docs(searcher)

    def _compile_query(self, ixreader):
        from whoosh.fields import NUMERIC
        from whoosh.util.numeric import tiered_ranges

        field = ixreader.schema[self.fieldname]
        if not isinstance(field, NUMERIC):
            raise Exception("NumericRange: field %r is not numeric"
                            % self.fieldname)

        start = self.start
        if start is not None:
            start = field.prepare_number(start)
        end = self.end
        if end is not None:
            end = field.prepare_number(end)

        subqueries = []
        stb = field.sortable_to_bytes
        # Get the term ranges for the different resolutions
        ranges = tiered_ranges(field.numtype, field.bits, field.signed,
                               start, end, field.shift_step,
                               self.startexcl, self.endexcl)
        for startnum, endnum, shift in ranges:
            if startnum == endnum:
                subq = terms.Term(self.fieldname, stb(startnum, shift))
            else:
                startbytes = stb(startnum, shift)
                endbytes = stb(endnum, shift)
                subq = TermRange(self.fieldname, startbytes, endbytes)
            subqueries.append(subq)

        if len(subqueries) == 1:
            q = subqueries[0]
        elif subqueries:
            q = compound.Or(subqueries, boost=self.boost)
        else:
            return qcore.NullQuery

        if self.constantscore:
            q = wrappers.ConstantScoreQuery(q, self.boost)
        return q

    def matcher(self, searcher, context=None):
        q = self._compile_query(searcher.reader())
        return q.matcher(searcher, context)


class DateRange(NumericRange):
    """This is a very thin subclass of :class:`NumericRange` that only
    overrides the initializer and ``__repr__()`` methods to work with datetime
    objects instead of numbers. Internally this object converts the datetime
    objects it's created with to numbers and otherwise acts like a
    ``NumericRange`` query.

    >>> DateRange("date", datetime(2010, 11, 3, 3, 0),
    ...           datetime(2010, 11, 3, 17, 59))
    """

    def __init__(self, fieldname, start, end, startexcl=False, endexcl=False,
                 boost=1.0, constantscore=True):
        self.startdate = start
        self.enddate = end
        if start:
            start = datetime_to_long(start)
        if end:
            end = datetime_to_long(end)
        super(DateRange, self).__init__(fieldname, start, end,
                                        startexcl=startexcl, endexcl=endexcl,
                                        boost=boost,
                                        constantscore=constantscore)

    def __repr__(self):
        return '%s(%r, %r, %r, %s, %s, boost=%s)' % (self.__class__.__name__,
                                           self.fieldname,
                                           self.startdate, self.enddate,
                                           self.startexcl, self.endexcl,
                                           self.boost)
