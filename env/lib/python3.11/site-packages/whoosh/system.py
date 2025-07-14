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

import sys
from struct import Struct, calcsize


IS_LITTLE = sys.byteorder == "little"

_INT_SIZE = calcsize("!i")
_SHORT_SIZE = calcsize("!H")
_LONG_SIZE = calcsize("!Q")
_FLOAT_SIZE = calcsize("!f")
_DOUBLE_SIZE = calcsize("!d")

_byte_struct = Struct("!B")
_sbyte_struct = Struct("!b")
_ushort_struct = Struct("!H")
_int_struct = Struct("!i")
_uint_struct = Struct("!I")
_long_struct = Struct("!q")
_ulong_struct = Struct("!Q")
_float_struct = Struct("!f")
_double_struct = Struct("!d")
_ushort_le_struct = Struct("<H")
_uint_le_struct = Struct("<I")

pack_byte = _byte_struct.pack
pack_sbyte = _sbyte_struct.pack
pack_ushort = _ushort_struct.pack
pack_int = _int_struct.pack
pack_uint = _uint_struct.pack
pack_long = _long_struct.pack
pack_ulong = _ulong_struct.pack
pack_float = _float_struct.pack
pack_double = _double_struct.pack
pack_ushort_le = _ushort_le_struct.pack
pack_uint_le = _uint_le_struct.pack

unpack_byte = _byte_struct.unpack  # ord() might be faster
unpack_sbyte = _sbyte_struct.unpack
unpack_ushort = _ushort_struct.unpack
unpack_int = _int_struct.unpack
unpack_uint = _uint_struct.unpack
unpack_long = _long_struct.unpack
unpack_ulong = _ulong_struct.unpack
unpack_float = _float_struct.unpack
unpack_double = _double_struct.unpack
unpack_ushort_le = _ushort_le_struct.unpack
unpack_uint_le = _uint_le_struct.unpack

if sys.version_info[0] < 3:
    emptybytes = ""
else:
    emptybytes = "".encode("latin-1")
