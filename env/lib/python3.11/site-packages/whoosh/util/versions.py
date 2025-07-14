# Copyright 2012 Matt Chaput. All rights reserved.
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


class BaseVersion(object):
    @classmethod
    def parse(cls, text):
        obj = cls()
        match = cls._version_exp.match(text)
        if match:
            groupdict = match.groupdict()
            for groupname, typ in cls._parts:
                v = groupdict.get(groupname)
                if v is not None:
                    setattr(obj, groupname, typ(v))
        return obj

    def __repr__(self):
        vs = ", ".join(repr(getattr(self, slot)) for slot in self.__slots__)
        return "%s(%s)" % (self.__class__.__name__, vs)

    def tuple(self):
        return tuple(getattr(self, slot) for slot in self.__slots__)

    def __eq__(self, other):
        if not hasattr(other, "tuple"):
            raise ValueError("Can't compare %r with %r" % (self, other))
        return self.tuple() == other.tuple()

    def __lt__(self, other):
        if not hasattr(other, "tuple"):
            raise ValueError("Can't compare %r with %r" % (self, other))
        return self.tuple() < other.tuple()

    # It's dumb that you have to define these

    def __gt__(self, other):
        if not hasattr(other, "tuple"):
            raise ValueError("Can't compare %r with %r" % (self, other))
        return self.tuple() > other.tuple()

    def __ge__(self, other):
        if not hasattr(other, "tuple"):
            raise ValueError("Can't compare %r with %r" % (self, other))
        return self.tuple() >= other.tuple()

    def __le__(self, other):
        if not hasattr(other, "tuple"):
            raise ValueError("Can't compare %r with %r" % (self, other))
        return self.tuple() <= other.tuple()

    def __ne__(self, other):
        if not hasattr(other, "tuple"):
            raise ValueError("Can't compare %r with %r" % (self, other))
        return self.tuple() != other.tuple()


class SimpleVersion(BaseVersion):
    """An object that parses version numbers such as::

        12.2.5b

    The filter supports a limited subset of PEP 386 versions including::

        1
        1.2
        1.2c
        1.2c3
        1.2.3
        1.2.3a
        1.2.3b4
        10.7.5rc1
        999.999.999c999
    """

    _version_exp = rcompile(r"""
    ^
    (?P<major>\d{1,4})
    (
        [.](?P<minor>\d{1,4})
        (
            [.](?P<release>\d{1,4})
        )?
        (
            (?P<ex>[abc]|rc)
            (?P<exnum>\d{1,4})?
        )?
    )?
    $
    """, verbose=True)

    # (groupid, method, skippable, default)
    _parts = [("major", int),
              ("minor", int),
              ("release", int),
              ("ex", str),
              ("exnum", int),
              ]

    _ex_bits = {"a": 0, "b": 1, "c": 2, "rc": 10, "z": 15}
    _bits_ex = dict((v, k) for k, v in _ex_bits.items())

    __slots__ = ("major", "minor", "release", "ex", "exnum")

    def __init__(self, major=1, minor=0, release=0, ex="z", exnum=0):
        self.major = major
        self.minor = minor
        self.release = release
        self.ex = ex
        self.exnum = exnum

    def to_int(self):
        assert self.major < 1024
        n = self.major << 34

        assert self.minor < 1024
        n |= self.minor << 24

        assert self.release < 1024
        n |= self.release << 14

        exbits = self._ex_bits.get(self.ex, 15)
        n |= exbits << 10

        assert self.exnum < 1024
        n |= self.exnum

        return n

    @classmethod
    def from_int(cls, n):
        major = (n & (1023 << 34)) >> 34
        minor = (n & (1023 << 24)) >> 24
        release = (n & (1023 << 14)) >> 14
        exbits = (n & (7 << 10)) >> 10
        ex = cls._bits_ex.get(exbits, "z")
        exnum = n & 1023

        return cls(major, minor, release, ex, exnum)
