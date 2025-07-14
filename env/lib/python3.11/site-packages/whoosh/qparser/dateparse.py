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

import re
import sys
from datetime import datetime, timedelta

from whoosh.compat import string_type, iteritems
from whoosh.qparser import plugins, syntax
from whoosh.qparser.taggers import Tagger
from whoosh.support.relativedelta import relativedelta
from whoosh.util.text import rcompile
from whoosh.util.times import adatetime, timespan
from whoosh.util.times import fill_in, is_void, relative_days
from whoosh.util.times import TimeError


class DateParseError(Exception):
    "Represents an error in parsing date text."


# Utility functions

def print_debug(level, msg, *args):
    if level > 0:
        print(("  " * (level - 1)) + (msg % args))


# Parser element objects

class Props(object):
    """A dumb little object that just puts copies a dictionary into attibutes
    so I can use dot syntax instead of square bracket string item lookup and
    save a little bit of typing. Used by :class:`Regex`.
    """

    def __init__(self, **args):
        self.__dict__ = args

    def __repr__(self):
        return repr(self.__dict__)

    def get(self, key, default=None):
        return self.__dict__.get(key, default)


class ParserBase(object):
    """Base class for date parser elements.
    """

    def to_parser(self, e):
        if isinstance(e, string_type):
            return Regex(e)
        else:
            return e

    def parse(self, text, dt, pos=0, debug=-9999):
        raise NotImplementedError

    def date_from(self, text, dt=None, pos=0, debug=-9999):
        if dt is None:
            dt = datetime.now()

        d, pos = self.parse(text, dt, pos, debug + 1)
        return d


class MultiBase(ParserBase):
    """Base class for date parser elements such as Sequence and Bag that
    have sub-elements.
    """

    def __init__(self, elements, name=None):
        """
        :param elements: the sub-elements to match.
        :param name: a name for this element (for debugging purposes only).
        """

        self.elements = [self.to_parser(e) for e in elements]
        self.name = name

    def __repr__(self):
        return "%s<%s>%r" % (self.__class__.__name__, self.name or '',
                             self.elements)


class Sequence(MultiBase):
    """Merges the dates parsed by a sequence of sub-elements.
    """

    def __init__(self, elements, sep="(\\s+|\\s*,\\s*)", name=None,
                 progressive=False):
        """
        :param elements: the sequence of sub-elements to parse.
        :param sep: a separator regular expression to match between elements,
            or None to not have separators.
        :param name: a name for this element (for debugging purposes only).
        :param progressive: if True, elements after the first do not need to
            match. That is, for elements (a, b, c) and progressive=True, the
            sequence matches like ``a[b[c]]``.
        """

        super(Sequence, self).__init__(elements, name)
        self.sep_pattern = sep
        if sep:
            self.sep_expr = rcompile(sep, re.IGNORECASE)
        else:
            self.sep_expr = None
        self.progressive = progressive

    def parse(self, text, dt, pos=0, debug=-9999):
        d = adatetime()
        first = True
        foundall = False
        failed = False

        print_debug(debug, "Seq %s sep=%r text=%r", self.name,
                    self.sep_pattern, text[pos:])
        for e in self.elements:
            print_debug(debug, "Seq %s text=%r", self.name, text[pos:])
            if self.sep_expr and not first:
                print_debug(debug, "Seq %s looking for sep", self.name)
                m = self.sep_expr.match(text, pos)
                if m:
                    pos = m.end()
                else:
                    print_debug(debug, "Seq %s didn't find sep", self.name)
                    break

            print_debug(debug, "Seq %s trying=%r at=%s", self.name, e, pos)

            try:
                at, newpos = e.parse(text, dt, pos=pos, debug=debug + 1)
            except TimeError:
                failed = True
                break

            print_debug(debug, "Seq %s result=%r", self.name, at)
            if not at:
                break
            pos = newpos

            print_debug(debug, "Seq %s adding=%r to=%r", self.name, at, d)
            try:
                d = fill_in(d, at)
            except TimeError:
                print_debug(debug, "Seq %s Error in fill_in", self.name)
                failed = True
                break
            print_debug(debug, "Seq %s filled date=%r", self.name, d)

            first = False
        else:
            foundall = True

        if not failed and (foundall or (not first and self.progressive)):
            print_debug(debug, "Seq %s final=%r", self.name, d)
            return (d, pos)
        else:
            print_debug(debug, "Seq %s failed", self.name)
            return (None, None)


class Combo(Sequence):
    """Parses a sequence of elements in order and combines the dates parsed
    by the sub-elements somehow. The default behavior is to accept two dates
    from the sub-elements and turn them into a range.
    """

    def __init__(self, elements, fn=None, sep="(\\s+|\\s*,\\s*)", min=2, max=2,
                 name=None):
        """
        :param elements: the sequence of sub-elements to parse.
        :param fn: a function to run on all dates found. It should return a
            datetime, adatetime, or timespan object. If this argument is None,
            the default behavior accepts two dates and returns a timespan.
        :param sep: a separator regular expression to match between elements,
            or None to not have separators.
        :param min: the minimum number of dates required from the sub-elements.
        :param max: the maximum number of dates allowed from the sub-elements.
        :param name: a name for this element (for debugging purposes only).
        """

        super(Combo, self).__init__(elements, sep=sep, name=name)
        self.fn = fn
        self.min = min
        self.max = max

    def parse(self, text, dt, pos=0, debug=-9999):
        dates = []
        first = True

        print_debug(debug, "Combo %s sep=%r text=%r", self.name,
                    self.sep_pattern, text[pos:])
        for e in self.elements:
            if self.sep_expr and not first:
                print_debug(debug, "Combo %s looking for sep at %r",
                            self.name, text[pos:])
                m = self.sep_expr.match(text, pos)
                if m:
                    pos = m.end()
                else:
                    print_debug(debug, "Combo %s didn't find sep", self.name)
                    return (None, None)

            print_debug(debug, "Combo %s trying=%r", self.name, e)
            try:
                at, pos = e.parse(text, dt, pos, debug + 1)
            except TimeError:
                at, pos = None, None

            print_debug(debug, "Combo %s result=%r", self.name, at)
            if at is None:
                return (None, None)

            first = False
            if is_void(at):
                continue
            if len(dates) == self.max:
                print_debug(debug, "Combo %s length > %s", self.name, self.max)
                return (None, None)
            dates.append(at)

        print_debug(debug, "Combo %s dates=%r", self.name, dates)
        if len(dates) < self.min:
            print_debug(debug, "Combo %s length < %s", self.name, self.min)
            return (None, None)

        return (self.dates_to_timespan(dates), pos)

    def dates_to_timespan(self, dates):
        if self.fn:
            return self.fn(dates)
        elif len(dates) == 2:
            return timespan(dates[0], dates[1])
        else:
            raise DateParseError("Don't know what to do with %r" % (dates,))


class Choice(MultiBase):
    """Returns the date from the first of its sub-elements that matches.
    """

    def parse(self, text, dt, pos=0, debug=-9999):
        print_debug(debug, "Choice %s text=%r", self.name, text[pos:])
        for e in self.elements:
            print_debug(debug, "Choice %s trying=%r", self.name, e)

            try:
                d, newpos = e.parse(text, dt, pos, debug + 1)
            except TimeError:
                d, newpos = None, None
            if d:
                print_debug(debug, "Choice %s matched", self.name)
                return (d, newpos)
        print_debug(debug, "Choice %s no match", self.name)
        return (None, None)


class Bag(MultiBase):
    """Parses its sub-elements in any order and merges the dates.
    """

    def __init__(self, elements, sep="(\\s+|\\s*,\\s*)", onceper=True,
                 requireall=False, allof=None, anyof=None, name=None):
        """
        :param elements: the sub-elements to parse.
        :param sep: a separator regular expression to match between elements,
            or None to not have separators.
        :param onceper: only allow each element to match once.
        :param requireall: if True, the sub-elements can match in any order,
            but they must all match.
        :param allof: a list of indexes into the list of elements. When this
            argument is not None, this element matches only if all the
            indicated sub-elements match.
        :param allof: a list of indexes into the list of elements. When this
            argument is not None, this element matches only if any of the
            indicated sub-elements match.
        :param name: a name for this element (for debugging purposes only).
        """

        super(Bag, self).__init__(elements, name)
        self.sep_expr = rcompile(sep, re.IGNORECASE)
        self.onceper = onceper
        self.requireall = requireall
        self.allof = allof
        self.anyof = anyof

    def parse(self, text, dt, pos=0, debug=-9999):
        first = True
        d = adatetime()
        seen = [False] * len(self.elements)

        while True:
            newpos = pos
            print_debug(debug, "Bag %s text=%r", self.name, text[pos:])
            if not first:
                print_debug(debug, "Bag %s looking for sep", self.name)
                m = self.sep_expr.match(text, pos)
                if m:
                    newpos = m.end()
                else:
                    print_debug(debug, "Bag %s didn't find sep", self.name)
                    break

            for i, e in enumerate(self.elements):
                print_debug(debug, "Bag %s trying=%r", self.name, e)

                try:
                    at, xpos = e.parse(text, dt, newpos, debug + 1)
                except TimeError:
                    at, xpos = None, None

                print_debug(debug, "Bag %s result=%r", self.name, at)
                if at:
                    if self.onceper and seen[i]:
                        return (None, None)

                    d = fill_in(d, at)
                    newpos = xpos
                    seen[i] = True
                    break
            else:
                break

            pos = newpos
            if self.onceper and all(seen):
                break

            first = False

        if (not any(seen)
            or (self.allof and not all(seen[pos] for pos in self.allof))
            or (self.anyof and not any(seen[pos] for pos in self.anyof))
            or (self.requireall and not all(seen))):
            return (None, None)

        print_debug(debug, "Bag %s final=%r", self.name, d)
        return (d, pos)


class Optional(ParserBase):
    """Wraps a sub-element to indicate that the sub-element is optional.
    """

    def __init__(self, element):
        self.element = self.to_parser(element)

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self.element)

    def parse(self, text, dt, pos=0, debug=-9999):
        try:
            d, pos = self.element.parse(text, dt, pos, debug + 1)
        except TimeError:
            d, pos = None, None

        if d:
            return (d, pos)
        else:
            return (adatetime(), pos)


class ToEnd(ParserBase):
    """Wraps a sub-element and requires that the end of the sub-element's match
    be the end of the text.
    """

    def __init__(self, element):
        self.element = element

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self.element)

    def parse(self, text, dt, pos=0, debug=-9999):
        try:
            d, pos = self.element.parse(text, dt, pos, debug + 1)
        except TimeError:
            d, pos = None, None

        if d and pos == len(text):
            return (d, pos)
        else:
            return (None, None)


class Regex(ParserBase):
    """Matches a regular expression and maps named groups in the pattern to
    datetime attributes using a function or overridden method.

    There are two points at which you can customize the behavior of this class,
    either by supplying functions to the initializer or overriding methods.

    * The ``modify`` function or ``modify_props`` method takes a ``Props``
      object containing the named groups and modifies its values (in place).
    * The ``fn`` function or ``props_to_date`` method takes a ``Props`` object
      and the base datetime and returns an adatetime/datetime.
    """

    fn = None
    modify = None

    def __init__(self, pattern, fn=None, modify=None):
        self.pattern = pattern
        self.expr = rcompile(pattern, re.IGNORECASE)
        self.fn = fn
        self.modify = modify

    def __repr__(self):
        return "<%r>" % (self.pattern,)

    def parse(self, text, dt, pos=0, debug=-9999):
        m = self.expr.match(text, pos)
        if not m:
            return (None, None)

        props = self.extract(m)
        self.modify_props(props)

        try:
            d = self.props_to_date(props, dt)
        except TimeError:
            d = None

        if d:
            return (d, m.end())
        else:
            return (None, None)

    def extract(self, match):
        d = match.groupdict()
        for key, value in iteritems(d):
            try:
                value = int(value)
                d[key] = value
            except (ValueError, TypeError):
                pass
        return Props(**d)

    def modify_props(self, props):
        if self.modify:
            self.modify(props)

    def props_to_date(self, props, dt):
        if self.fn:
            return self.fn(props, dt)
        else:
            args = {}
            for key in adatetime.units:
                args[key] = props.get(key)
            return adatetime(**args)


class Month(Regex):
    def __init__(self, *patterns):
        self.patterns = patterns
        self.exprs = [rcompile(pat, re.IGNORECASE) for pat in self.patterns]

        self.pattern = ("(?P<month>"
                        + "|".join("(%s)" % pat for pat in self.patterns)
                        + ")")
        self.expr = rcompile(self.pattern, re.IGNORECASE)

    def modify_props(self, p):
        text = p.month
        for i, expr in enumerate(self.exprs):
            m = expr.match(text)
            if m:
                p.month = i + 1
                break


class PlusMinus(Regex):
    def __init__(self, years, months, weeks, days, hours, minutes, seconds):
        rel_years = "((?P<years>[0-9]+) *(%s))?" % years
        rel_months = "((?P<months>[0-9]+) *(%s))?" % months
        rel_weeks = "((?P<weeks>[0-9]+) *(%s))?" % weeks
        rel_days = "((?P<days>[0-9]+) *(%s))?" % days
        rel_hours = "((?P<hours>[0-9]+) *(%s))?" % hours
        rel_mins = "((?P<mins>[0-9]+) *(%s))?" % minutes
        rel_secs = "((?P<secs>[0-9]+) *(%s))?" % seconds

        self.pattern = ("(?P<dir>[+-]) *%s *%s *%s *%s *%s *%s *%s(?=(\\W|$))"
                        % (rel_years, rel_months, rel_weeks, rel_days,
                           rel_hours, rel_mins, rel_secs))
        self.expr = rcompile(self.pattern, re.IGNORECASE)

    def props_to_date(self, p, dt):
        if p.dir == "-":
            dir = -1
        else:
            dir = 1

        delta = relativedelta(years=(p.get("years") or 0) * dir,
                              months=(p.get("months") or 0) * dir,
                              weeks=(p.get("weeks") or 0) * dir,
                              days=(p.get("days") or 0) * dir,
                              hours=(p.get("hours") or 0) * dir,
                              minutes=(p.get("mins") or 0) * dir,
                              seconds=(p.get("secs") or 0) * dir)
        return dt + delta


class Daynames(Regex):
    def __init__(self, next, last, daynames):
        self.next_pattern = next
        self.last_pattern = last
        self._dayname_exprs = tuple(rcompile(pat, re.IGNORECASE)
                                    for pat in daynames)
        dn_pattern = "|".join(daynames)
        self.pattern = ("(?P<dir>%s|%s) +(?P<day>%s)(?=(\\W|$))"
                        % (next, last, dn_pattern))
        self.expr = rcompile(self.pattern, re.IGNORECASE)

    def props_to_date(self, p, dt):
        if re.match(p.dir, self.last_pattern):
            dir = -1
        else:
            dir = 1

        for daynum, expr in enumerate(self._dayname_exprs):
            m = expr.match(p.day)
            if m:
                break
        current_daynum = dt.weekday()
        days_delta = relative_days(current_daynum, daynum, dir)

        d = dt.date() + timedelta(days=days_delta)
        return adatetime(year=d.year, month=d.month, day=d.day)


class Time12(Regex):
    def __init__(self):
        self.pattern = ("(?P<hour>[1-9]|10|11|12)(:(?P<mins>[0-5][0-9])"
                        "(:(?P<secs>[0-5][0-9])(\\.(?P<usecs>[0-9]{1,5}))?)?)?"
                        "\\s*(?P<ampm>am|pm)(?=(\\W|$))")
        self.expr = rcompile(self.pattern, re.IGNORECASE)

    def props_to_date(self, p, dt):
        isam = p.ampm.lower().startswith("a")

        if p.hour == 12:
            if isam:
                hr = 0
            else:
                hr = 12
        else:
            hr = p.hour
            if not isam:
                hr += 12

        return adatetime(hour=hr, minute=p.mins, second=p.secs, microsecond=p.usecs)


# Top-level parser classes

class DateParser(object):
    """Base class for locale-specific parser classes.
    """

    day = Regex("(?P<day>([123][0-9])|[1-9])(?=(\\W|$))(?!=:)",
                lambda p, dt: adatetime(day=p.day))
    year = Regex("(?P<year>[0-9]{4})(?=(\\W|$))",
                 lambda p, dt: adatetime(year=p.year))
    time24 = Regex("(?P<hour>([0-1][0-9])|(2[0-3])):(?P<mins>[0-5][0-9])"
                   "(:(?P<secs>[0-5][0-9])(\\.(?P<usecs>[0-9]{1,5}))?)?"
                   "(?=(\\W|$))",
                   lambda p, dt: adatetime(hour=p.hour, minute=p.mins,
                                           second=p.secs, microsecond=p.usecs))
    time12 = Time12()

    def __init__(self):
        simple_year = "(?P<year>[0-9]{4})"
        simple_month = "(?P<month>[0-1][0-9])"
        simple_day = "(?P<day>[0-3][0-9])"
        simple_hour = "(?P<hour>([0-1][0-9])|(2[0-3]))"
        simple_minute = "(?P<minute>[0-5][0-9])"
        simple_second = "(?P<second>[0-5][0-9])"
        simple_usec = "(?P<microsecond>[0-9]{6})"

        tup = (simple_year, simple_month, simple_day, simple_hour,
               simple_minute, simple_second, simple_usec)
        simple_seq = Sequence(tup, sep="[- .:/]*", name="simple",
                              progressive=True)
        self.simple = Sequence((simple_seq, "(?=(\\s|$))"), sep='')

        self.setup()

    def setup(self):
        raise NotImplementedError

    #

    def get_parser(self):
        return self.all

    def parse(self, text, dt, pos=0, debug=-9999):
        parser = self.get_parser()

        d, newpos = parser.parse(text, dt, pos=pos, debug=debug)
        if isinstance(d, (adatetime, timespan)):
            d = d.disambiguated(dt)

        return (d, newpos)

    def date_from(self, text, basedate=None, pos=0, debug=-9999, toend=True):
        if basedate is None:
            basedate = datetime.utcnow()

        parser = self.get_parser()
        if toend:
            parser = ToEnd(parser)

        d = parser.date_from(text, basedate, pos=pos, debug=debug)
        if isinstance(d, (adatetime, timespan)):
            d = d.disambiguated(basedate)
        return d


class English(DateParser):
    day = Regex("(?P<day>([123][0-9])|[1-9])(st|nd|rd|th)?(?=(\\W|$))",
                lambda p, dt: adatetime(day=p.day))

    def setup(self):
        self.plusdate = PlusMinus("years|year|yrs|yr|ys|y",
                                  "months|month|mons|mon|mos|mo",
                                  "weeks|week|wks|wk|ws|w",
                                  "days|day|dys|dy|ds|d",
                                  "hours|hour|hrs|hr|hs|h",
                                  "minutes|minute|mins|min|ms|m",
                                  "seconds|second|secs|sec|s")

        self.dayname = Daynames("next", "last",
                                ("monday|mon|mo", "tuesday|tues|tue|tu",
                                 "wednesday|wed|we", "thursday|thur|thu|th",
                                 "friday|fri|fr", "saturday|sat|sa",
                                 "sunday|sun|su"))

        midnight_l = lambda p, dt: adatetime(hour=0, minute=0, second=0,
                                             microsecond=0)
        midnight = Regex("midnight", midnight_l)

        noon_l = lambda p, dt: adatetime(hour=12, minute=0, second=0,
                                         microsecond=0)
        noon = Regex("noon", noon_l)

        now = Regex("now", lambda p, dt: dt)

        self.time = Choice((self.time12, self.time24, midnight, noon, now),
                           name="time")

        def tomorrow_to_date(p, dt):
            d = dt.date() + timedelta(days=+1)
            return adatetime(year=d.year, month=d.month, day=d.day)
        tomorrow = Regex("tomorrow", tomorrow_to_date)

        def yesterday_to_date(p, dt):
            d = dt.date() + timedelta(days=-1)
            return adatetime(year=d.year, month=d.month, day=d.day)
        yesterday = Regex("yesterday", yesterday_to_date)

        thisyear = Regex("this year", lambda p, dt: adatetime(year=dt.year))
        thismonth = Regex("this month",
                          lambda p, dt: adatetime(year=dt.year,
                                                  month=dt.month))
        today = Regex("today",
                      lambda p, dt: adatetime(year=dt.year, month=dt.month,
                                              day=dt.day))

        self.month = Month("january|jan", "february|febuary|feb", "march|mar",
                           "april|apr", "may", "june|jun", "july|jul",
                           "august|aug", "september|sept|sep", "october|oct",
                           "november|nov", "december|dec")

        # If you specify a day number you must also specify a month... this
        # Choice captures that constraint

        self.dmy = Choice((Sequence((self.day, self.month, self.year),
                                    name="dmy"),
                           Sequence((self.month, self.day, self.year),
                                    name="mdy"),
                           Sequence((self.year, self.month, self.day),
                                    name="ymd"),
                           Sequence((self.year, self.day, self.month),
                                    name="ydm"),
                           Sequence((self.day, self.month), name="dm"),
                           Sequence((self.month, self.day), name="md"),
                           Sequence((self.month, self.year), name="my"),
                           self.month, self.year, self.dayname, tomorrow,
                           yesterday, thisyear, thismonth, today, now,
                           ), name="date")

        self.datetime = Bag((self.time, self.dmy), name="datetime")
        self.bundle = Choice((self.plusdate, self.datetime, self.simple),
                             name="bundle")
        self.torange = Combo((self.bundle, "to", self.bundle), name="torange")

        self.all = Choice((self.torange, self.bundle), name="all")


# QueryParser plugin

class DateParserPlugin(plugins.Plugin):
    """Adds more powerful parsing of DATETIME fields.

    >>> parser.add_plugin(DateParserPlugin())
    >>> parser.parse(u"date:'last tuesday'")
    """

    def __init__(self, basedate=None, dateparser=None, callback=None,
                 free=False, free_expr="([A-Za-z][A-Za-z_0-9]*):([^^]+)"):
        """
        :param basedate: a datetime object representing the current time
            against which to measure relative dates. If you do not supply this
            argument, the plugin uses ``datetime.utcnow()``.
        :param dateparser: an instance of
            :class:`whoosh.qparser.dateparse.DateParser`. If you do not supply
            this argument, the plugin automatically uses
            :class:`whoosh.qparser.dateparse.English`.
        :param callback: a callback function for parsing errors. This allows
            you to provide feedback to the user about problems parsing dates.
        :param remove: if True, unparseable dates are removed from the token
            stream instead of being replaced with ErrorToken.
        :param free: if True, this plugin will install a filter early in the
            parsing process and try to find undelimited dates such as
            ``date:last tuesday``. Note that allowing this could result in
            normal query words accidentally being parsed as dates sometimes.
        """

        self.basedate = basedate
        if dateparser is None:
            dateparser = English()
        self.dateparser = dateparser
        self.callback = callback
        self.free = free
        self.freeexpr = free_expr

    def taggers(self, parser):
        if self.free:
            # If we're tokenizing, we have to go before the FieldsPlugin
            return [(DateTagger(self, self.freeexpr), -1)]
        else:
            return ()

    def filters(self, parser):
        # Run the filter after the FieldsPlugin assigns field names
        return [(self.do_dates, 110)]

    def errorize(self, message, node):
        if self.callback:
            self.callback(message)
        return syntax.ErrorNode(message, node)

    def text_to_dt(self, node):
        text = node.text
        try:
            dt = self.dateparser.date_from(text, self.basedate)
            if dt is None:
                return self.errorize(text, node)
            else:
                n = DateTimeNode(node.fieldname, dt, node.boost)
        except DateParseError:
            e = sys.exc_info()[1]
            n = self.errorize(e, node)
        n.startchar = node.startchar
        n.endchar = node.endchar
        return n

    def range_to_dt(self, node):
        start = end = None
        dp = self.dateparser.get_parser()

        if node.start:
            start = dp.date_from(node.start, self.basedate)
            if start is None:
                return self.errorize(node.start, node)
        if node.end:
            end = dp.date_from(node.end, self.basedate)
            if end is None:
                return self.errorize(node.end, node)

        if start and end:
            ts = timespan(start, end).disambiguated(self.basedate)
            start, end = ts.start, ts.end
        elif start:
            start = start.disambiguated(self.basedate)
            if isinstance(start, timespan):
                start = start.start
        elif end:
            end = end.disambiguated(self.basedate)
            if isinstance(end, timespan):
                end = end.end
        drn = DateRangeNode(node.fieldname, start, end, boost=node.boost)
        drn.startchar = node.startchar
        drn.endchar = node.endchar
        return drn

    def do_dates(self, parser, group):
        schema = parser.schema
        if not schema:
            return group

        from whoosh.fields import DATETIME
        datefields = frozenset(fieldname for fieldname, field
                               in parser.schema.items()
                               if isinstance(field, DATETIME))

        for i, node in enumerate(group):
            if node.has_fieldname:
                fname = node.fieldname or parser.fieldname
            else:
                fname = None

            if isinstance(node, syntax.GroupNode):
                group[i] = self.do_dates(parser, node)
            elif fname in datefields:
                if node.has_text:
                    group[i] = self.text_to_dt(node)
                elif isinstance(node, syntax.RangeNode):
                    group[i] = self.range_to_dt(node)
        return group


class DateTimeNode(syntax.SyntaxNode):
    has_fieldname = True
    has_boost = True

    def __init__(self, fieldname, dt, boost=1.0):
        self.fieldname = fieldname
        self.dt = dt
        self.boost = 1.0

    def r(self):
        return repr(self.dt)

    def query(self, parser):
        from whoosh import query

        fieldname = self.fieldname or parser.fieldname
        field = parser.schema[fieldname]
        dt = self.dt
        if isinstance(self.dt, datetime):
            btext = field.to_bytes(dt)
            return query.Term(fieldname, btext, boost=self.boost)
        elif isinstance(self.dt, timespan):
            return query.DateRange(fieldname, dt.start, dt.end,
                                   boost=self.boost)
        else:
            raise Exception("Unknown time object: %r" % dt)


class DateRangeNode(syntax.SyntaxNode):
    has_fieldname = True
    has_boost = True

    def __init__(self, fieldname, start, end, boost=1.0):
        self.fieldname = fieldname
        self.start = start
        self.end = end
        self.boost = 1.0

    def r(self):
        return "%r-%r" % (self.start, self.end)

    def query(self, parser):
        from whoosh import query

        fieldname = self.fieldname or parser.fieldname
        return query.DateRange(fieldname, self.start, self.end,
                               boost=self.boost)


class DateTagger(Tagger):
    def __init__(self, plugin, expr):
        self.plugin = plugin
        self.expr = rcompile(expr, re.IGNORECASE)

    def match(self, parser, text, pos):
        from whoosh.fields import DATETIME

        match = self.expr.match(text, pos)
        if match:
            fieldname = match.group(1)
            dtext = match.group(2)

            if parser.schema and fieldname in parser.schema:
                field = parser.schema[fieldname]
                if isinstance(field, DATETIME):
                    plugin = self.plugin
                    dateparser = plugin.dateparser
                    basedate = plugin.basedate

                    d, newpos = dateparser.parse(dtext, basedate)
                    if d:
                        node = DateTimeNode(fieldname, d)
                        node.startchar = match.start()
                        node.endchar = newpos + match.start(2)
                        return node
