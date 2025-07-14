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

import math, struct
from array import array
from bisect import bisect_left
from struct import pack, unpack

from whoosh.compat import b, long_type
from whoosh.system import pack_byte, unpack_byte, pack_ushort, unpack_ushort
from whoosh.system import pack_int, unpack_int, pack_uint, unpack_uint
from whoosh.system import pack_long, unpack_long, pack_ulong, unpack_ulong
from whoosh.system import pack_float, unpack_float, pack_double, unpack_double


NaN = struct.unpack("<d", b('\xff\xff\xff\xff\xff\xff\xff\xff'))[0]

typecode_max = {"b": 127, "B": 255, "h": 2 ** 15 - 1, "H": 2 ** 16 - 1,
                "i": 2 ** 31 - 1, "I": 2 ** 32 - 1,
                "q": 2 ** 63 - 1, "Q": 2 ** 64 - 1}
typecode_min = {"b": 0 - 128, "B": 0, "h": 0 - 2 ** 15, "H": 0,
                "i": 0 - 2 ** 31, "I": 0,
                "q": 0 - 2 ** 63, "Q": 0}
typecode_pack = {"B": pack_byte, "H": pack_ushort, "i": pack_int,
                 "I": pack_uint, "q": pack_long, "Q": pack_ulong,
                 "f": pack_float, "d": pack_double}
typecode_unpack = {"B": unpack_byte, "H": unpack_ushort, "i": unpack_int,
                   "I": unpack_uint, "q": unpack_long, "Q": unpack_ulong,
                   "f": unpack_float, "d": unpack_double}


# Functions related to binary representations

def bits_required(maxnum):
    """Returns the number of bits required to represent the given (unsigned)
    integer.
    """

    return max(1, math.ceil(math.log(maxnum, 2)))


def typecode_required(maxnum):
    if maxnum < 256:
        return "B"
    elif maxnum < 2 ** 16:
        return "H"
    elif maxnum < 2 ** 31 - 1:
        return "i"
    elif maxnum < 2 ** 32:
        return "I"
    elif maxnum < 2 ** 63 - 1:
        return "q"
    else:
        return "Q"


def max_value(bitcount):
    """Returns the maximum (unsigned) integer representable in the given number
    of bits.
    """

    return ~(~0 << bitcount)


def bytes_for_bits(bitcount):
    r = int(math.ceil((bitcount + 1) / 8.0))
    return r


# Functions for converting numbers to and from sortable representations

_istruct = struct.Struct(">i")
_qstruct = struct.Struct(">q")
_dstruct = struct.Struct(">d")
_ipack, _iunpack = _istruct.pack, _istruct.unpack
_qpack, _qunpack = _qstruct.pack, _qstruct.unpack
_dpack, _dunpack = _dstruct.pack, _dstruct.unpack


def to_sortable(numtype, intsize, signed, x):
    if numtype is int or numtype is long_type:
        if signed:
            x += (1 << intsize - 1)
        return x
    else:
        return float_to_sortable_long(x, signed)


def from_sortable(numtype, intsize, signed, x):
    if numtype is int or numtype is long_type:
        if signed:
            x -= (1 << intsize - 1)
        return x
    else:
        return sortable_long_to_float(x, signed)


def float_to_sortable_long(x, signed):
    x = _qunpack(_dpack(x))[0]
    if x < 0:
        x ^= 0x7fffffffffffffff
    if signed:
        x += 1 << 63
    assert x >= 0
    return x


def sortable_long_to_float(x, signed):
    if signed:
        x -= 1 << 63
    if x < 0:
        x ^= 0x7fffffffffffffff
    x = _dunpack(_qpack(x))[0]
    return x


# Functions for generating tiered ranges

def split_ranges(intsize, step, start, end):
    """Splits a range of numbers (from ``start`` to ``end``, inclusive)
    into a sequence of trie ranges of the form ``(start, end, shift)``. The
    consumer of these tuples is expected to shift the ``start`` and ``end``
    right by ``shift``.

    This is used for generating term ranges for a numeric field. The queries
    for the edges of the range are generated at high precision and large blocks
    in the middle are generated at low precision.
    """

    shift = 0
    while True:
        diff = 1 << (shift + step)
        mask = ((1 << step) - 1) << shift
        setbits = lambda x: x | ((1 << shift) - 1)

        haslower = (start & mask) != 0
        hasupper = (end & mask) != mask

        not_mask = ~mask & ((1 << intsize + 1) - 1)
        nextstart = (start + diff if haslower else start) & not_mask
        nextend = (end - diff if hasupper else end) & not_mask

        if shift + step >= intsize or nextstart > nextend:
            yield (start, setbits(end), shift)
            break

        if haslower:
            yield (start, setbits(start | mask), shift)
        if hasupper:
            yield (end & not_mask, setbits(end), shift)

        start = nextstart
        end = nextend
        shift += step


def tiered_ranges(numtype, intsize, signed, start, end, shift_step,
                  startexcl, endexcl):
    assert numtype in (int, float)
    assert intsize in (8, 16, 32, 64)

    # Convert start and end values to sortable ints
    if start is None:
        start = 0
    else:
        start = to_sortable(numtype, intsize, signed, start)
        if startexcl:
            start += 1

    if end is None:
        end = 2 ** intsize - 1
    else:
        end = to_sortable(numtype, intsize, signed, end)
        if endexcl:
            end -= 1

    if not shift_step:
        return ((start, end, 0),)

    # Yield (rstart, rend, shift) ranges for the different resolutions
    return split_ranges(intsize, shift_step, start, end)


# Float-to-byte encoding/decoding

def float_to_byte(value, mantissabits=5, zeroexp=2):
    """Encodes a floating point number in a single byte.
    """

    # Assume int size == float size

    fzero = (63 - zeroexp) << mantissabits
    bits = unpack("i", pack("f", value))[0]
    smallfloat = bits >> (24 - mantissabits)
    if smallfloat < fzero:
        # Map negative numbers and 0 to 0
        # Map underflow to next smallest non-zero number
        if bits <= 0:
            result = chr(0)
        else:
            result = chr(1)
    elif smallfloat >= fzero + 0x100:
        # Map overflow to largest number
        result = chr(255)
    else:
        result = chr(smallfloat - fzero)
    return b(result)


def byte_to_float(b, mantissabits=5, zeroexp=2):
    """Decodes a floating point number stored in a single byte.
    """
    if type(b) is not int:
        b = ord(b)
    if b == 0:
        return 0.0

    bits = (b & 0xff) << (24 - mantissabits)
    bits += (63 - zeroexp) << 24
    return unpack("f", pack("i", bits))[0]


# Length-to-byte approximation functions

# Old implementation:

#def length_to_byte(length):
#    """Returns a logarithmic approximation of the given number, in the range
#    0-255. The approximation has high precision at the low end (e.g.
#    1 -> 0, 2 -> 1, 3 -> 2 ...) and low precision at the high end. Numbers
#    equal to or greater than 108116 all approximate to 255.
#
#    This is useful for storing field lengths, where the general case is small
#    documents and very large documents are more rare.
#    """
#
#    # This encoding formula works up to 108116 -> 255, so if the length is
#    # equal to or greater than that limit, just return 255.
#    if length >= 108116:
#        return 255
#
#    # The parameters of this formula where chosen heuristically so that low
#    # numbers would approximate closely, and the byte range 0-255 would cover
#    # a decent range of document lengths (i.e. 1 to ~100000).
#    return int(round(log((length / 27.0) + 1, 1.033)))
#def _byte_to_length(n):
#    return int(round((pow(1.033, n) - 1) * 27))
#_b2l_cache = array("i", (_byte_to_length(i) for i in xrange(256)))
#byte_to_length = _b2l_cache.__getitem__

# New implementation

# Instead of computing the actual formula to get the byte for any given length,
# precompute the length associated with each byte, and use bisect to find the
# nearest value. This gives quite a large speed-up.
#
# Note that this does not give all the same answers as the old, "real"
# implementation since this implementation always "rounds down" (thanks to the
# bisect_left) while the old implementation would "round up" or "round down"
# depending on the input. Since this is a fairly gross approximation anyway,
# I don't think it matters much.

# Values generated using the formula from the "old" implementation above
_length_byte_cache = array('i', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14,
16, 17, 18, 20, 21, 23, 25, 26, 28, 30, 32, 34, 36, 38, 40, 42, 45, 47, 49, 52,
54, 57, 60, 63, 66, 69, 72, 75, 79, 82, 86, 89, 93, 97, 101, 106, 110, 114,
119, 124, 129, 134, 139, 145, 150, 156, 162, 169, 175, 182, 189, 196, 203, 211,
219, 227, 235, 244, 253, 262, 271, 281, 291, 302, 313, 324, 336, 348, 360, 373,
386, 399, 414, 428, 443, 459, 475, 491, 508, 526, 544, 563, 583, 603, 623, 645,
667, 690, 714, 738, 763, 789, 816, 844, 873, 903, 933, 965, 998, 1032, 1066,
1103, 1140, 1178, 1218, 1259, 1302, 1345, 1391, 1438, 1486, 1536, 1587, 1641,
1696, 1753, 1811, 1872, 1935, 1999, 2066, 2135, 2207, 2280, 2356, 2435, 2516,
2600, 2687, 2777, 2869, 2965, 3063, 3165, 3271, 3380, 3492, 3608, 3728, 3852,
3980, 4112, 4249, 4390, 4536, 4686, 4842, 5002, 5168, 5340, 5517, 5700, 5889,
6084, 6286, 6494, 6709, 6932, 7161, 7398, 7643, 7897, 8158, 8428, 8707, 8995,
9293, 9601, 9918, 10247, 10586, 10936, 11298, 11671, 12057, 12456, 12868,
13294, 13733, 14187, 14656, 15141, 15641, 16159, 16693, 17244, 17814, 18403,
19011, 19640, 20289, 20959, 21652, 22367, 23106, 23869, 24658, 25472, 26314,
27183, 28081, 29009, 29967, 30957, 31979, 33035, 34126, 35254, 36418, 37620,
38863, 40146, 41472, 42841, 44256, 45717, 47227, 48786, 50397, 52061, 53780,
55556, 57390, 59285, 61242, 63264, 65352, 67510, 69739, 72041, 74419, 76876,
79414, 82035, 84743, 87541, 90430, 93416, 96499, 99684, 102975, 106374])


def length_to_byte(length):
    if length is None:
        return 0
    if length >= 106374:
        return 255
    else:
        return bisect_left(_length_byte_cache, length)

byte_to_length = _length_byte_cache.__getitem__
