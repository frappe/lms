# Copyright 2009 Matt Chaput. All rights reserved.
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
from copy import copy
from struct import calcsize

from whoosh.compat import BytesIO, bytes_type
from whoosh.compat import dump as dump_pickle
from whoosh.compat import load as load_pickle
from whoosh.compat import array_frombytes, array_tobytes
from whoosh.system import _INT_SIZE, _SHORT_SIZE, _FLOAT_SIZE, _LONG_SIZE
from whoosh.system import IS_LITTLE
from whoosh.system import pack_byte, unpack_byte, pack_sbyte, unpack_sbyte
from whoosh.system import pack_ushort, unpack_ushort
from whoosh.system import pack_ushort_le, unpack_ushort_le
from whoosh.system import pack_int, unpack_int, pack_uint, unpack_uint
from whoosh.system import pack_uint_le, unpack_uint_le
from whoosh.system import pack_long, unpack_long, pack_ulong, unpack_ulong
from whoosh.system import pack_float, unpack_float
from whoosh.util.varints import varint, read_varint
from whoosh.util.varints import signed_varint, decode_signed_varint


_SIZEMAP = dict((typecode, calcsize(typecode)) for typecode in "bBiIhHqQf")
_ORDERMAP = {"little": "<", "big": ">"}

_types = (("sbyte", "b"), ("ushort", "H"), ("int", "i"),
          ("long", "q"), ("float", "f"))


# Main function

class StructFile(object):
    """Returns a "structured file" object that wraps the given file object and
    provides numerous additional methods for writing structured data, such as
    "write_varint" and "write_long".
    """

    def __init__(self, fileobj, name=None, onclose=None):
        self.file = fileobj
        self._name = name
        self.onclose = onclose
        self.is_closed = False

        self.is_real = hasattr(fileobj, "fileno")
        if self.is_real:
            self.fileno = fileobj.fileno

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self._name)

    def __str__(self):
        return self._name

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __iter__(self):
        return iter(self.file)

    def raw_file(self):
        return self.file

    def read(self, *args, **kwargs):
        return self.file.read(*args, **kwargs)

    def readline(self, *args, **kwargs):
        return self.file.readline(*args, **kwargs)

    def write(self, *args, **kwargs):
        return self.file.write(*args, **kwargs)

    def tell(self, *args, **kwargs):
        return self.file.tell(*args, **kwargs)

    def seek(self, *args, **kwargs):
        return self.file.seek(*args, **kwargs)

    def truncate(self, *args, **kwargs):
        return self.file.truncate(*args, **kwargs)

    def flush(self):
        """Flushes the buffer of the wrapped file. This is a no-op if the
        wrapped file does not have a flush method.
        """

        if hasattr(self.file, "flush"):
            self.file.flush()

    def close(self):
        """Closes the wrapped file.
        """

        if self.is_closed:
            raise Exception("This file is already closed")
        if self.onclose:
            self.onclose(self)
        if hasattr(self.file, "close"):
            self.file.close()
        self.is_closed = True

    def subset(self, offset, length, name=None):
        from whoosh.filedb.compound import SubFile

        name = name or self._name
        return StructFile(SubFile(self.file, offset, length), name=name)

    def write_string(self, s):
        """Writes a string to the wrapped file. This method writes the length
        of the string first, so you can read the string back without having to
        know how long it was.
        """
        self.write_varint(len(s))
        self.write(s)

    def write_string2(self, s):
        self.write(pack_ushort(len(s)) + s)

    def write_string4(self, s):
        self.write(pack_int(len(s)) + s)

    def read_string(self):
        """Reads a string from the wrapped file.
        """
        return self.read(self.read_varint())

    def read_string2(self):
        l = self.read_ushort()
        return self.read(l)

    def read_string4(self):
        l = self.read_int()
        return self.read(l)

    def get_string2(self, pos):
        l = self.get_ushort(pos)
        base = pos + _SHORT_SIZE
        return self.get(base, l), base + l

    def get_string4(self, pos):
        l = self.get_int(pos)
        base = pos + _INT_SIZE
        return self.get(base, l), base + l

    def skip_string(self):
        l = self.read_varint()
        self.seek(l, 1)

    def write_varint(self, i):
        """Writes a variable-length unsigned integer to the wrapped file.
        """
        self.write(varint(i))

    def write_svarint(self, i):
        """Writes a variable-length signed integer to the wrapped file.
        """
        self.write(signed_varint(i))

    def read_varint(self):
        """Reads a variable-length encoded unsigned integer from the wrapped
        file.
        """
        return read_varint(self.read)

    def read_svarint(self):
        """Reads a variable-length encoded signed integer from the wrapped
        file.
        """
        return decode_signed_varint(read_varint(self.read))

    def write_tagint(self, i):
        """Writes a sometimes-compressed unsigned integer to the wrapped file.
        This is similar to the varint methods but uses a less compressed but
        faster format.
        """

        # Store numbers 0-253 in one byte. Byte 254 means "an unsigned 16-bit
        # int follows." Byte 255 means "An unsigned 32-bit int follows."
        if i <= 253:
            self.write(chr(i))
        elif i <= 65535:
            self.write("\xFE" + pack_ushort(i))
        else:
            self.write("\xFF" + pack_uint(i))

    def read_tagint(self):
        """Reads a sometimes-compressed unsigned integer from the wrapped file.
        This is similar to the varint methods but uses a less compressed but
        faster format.
        """

        tb = ord(self.read(1))
        if tb == 254:
            return self.read_ushort()
        elif tb == 255:
            return self.read_uint()
        else:
            return tb

    def write_byte(self, n):
        """Writes a single byte to the wrapped file, shortcut for
        ``file.write(chr(n))``.
        """
        self.write(pack_byte(n))

    def read_byte(self):
        return ord(self.read(1))

    def write_pickle(self, obj, protocol=-1):
        """Writes a pickled representation of obj to the wrapped file.
        """
        dump_pickle(obj, self.file, protocol)

    def read_pickle(self):
        """Reads a pickled object from the wrapped file.
        """
        return load_pickle(self.file)

    def write_sbyte(self, n):
        self.write(pack_sbyte(n))

    def write_int(self, n):
        self.write(pack_int(n))

    def write_uint(self, n):
        self.write(pack_uint(n))

    def write_uint_le(self, n):
        self.write(pack_uint_le(n))

    def write_ushort(self, n):
        self.write(pack_ushort(n))

    def write_ushort_le(self, n):
        self.write(pack_ushort_le(n))

    def write_long(self, n):
        self.write(pack_long(n))

    def write_ulong(self, n):
        self.write(pack_ulong(n))

    def write_float(self, n):
        self.write(pack_float(n))

    def write_array(self, arry):
        if IS_LITTLE:
            arry = copy(arry)
            arry.byteswap()
        if self.is_real:
            arry.tofile(self.file)
        else:
            self.write(array_tobytes(arry))

    def read_sbyte(self):
        return unpack_sbyte(self.read(1))[0]

    def read_int(self):
        return unpack_int(self.read(_INT_SIZE))[0]

    def read_uint(self):
        return unpack_uint(self.read(_INT_SIZE))[0]

    def read_uint_le(self):
        return unpack_uint_le(self.read(_INT_SIZE))[0]

    def read_ushort(self):
        return unpack_ushort(self.read(_SHORT_SIZE))[0]

    def read_ushort_le(self):
        return unpack_ushort_le(self.read(_SHORT_SIZE))[0]

    def read_long(self):
        return unpack_long(self.read(_LONG_SIZE))[0]

    def read_ulong(self):
        return unpack_ulong(self.read(_LONG_SIZE))[0]

    def read_float(self):
        return unpack_float(self.read(_FLOAT_SIZE))[0]

    def read_array(self, typecode, length):
        a = array(typecode)
        if self.is_real:
            a.fromfile(self.file, length)
        else:
            array_frombytes(a, self.read(length * _SIZEMAP[typecode]))
        if IS_LITTLE:
            a.byteswap()
        return a

    def get(self, position, length):
        self.seek(position)
        return self.read(length)

    def get_byte(self, position):
        return unpack_byte(self.get(position, 1))[0]

    def get_sbyte(self, position):
        return unpack_sbyte(self.get(position, 1))[0]

    def get_int(self, position):
        return unpack_int(self.get(position, _INT_SIZE))[0]

    def get_uint(self, position):
        return unpack_uint(self.get(position, _INT_SIZE))[0]

    def get_ushort(self, position):
        return unpack_ushort(self.get(position, _SHORT_SIZE))[0]

    def get_long(self, position):
        return unpack_long(self.get(position, _LONG_SIZE))[0]

    def get_ulong(self, position):
        return unpack_ulong(self.get(position, _LONG_SIZE))[0]

    def get_float(self, position):
        return unpack_float(self.get(position, _FLOAT_SIZE))[0]

    def get_array(self, position, typecode, length):
        self.seek(position)
        return self.read_array(typecode, length)


class BufferFile(StructFile):
    def __init__(self, buf, name=None, onclose=None):
        self._buf = buf
        self._name = name
        self.file = BytesIO(buf)
        self.onclose = onclose

        self.is_real = False
        self.is_closed = False

    def subset(self, position, length, name=None):
        name = name or self._name
        return BufferFile(self.get(position, length), name=name)

    def get(self, position, length):
        return bytes_type(self._buf[position:position + length])

    def get_array(self, position, typecode, length):
        a = array(typecode)
        array_frombytes(a, self.get(position, length * _SIZEMAP[typecode]))
        if IS_LITTLE:
            a.byteswap()
        return a


class ChecksumFile(StructFile):
    def __init__(self, *args, **kwargs):
        StructFile.__init__(self, *args, **kwargs)
        self._check = 0
        self._crc32 = __import__("zlib").crc32

    def __iter__(self):
        for line in self.file:
            self._check = self._crc32(line, self._check)
            yield line

    def seek(self, *args):
        raise Exception("Cannot seek on a ChecksumFile")

    def read(self, *args, **kwargs):
        b = self.file.read(*args, **kwargs)
        self._check = self._crc32(b, self._check)
        return b

    def write(self, b):
        self._check = self._crc32(b, self._check)
        self.file.write(b)

    def checksum(self):
        return self._check & 0xffffffff
