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

from array import array

from whoosh.compat import array_tobytes, xrange


# Varint cache

# Build a cache of the varint byte sequences for the first N integers, so we
# don't have to constantly recalculate them on the fly. This makes a small but
# noticeable difference.

def _varint(i):
    a = array("B")
    while (i & ~0x7F) != 0:
        a.append((i & 0x7F) | 0x80)
        i = i >> 7
    a.append(i)
    return array_tobytes(a)


_varint_cache_size = 512
_varint_cache = []
for i in xrange(0, _varint_cache_size):
    _varint_cache.append(_varint(i))
_varint_cache = tuple(_varint_cache)


def varint(i):
    """Encodes the given integer into a string of the minimum number  of bytes.
    """
    if i < len(_varint_cache):
        return _varint_cache[i]
    return _varint(i)


def varint_to_int(vi):
    b = ord(vi[0])
    p = 1
    i = b & 0x7f
    shift = 7
    while b & 0x80 != 0:
        b = ord(vi[p])
        p += 1
        i |= (b & 0x7F) << shift
        shift += 7
    return i


def signed_varint(i):
    """Zig-zag encodes a signed integer into a varint.
    """

    if i >= 0:
        return varint(i << 1)
    return varint((i << 1) ^ (~0))


def decode_signed_varint(i):
    """Zig-zag decodes an integer value.
    """

    if not i & 1:
        return i >> 1
    return (i >> 1) ^ (~0)


def read_varint(readfn):
    """
    Reads a variable-length encoded integer.

    :param readfn: a callable that reads a given number of bytes,
        like file.read().
    """

    b = ord(readfn(1))
    i = b & 0x7F

    shift = 7
    while b & 0x80 != 0:
        b = ord(readfn(1))
        i |= (b & 0x7F) << shift
        shift += 7
    return i
