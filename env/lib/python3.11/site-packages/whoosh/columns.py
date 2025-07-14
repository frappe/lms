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

"""
The API and implementation of columns may change in the next version of Whoosh!

This module contains "Column" objects which you can use as the argument to a
Field object's ``sortable=`` keyword argument. Each field defines a default
column type for when the user specifies ``sortable=True`` (the object returned
by the field's ``default_column()`` method).

The default column type for most fields is ``VarBytesColumn``,
although numeric and date fields use ``NumericColumn``. Expert users may use
other field types that may be faster or more storage efficient based on the
field contents. For example, if a field always contains one of a limited number
of possible values, a ``RefBytesColumn`` will save space by only storing the
values once. If a field's values are always a fixed length, the
``FixedBytesColumn`` saves space by not storing the length of each value.

A ``Column`` object basically exists to store configuration information and
provides two important methods: ``writer()`` to return a ``ColumnWriter`` object
and ``reader()`` to return a ``ColumnReader`` object.
"""

from __future__ import division, with_statement
import struct, warnings
from array import array
from bisect import bisect_right

try:
    import zlib
except ImportError:
    zlib = None

from whoosh.compat import b, bytes_type, BytesIO
from whoosh.compat import array_tobytes, xrange
from whoosh.compat import dumps, loads
from whoosh.filedb.structfile import StructFile
from whoosh.idsets import BitSet, OnDiskBitSet
from whoosh.system import emptybytes
from whoosh.util.cache import lru_cache
from whoosh.util.numeric import typecode_max, typecode_min
from whoosh.util.numlists import GrowableArray
from whoosh.util.varints import varint, read_varint


# Utility functions

def _mintype(maxn):
    if maxn < 2 ** 8:
        typecode = "B"
    elif maxn < 2 ** 16:
        typecode = "H"
    elif maxn < 2 ** 31:
        typecode = "i"
    else:
        typecode = "I"

    return typecode


# Python does not support arrays of long long see Issue 1172711
# These functions help write/read a simulated an array of q/Q using lists

def write_qsafe_array(typecode, arry, dbfile):
    if typecode == "q":
        for num in arry:
            dbfile.write_long(num)
    elif typecode == "Q":
        for num in arry:
            dbfile.write_ulong(num)
    else:
        dbfile.write_array(arry)


def read_qsafe_array(typecode, size, dbfile):
    if typecode == "q":
        arry = [dbfile.read_long() for _ in xrange(size)]
    elif typecode == "Q":
        arry = [dbfile.read_ulong() for _ in xrange(size)]
    else:
        arry = dbfile.read_array(typecode, size)

    return arry


def make_array(typecode, size=0, default=None):
    if typecode.lower() == "q":
        # Python does not support arrays of long long see Issue 1172711
        if default is not None and size:
            arry = [default] * size
        else:
            arry = []
    else:
        if default is not None and size:
            arry = array(typecode, (default for _ in xrange(size)))
        else:
            arry = array(typecode)
    return arry


# Base classes

class Column(object):
    """Represents a "column" of rows mapping docnums to document values.

    The interface requires that you store the start offset of the column, the
    length of the column data, and the number of documents (rows) separately,
    and pass them to the reader object.
    """

    reversible = False

    def writer(self, dbfile):
        """Returns a :class:`ColumnWriter` object you can use to use to create
        a column of this type on disk.

        :param dbfile: the :class:`~whoosh.filedb.structfile.StructFile` to
            write to.
        """

        return self.Writer(dbfile)

    def reader(self, dbfile, basepos, length, doccount):
        """Returns a :class:`ColumnReader` object you can use to read a column
        of this type from disk.

        :param dbfile: the :class:`~whoosh.filedb.structfile.StructFile` to
            read from.
        :param basepos: the offset within the file at which the column starts.
        :param length: the length in bytes of the column occupies in the file.
        :param doccount: the number of rows (documents) in the column.
        """

        return self.Reader(dbfile, basepos, length, doccount)

    def default_value(self, reverse=False):
        """Returns the default value for this column type.
        """

        return self._default

    def stores_lists(self):
        """Returns True if the column stores a list of values for each document
        instead of a single value.
        """

        return False


class ColumnWriter(object):
    def __init__(self, dbfile):
        self._dbfile = dbfile
        self._count = 0

    def fill(self, docnum):
        write = self._dbfile.write
        default = self._defaultbytes
        if docnum > self._count:
            for _ in xrange(docnum - self._count):
                write(default)

    def add(self, docnum, value):
        raise NotImplementedError

    def finish(self, docnum):
        pass


class ColumnReader(object):
    def __init__(self, dbfile, basepos, length, doccount):
        self._dbfile = dbfile
        self._basepos = basepos
        self._length = length
        self._doccount = doccount

    def __len__(self):
        return self._doccount

    def __getitem__(self, docnum):
        raise NotImplementedError

    def sort_key(self, docnum):
        return self[docnum]

    def __iter__(self):
        for i in xrange(self._doccount):
            yield self[i]

    def load(self):
        return list(self)

    def set_reverse(self):
        raise NotImplementedError


# Arbitrary bytes column

class VarBytesColumn(Column):
    """Stores variable length byte strings. See also :class:`RefBytesColumn`.

    The current implementation limits the total length of all document values
    a segment to 2 GB.

    The default value (the value returned for a document that didn't have a
    value assigned to it at indexing time) is an empty bytestring (``b''``).
    """

    _default = emptybytes

    def __init__(self, allow_offsets=True, write_offsets_cutoff=2**15):
        """
        :param allow_offsets: Whether the column should write offsets when there
            are many rows in the column (this makes opening the column much
            faster). This argument is mostly for testing.
        :param write_offsets_cutoff: Write offsets (for speed) when there are
            more than this many rows in the column. This argument is mostly
            for testing.
        """

        self.allow_offsets = allow_offsets
        self.write_offsets_cutoff = write_offsets_cutoff

    def writer(self, dbfile):
        return self.Writer(dbfile, self.allow_offsets,
                           self.write_offsets_cutoff)

    class Writer(ColumnWriter):
        def __init__(self, dbfile, allow_offsets=True, cutoff=2**15):
            assert isinstance(dbfile, StructFile)
            self._dbfile = dbfile
            self._count = 0
            self._lengths = GrowableArray(allow_longs=False)
            self._offsets = GrowableArray(allow_longs=False)
            self._offset_base = 0
            self.allow_offsets = allow_offsets
            self.cutoff = cutoff

        def __repr__(self):
            return "<VarBytes.Writer>"

        def fill(self, docnum):
            base = self._offset_base
            if docnum > self._count:
                self._lengths.extend(0 for _ in xrange(docnum - self._count))
                self._offsets.extend(base for _ in xrange(docnum - self._count))

        def add(self, docnum, v):
            self.fill(docnum)
            self._dbfile.write(v)
            self._lengths.append(len(v))
            self._offsets.append(self._offset_base)
            self._offset_base += len(v)
            self._count = docnum + 1

        def finish(self, doccount):
            dbfile = self._dbfile
            lengths = self._lengths.array
            offsets = self._offsets.array
            self.fill(doccount)

            dbfile.write_array(lengths)

            # Only write the offsets if there is a large number of items in the
            # column, otherwise it's fast enough to derive them from the lens
            write_offsets = self.allow_offsets and doccount > self.cutoff
            if write_offsets:
                dbfile.write_array(offsets)

            # Backwards compatibility: previous versions only wrote the lengths,
            # and the last byte of the column was the lengths type code...
            dbfile.write(lengths.typecode.encode("ascii"))
            # ...but if we wrote offsets, make the last byte "X" so we know
            if write_offsets:
                dbfile.write(offsets.typecode.encode("ascii"))
                dbfile.write("X".encode("ascii"))

    class Reader(ColumnReader):
        def __init__(self, dbfile, basepos, length, doccount):
            self._dbfile = dbfile
            self._basepos = basepos
            self._length = length
            self._doccount = doccount

            self.had_stored_offsets = False  # for testing
            self._read_offsets_and_lengths()

        def __repr__(self):
            return "<VarBytes.Reader>"

        def _read_offsets_and_lengths(self):
            dbfile = self._dbfile
            basepos = self._basepos
            length = self._length
            doccount = self._doccount

            # The end of the lengths array is the end of the data minus the
            # typecode byte
            lastbyte = basepos + length - 1
            # Load the length typecode from the end
            lens_code = chr(dbfile.get_byte(lastbyte))

            offsets = None
            if lens_code == "X":
                self.had_stored_offsets = True
                # This indicates we wrote the offsets, so get the real lengths
                # type code
                lens_code = chr(dbfile.get_byte(lastbyte - 2))
                offsets_code = chr(dbfile.get_byte(lastbyte - 1))

                # Read the offsets from before the last byte
                itemsize = struct.calcsize(offsets_code)
                offsetstart = (lastbyte - 2) - doccount * itemsize
                offsets = dbfile.get_array(offsetstart, offsets_code, doccount)
                lastbyte = offsetstart

            # Load the length array
            itemsize = struct.calcsize(lens_code)
            lenstart = lastbyte - (itemsize * doccount)
            lengths = dbfile.get_array(lenstart, lens_code, doccount)

            # If we didn't write the offsets, derive them from the lengths
            if offsets is None:
                offsets = array("L")
                base = 0
                for length in lengths:
                    offsets.append(base)
                    base += length

            self._offsets = offsets
            self._lengths = lengths

        def __getitem__(self, docnum):
            length = self._lengths[docnum]
            if not length:
                return emptybytes
            offset = self._offsets[docnum]
            return self._dbfile.get(self._basepos + offset, length)

        def __iter__(self):
            get = self._dbfile.get
            pos = self._basepos
            for length in self._lengths:
                yield get(pos, length)
                pos += length


class FixedBytesColumn(Column):
    """Stores fixed-length byte strings.
    """

    def __init__(self, fixedlen, default=None):
        """
        :param fixedlen: the fixed length of byte strings in this column.
        :param default: the default value to use for documents that don't
            specify a value. If you don't specify a default, the column will
            use ``b'\\x00' * fixedlen``.
        """

        self._fixedlen = fixedlen

        if default is None:
            default = b("\x00") * fixedlen
        elif len(default) != fixedlen:
            raise ValueError
        self._default = default

    def writer(self, dbfile):
        return self.Writer(dbfile, self._fixedlen, self._default)

    def reader(self, dbfile, basepos, length, doccount):
        return self.Reader(dbfile, basepos, length, doccount, self._fixedlen,
                           self._default)

    class Writer(ColumnWriter):
        def __init__(self, dbfile, fixedlen, default):
            self._dbfile = dbfile
            self._fixedlen = fixedlen
            self._default = self._defaultbytes = default
            self._count = 0

        def __repr__(self):
            return "<FixedBytes.Writer>"

        def add(self, docnum, v):
            if v == self._default:
                return
            if docnum > self._count:
                self.fill(docnum)
            assert len(v) == self._fixedlen
            self._dbfile.write(v)
            self._count = docnum + 1

    class Reader(ColumnReader):
        def __init__(self, dbfile, basepos, length, doccount, fixedlen,
                     default):
            self._dbfile = dbfile
            self._basepos = basepos
            self._doccount = doccount
            self._fixedlen = fixedlen
            self._default = self._defaultbytes = default
            self._count = length // fixedlen

        def __repr__(self):
            return "<FixedBytes.Reader>"

        def __getitem__(self, docnum):
            if docnum >= self._count:
                return self._defaultbytes
            pos = self._basepos + self._fixedlen * docnum
            return self._dbfile.get(pos, self._fixedlen)

        def __iter__(self):
            count = self._count
            default = self._default
            for i in xrange(self._doccount):
                if i < count:
                    yield self[i]
                else:
                    yield default


# Variable/fixed length reference (enum) column

class RefBytesColumn(Column):
    """Stores variable-length or fixed-length byte strings, similar to
    :class:`VarBytesColumn` and :class:`FixedBytesColumn`. However, where those
    columns stores a value for each document, this column keeps a list of all
    the unique values in the field, and for each document stores a short
    pointer into the unique list. For fields where the number of possible
    values is smaller than the number of documents (for example,
    "category" or "chapter"), this saves significant space.

    This column type supports a maximum of 65535 unique values across all
    documents in a segment. You should generally use this column type where the
    number of unique values is in no danger of approaching that number (for
    example, a "tags" field). If you try to index too many unique values, the
    column will convert additional unique values to the default value and issue
    a warning using the ``warnings`` module (this will usually be preferable to
    crashing the indexer and potentially losing indexed documents).
    """

    # NOTE that RefBytes is reversible within a single column (we could just
    # negate the reference number), but it's NOT reversible ACROSS SEGMENTS
    # (since different segments can have different uniques values in their
    # columns), so we have to say that the column type is not reversible
    reversible = False

    def __init__(self, fixedlen=0, default=None):
        """
        :param fixedlen: an optional fixed length for the values. If you
            specify a number other than 0, the column will require all values
            to be the specified length.
        :param default: a default value to use for documents that don't specify
            one. If you don't specify a default, the column will use an empty
            bytestring (``b''``), or if you specify a fixed length,
            ``b'\\x00' * fixedlen``.
        """

        self._fixedlen = fixedlen

        if default is None:
            default = b("\x00") * fixedlen if fixedlen else emptybytes
        elif fixedlen and len(default) != fixedlen:
            raise ValueError
        self._default = default

    def writer(self, dbfile):
        return self.Writer(dbfile, self._fixedlen, self._default)

    def reader(self, dbfile, basepos, length, doccount):
        return self.Reader(dbfile, basepos, length, doccount, self._fixedlen)

    class Writer(ColumnWriter):
        def __init__(self, dbfile, fixedlen, default):
            self._dbfile = dbfile
            self._fixedlen = fixedlen
            self._default = default

            # At first we'll buffer refs in a byte array. If the number of
            # uniques stays below 256, we can just write the byte array. As
            # soon as the ref count goes above 255, we know we're going to have
            # to write shorts, so we'll switch to writing directly.
            self._refs = array("B")
            self._uniques = {default: 0}
            self._count = 0

        def __repr__(self):
            return "<RefBytes.Writer>"

        def fill(self, docnum):
            if docnum > self._count:
                if self._refs is not None:
                    self._refs.extend(0 for _ in xrange(docnum - self._count))
                else:
                    dbfile = self._dbfile
                    for _ in xrange(docnum - self._count):
                        dbfile.write_ushort(0)

        def add(self, docnum, v):
            dbfile = self._dbfile
            refs = self._refs
            self.fill(docnum)

            uniques = self._uniques
            try:
                ref = uniques[v]
            except KeyError:
                uniques[v] = ref = len(uniques)
                if refs is not None and ref >= 256:
                    # We won't be able to use bytes, we have to switch to
                    # writing unbuffered ushorts
                    for n in refs:
                        dbfile.write_ushort(n)
                    refs = self._refs = None

            if refs is not None:
                self._refs.append(ref)
            else:
                if ref > 65535:
                    warnings.warn("RefBytesColumn dropped unique value %r" % v,
                                  UserWarning)
                    ref = 0
                dbfile.write_ushort(ref)

            self._count = docnum + 1

        def _write_uniques(self, typecode):
            dbfile = self._dbfile
            fixedlen = self._fixedlen
            uniques = self._uniques

            dbfile.write_varint(len(uniques))
            # Sort unique values by position
            vs = sorted(uniques.keys(), key=lambda key: uniques[key])
            for v in vs:
                if not fixedlen:
                    dbfile.write_varint(len(v))
                dbfile.write(v)

        def finish(self, doccount):
            dbfile = self._dbfile
            refs = self._refs
            self.fill(doccount)

            typecode = "H"
            if refs is not None:
                dbfile.write_array(refs)
                typecode = refs.typecode

            self._write_uniques(typecode)
            dbfile.write_byte(ord(typecode))

    class Reader(ColumnReader):
        def __init__(self, dbfile, basepos, length, doccount, fixedlen):
            self._dbfile = dbfile
            self._basepos = basepos
            self._doccount = doccount
            self._fixedlen = fixedlen

            self._typecode = chr(dbfile.get_byte(basepos + length - 1))

            st = struct.Struct("!" + self._typecode)
            self._unpack = st.unpack
            self._itemsize = st.size

            dbfile.seek(basepos + doccount * self._itemsize)
            self._uniques = self._read_uniques()

        def __repr__(self):
            return "<RefBytes.Reader>"

        def _read_uniques(self):
            dbfile = self._dbfile
            fixedlen = self._fixedlen

            ucount = dbfile.read_varint()
            length = fixedlen
            uniques = []
            for _ in xrange(ucount):
                if not fixedlen:
                    length = dbfile.read_varint()
                uniques.append(dbfile.read(length))
            return uniques

        def __getitem__(self, docnum):
            pos = self._basepos + docnum * self._itemsize
            ref = self._unpack(self._dbfile.get(pos, self._itemsize))[0]
            return self._uniques[ref]

        def __iter__(self):
            get = self._dbfile.get
            basepos = self._basepos
            uniques = self._uniques
            unpack = self._unpack
            itemsize = self._itemsize

            for i in xrange(self._doccount):
                pos = basepos + i * itemsize
                ref = unpack(get(pos, itemsize))[0]
                yield uniques[ref]


# Numeric column

class NumericColumn(FixedBytesColumn):
    """Stores numbers (integers and floats) as compact binary.
    """

    reversible = True

    def __init__(self, typecode, default=0):
        """
        :param typecode: a typecode character (as used by the ``struct``
            module) specifying the number type. For example, ``"i"`` for
            signed integers.
        :param default: the default value to use for documents that don't
            specify one.
        """

        self._typecode = typecode
        self._default = default

    def writer(self, dbfile):
        return self.Writer(dbfile, self._typecode, self._default)

    def reader(self, dbfile, basepos, length, doccount):
        return self.Reader(dbfile, basepos, length, doccount, self._typecode,
                           self._default)

    def default_value(self, reverse=False):
        v = self._default
        if reverse:
            v = 0 - v
        return v

    class Writer(FixedBytesColumn.Writer):
        def __init__(self, dbfile, typecode, default):
            self._dbfile = dbfile
            self._pack = struct.Struct("!" + typecode).pack
            self._default = default
            self._defaultbytes = self._pack(default)
            self._fixedlen = struct.calcsize(typecode)
            self._count = 0

        def __repr__(self):
            return "<Numeric.Writer>"

        def add(self, docnum, v):
            if v == self._default:
                return
            if docnum > self._count:
                self.fill(docnum)
            self._dbfile.write(self._pack(v))
            self._count = docnum + 1

    class Reader(FixedBytesColumn.Reader):
        def __init__(self, dbfile, basepos, length, doccount, typecode,
                     default):
            self._dbfile = dbfile
            self._basepos = basepos
            self._doccount = doccount
            self._default = default
            self._reverse = False

            self._typecode = typecode
            self._unpack = struct.Struct("!" + typecode).unpack
            self._defaultbytes = struct.pack("!" + typecode, default)
            self._fixedlen = struct.calcsize(typecode)
            self._count = length // self._fixedlen

        def __repr__(self):
            return "<Numeric.Reader>"

        def __getitem__(self, docnum):
            s = FixedBytesColumn.Reader.__getitem__(self, docnum)
            return self._unpack(s)[0]

        def sort_key(self, docnum):
            key = self[docnum]
            if self._reverse:
                key = 0 - key
            return key

        def load(self):
            if self._typecode in "qQ":
                return list(self)
            else:
                return array(self._typecode, self)

        def set_reverse(self):
            self._reverse = True


# Column of boolean values

class BitColumn(Column):
    """Stores a column of True/False values compactly.
    """

    reversible = True
    _default = False

    def __init__(self, compress_at=2048):
        """
        :param compress_at: columns with this number of values or fewer will
            be saved compressed on disk, and loaded into RAM for reading. Set
            this to 0 to disable compression.
        """

        self._compressat = compress_at

    def writer(self, dbfile):
        return self.Writer(dbfile, self._compressat)

    def default_value(self, reverse=False):
        return self._default ^ reverse

    class Writer(ColumnWriter):
        def __init__(self, dbfile, compressat):
            self._dbfile = dbfile
            self._compressat = compressat
            self._bitset = BitSet()

        def __repr__(self):
            return "<Bit.Writer>"

        def add(self, docnum, value):
            if value:
                self._bitset.add(docnum)

        def finish(self, doccount):
            dbfile = self._dbfile
            bits = self._bitset.bits

            if zlib and len(bits) <= self._compressat:
                compressed = zlib.compress(array_tobytes(bits), 3)
                dbfile.write(compressed)
                dbfile.write_byte(1)
            else:
                dbfile.write_array(bits)
                dbfile.write_byte(0)

    class Reader(ColumnReader):
        def __init__(self, dbfile, basepos, length, doccount):
            self._dbfile = dbfile
            self._basepos = basepos
            self._length = length
            self._doccount = doccount
            self._reverse = False

            compressed = dbfile.get_byte(basepos + (length - 1))
            if compressed:
                bbytes = zlib.decompress(dbfile.get(basepos, length - 1))
                bitset = BitSet.from_bytes(bbytes)
            else:
                dbfile.seek(basepos)
                bitset = OnDiskBitSet(dbfile, basepos, length - 1)
            self._bitset = bitset

        def id_set(self):
            return self._bitset

        def __repr__(self):
            return "<Bit.Reader>"

        def __getitem__(self, i):
            return i in self._bitset

        def sort_key(self, docnum):
            return int(self[docnum] ^ self._reverse)

        def __iter__(self):
            i = 0
            for num in self._bitset:
                if num > i:
                    for _ in xrange(num - i):
                        yield False
                yield True
                i = num + 1
            if self._doccount > i:
                for _ in xrange(self._doccount - i):
                    yield False

        def load(self):
            if isinstance(self._bitset, OnDiskBitSet):
                bs = self._dbfile.get_array(self._basepos, "B",
                                            self._length - 1)
                self._bitset = BitSet.from_bytes(bs)
            return self

        def set_reverse(self):
            self._reverse = True


# Compressed variants

class CompressedBytesColumn(Column):
    """Stores variable-length byte strings compressed using deflate (by
    default).
    """

    def __init__(self, level=3, module="zlib"):
        """
        :param level: the compression level to use.
        :param module: a string containing the name of the compression module
            to use. The default is "zlib". The module should export "compress"
            and "decompress" functions.
        """

        self._level = level
        self._module = module

    def writer(self, dbfile):
        return self.Writer(dbfile, self._level, self._module)

    def reader(self, dbfile, basepos, length, doccount):
        return self.Reader(dbfile, basepos, length, doccount, self._module)

    class Writer(VarBytesColumn.Writer):
        def __init__(self, dbfile, level, module):
            VarBytesColumn.Writer.__init__(self, dbfile)
            self._level = level
            self._compress = __import__(module).compress

        def __repr__(self):
            return "<CompressedBytes.Writer>"

        def add(self, docnum, v):
            v = self._compress(v, self._level)
            VarBytesColumn.Writer.add(self, docnum, v)

    class Reader(VarBytesColumn.Reader):
        def __init__(self, dbfile, basepos, length, doccount, module):
            VarBytesColumn.Reader.__init__(self, dbfile, basepos, length,
                                           doccount)
            self._decompress = __import__(module).decompress

        def __repr__(self):
            return "<CompressedBytes.Reader>"

        def __getitem__(self, docnum):
            v = VarBytesColumn.Reader.__getitem__(self, docnum)
            if v:
                v = self._decompress(v)
            return v

        def __iter__(self):
            for v in VarBytesColumn.Reader.__iter__(self):
                yield self._decompress(v)

        def load(self):
            return list(self)


class CompressedBlockColumn(Column):
    """An experimental column type that compresses and decompresses blocks of
    values at a time. This can lead to high compression and decent performance
    for columns with lots of very short values, but random access times are
    usually terrible.
    """

    def __init__(self, level=3, blocksize=32, module="zlib"):
        """
        :param level: the compression level to use.
        :param blocksize: the size (in KB) of each compressed block.
        :param module: a string containing the name of the compression module
            to use. The default is "zlib". The module should export "compress"
            and "decompress" functions.
        """

        self._level = level
        self._blocksize = blocksize
        self._module = module

    def writer(self, dbfile):
        return self.Writer(dbfile, self._level, self._blocksize, self._module)

    def reader(self, dbfile, basepos, length, doccount):
        return self.Reader(dbfile, basepos, length, doccount, self._module)

    class Writer(ColumnWriter):
        def __init__(self, dbfile, level, blocksize, module):
            self._dbfile = dbfile
            self._blocksize = blocksize * 1024
            self._level = level
            self._compress = __import__(module).compress

            self._reset()

        def __repr__(self):
            return "<CompressedBlock.Writer>"

        def _reset(self):
            self._startdoc = None
            self._block = emptybytes
            self._lengths = []

        def _emit(self):
            dbfile = self._dbfile
            block = self._compress(self._block, self._level)
            header = (self._startdoc, self._lastdoc, len(block),
                      tuple(self._lengths))
            dbfile.write_pickle(header)
            dbfile.write(block)

        def add(self, docnum, v):
            if self._startdoc is None:
                self._startdoc = docnum
            self._lengths.append((docnum, len(v)))
            self._lastdoc = docnum

            self._block += v
            if len(self._block) >= self._blocksize:
                self._emit()
                self._reset()

        def finish(self, doccount):
            # If there's still a pending block, write it out
            if self._startdoc is not None:
                self._emit()

    class Reader(ColumnReader):
        def __init__(self, dbfile, basepos, length, doccount, module):
            ColumnReader.__init__(self, dbfile, basepos, length, doccount)
            self._decompress = __import__(module).decompress

            self._blocks = []
            dbfile.seek(basepos)
            pos = 0
            while pos < length:
                startdoc, enddoc, blocklen, lengths = dbfile.read_pickle()
                here = dbfile.tell()
                self._blocks.append((startdoc, enddoc, here, blocklen,
                                     lengths))
                dbfile.seek(blocklen, 1)
                pos = here + blocklen

        def __repr__(self):
            return "<CompressedBlock.Reader>"

        def _find_block(self, docnum):
            # TODO: use binary search instead of linear
            for i, b in enumerate(self._blocks):
                if docnum < b[0]:
                    return None
                elif docnum <= b[1]:
                    return i
            return None

        def _get_block(self, blocknum):
            block = self._blocks[blocknum]
            pos = block[2]
            blocklen = block[3]
            lengths = block[4]

            data = self._decompress(self._dbfile.get(self._basepos + pos,
                                                     blocklen))
            values = {}
            base = 0
            for docnum, vlen in lengths:
                values[docnum] = data[base:base + vlen]
                base += vlen
            return values

        def __getitem__(self, docnum):
            i = self._find_block(docnum)
            if i is None:
                return emptybytes
            return self._get_block(i)[docnum]

        def __iter__(self):
            last = -1
            for i, block in enumerate(self._blocks):
                startdoc = block[0]
                enddoc = block[1]
                if startdoc > (last + 1):
                    for _ in xrange(startdoc - last):
                        yield emptybytes
                values = self._get_block(i)
                for docnum in xrange(startdoc, enddoc + 1):
                    if docnum in values:
                        yield values[docnum]
                    else:
                        yield emptybytes
                last = enddoc
            if enddoc < self._doccount - 1:
                for _ in xrange(self._doccount - enddoc):
                    yield emptybytes


class StructColumn(FixedBytesColumn):
    def __init__(self, spec, default):
        self._spec = spec
        self._fixedlen = struct.calcsize(spec)
        self._default = default

    def writer(self, dbfile):
        return self.Writer(dbfile, self._spec, self._default)

    def reader(self, dbfile, basepos, length, doccount):
        return self.Reader(dbfile, basepos, length, doccount, self._spec,
                           self._default)

    class Writer(FixedBytesColumn.Writer):
        def __init__(self, dbfile, spec, default):
            self._dbfile = dbfile
            self._struct = struct.Struct(spec)
            self._fixedlen = self._struct.size
            self._default = default
            self._defaultbytes = self._struct.pack(*default)
            self._count = 0

        def __repr__(self):
            return "<Struct.Writer>"

        def add(self, docnum, v):
            b = self._struct.pack(*v)
            FixedBytesColumn.Writer.add(self, docnum, b)

    class Reader(FixedBytesColumn.Reader):
        def __init__(self, dbfile, basepos, length, doccount, spec, default):
            self._dbfile = dbfile
            self._basepos = basepos
            self._doccount = doccount
            self._struct = struct.Struct(spec)
            self._fixedlen = self._struct.size
            self._default = default
            self._defaultbytes = self._struct.pack(*default)
            self._count = length // self._fixedlen

        def __repr__(self):
            return "<Struct.Reader>"

        def __getitem__(self, docnum):
            v = FixedBytesColumn.Reader.__getitem__(self, docnum)
            return self._struct.unpack(v)


# Utility readers

class EmptyColumnReader(ColumnReader):
    """Acts like a reader for a column with no stored values. Always returns
    the default.
    """

    def __init__(self, default, doccount):
        """
        :param default: the value to return for all "get" requests.
        :param doccount: the number of documents in the nominal column.
        """

        self._default = default
        self._doccount = doccount

    def __getitem__(self, docnum):
        return self._default

    def __iter__(self):
        return (self._default for _ in xrange(self._doccount))

    def load(self):
        return self


class MultiColumnReader(ColumnReader):
    """Serializes access to multiple column readers, making them appear to be
    one large column.
    """

    def __init__(self, readers, offsets=None):
        """
        :param readers: a sequence of column reader objects.
        """

        self._readers = readers

        self._doc_offsets = []
        self._doccount = 0

        if offsets is None:
            for r in readers:
                self._doc_offsets.append(self._doccount)
                self._doccount += len(r)
        else:
            assert len(offsets) == len(readers)
            self._doc_offsets = offsets

    def _document_reader(self, docnum):
        return max(0, bisect_right(self._doc_offsets, docnum) - 1)

    def _reader_and_docnum(self, docnum):
        rnum = self._document_reader(docnum)
        offset = self._doc_offsets[rnum]
        return rnum, docnum - offset

    def __getitem__(self, docnum):
        x, y = self._reader_and_docnum(docnum)
        return self._readers[x][y]

    def __iter__(self):
        for r in self._readers:
            for v in r:
                yield v


class TranslatingColumnReader(ColumnReader):
    """Calls a function to "translate" values from an underlying column reader
    object before returning them.

    ``IndexReader`` objects can wrap a column reader with this object to call
    ``FieldType.from_column_value`` on the stored column value before returning
    it the the user.
    """

    def __init__(self, reader, translate):
        """
        :param reader: the underlying ColumnReader object to get values from.
        :param translate: a function that takes a value from the underlying
            reader and returns a translated value.
        """

        self._reader = reader
        self._translate = translate

    def raw_column(self):
        """Returns the underlying column reader.
        """

        return self._reader

    def __len__(self):
        return len(self._reader)

    def __getitem__(self, docnum):
        return self._translate(self._reader[docnum])

    def sort_key(self, docnum):
        return self._reader.sort_key(docnum)

    def __iter__(self):
        translate = self._translate
        return (translate(v) for v in self._reader)

    def set_reverse(self):
        self._reader.set_reverse()


# Column wrappers

class WrappedColumn(Column):
    def __init__(self, child):
        self._child = child

    def writer(self, *args, **kwargs):
        return self.Writer(self._child.writer(*args, **kwargs))

    def reader(self, *args, **kwargs):
        return self.Reader(self._child.reader(*args, **kwargs))

    def stores_lists(self):
        return self._child.stores_lists()


class WrappedColumnWriter(ColumnWriter):
    def __init__(self, child):
        self._child = child

    def fill(self, docnum):
        return self._child.fill(docnum)

    def add(self, docnum, value):
        return self._child.add(docnum, value)

    def finish(self, docnum):
        return self._child.finish(docnum)


class WrappedColumnReader(ColumnReader):
    def __init__(self, child):
        self._child = child

    def __len__(self):
        return len(self._child)

    def __getitem__(self, docnum):
        return self._child[docnum]

    def sort_key(self, docnum):
        return self._child.sort_key(docnum)

    def __iter__(self):
        return iter(self._child)

    def load(self):
        return list(self)

    def set_reverse(self):
        self._child.set_reverse()


class ClampedNumericColumn(WrappedColumn):
    """An experimental wrapper type for NumericColumn that clamps out-of-range
    values instead of raising an exception.
    """

    def reader(self, *args, **kwargs):
        return self._child.reader(*args, **kwargs)

    class Writer(WrappedColumnWriter):
        def __init__(self, child):
            self._child = child
            self._min = typecode_min[child._typecode]
            self._max = typecode_max[child._typecode]

        def add(self, docnum, v):
            v = min(v, self._min)
            v = max(v, self._max)
            self._child.add(docnum, v)


class PickleColumn(WrappedColumn):
    """Converts arbitrary objects to pickled bytestrings and stores them using
    the wrapped column (usually a :class:`VarBytesColumn` or
    :class:`CompressedBytesColumn`).

    If you can express the value you want to store as a number or bytestring,
    you should use the appropriate column type to avoid the time and size
    overhead of pickling and unpickling.
    """

    class Writer(WrappedColumnWriter):
        def __repr__(self):
            return "<PickleWriter>"

        def add(self, docnum, v):
            if v is None:
                v = emptybytes
            else:
                v = dumps(v, 2)
            self._child.add(docnum, v)

    class Reader(WrappedColumnReader):
        def __repr__(self):
            return "<PickleReader>"

        def __getitem__(self, docnum):
            v = self._child[docnum]
            if not v:
                return None
            else:
                return loads(v)

        def __iter__(self):
            for v in self._child:
                if not v:
                    yield None
                else:
                    yield loads(v)


# List columns

class ListColumn(WrappedColumn):
    def stores_lists(self):
        return True


class ListColumnReader(ColumnReader):
    def sort_key(self, docnum):
        return self[docnum][0]

    def __iter__(self):
        for docnum in xrange(len(self)):
            yield self[docnum]


class VarBytesListColumn(ListColumn):
    def __init__(self):
        self._child = VarBytesColumn()

    class Writer(WrappedColumnWriter):
        def add(self, docnum, ls):
            out = [varint(len(ls))]
            for v in ls:
                assert isinstance(v, bytes_type)
                out.append(varint(len(v)))
                out.append(v)
            self._child.add(docnum, emptybytes.join(out))

    class Reader(ListColumnReader, WrappedColumnReader):
        def __getitem__(self, docnum):
            data = self._child[docnum]
            if not data:
                return []
            bio = BytesIO(data)
            count = read_varint(bio.read)
            out = []
            for _ in xrange(count):
                vlen = read_varint(bio.read)
                v = bio.read(vlen)
                out.append(v)
            return out


class FixedBytesListColumn(ListColumn):
    def __init__(self, fixedlen):
        self._fixedlen = fixedlen
        self._child = VarBytesColumn()

    def writer(self, *args, **kwargs):
        return self.Writer(self._child.writer(*args, **kwargs), self._fixedlen)

    def reader(self, *args, **kwargs):
        return self.Reader(self._child.reader(*args, **kwargs), self._fixedlen)

    class Writer(WrappedColumnWriter):
        def __init__(self, child, fixedlen):
            self._child = child
            self._fixedlen = fixedlen
            self._lengths = GrowableArray()
            self._count = 0

        def add(self, docnum, ls):
            out = []
            for v in ls:
                assert len(v) == self._fixedlen
                out.append(v)
            b = emptybytes.join(out)
            self._child.add(docnum, b)

    class Reader(ListColumnReader, WrappedColumnReader):
        def __init__(self, child, fixedlen):
            self._child = child
            self._fixedlen = fixedlen

        def __getitem__(self, docnum):
            fixedlen = self._fixedlen
            v = self._child[docnum]
            if not v:
                return []
            ls = [v[i:i + fixedlen] for i in xrange(0, len(v), fixedlen)]
            return ls


#class RefListColumn(Column):
#    def __init__(self, fixedlen=0):
#        """
#        :param fixedlen: an optional fixed length for the values. If you
#            specify a number other than 0, the column will require all values
#            to be the specified length.
#        :param default: a default value to use for documents that don't specify
#            one. If you don't specify a default, the column will use an empty
#            bytestring (``b''``), or if you specify a fixed length,
#            ``b'\\x00' * fixedlen``.
#        """
#
#        self._fixedlen = fixedlen
#
#    def stores_lists(self):
#        return True
#
#    def writer(self, dbfile):
#        return self.Writer(dbfile, self._fixedlen)
#
#    def reader(self, dbfile, basepos, length, doccount):
#        return self.Reader(dbfile, basepos, length, doccount, self._fixedlen)
#
#    class Writer(ColumnWriter):
#        def __init__(self, dbfile, fixedlen):
#            self._dbfile = dbfile
#            self._fixedlen = fixedlen
#
#            self._refs = GrowableArray(allow_longs=False)
#            self._lengths = GrowableArray(allow_longs=False)
#            self._count = 0
#
#        def __repr__(self):
#            return "<RefList.Writer>"
#
#        def fill(self, docnum):
#            if docnum > self._count:
#                self._lengths.extend(0 for _ in xrange(docnum - self._count))
#
#        def add(self, docnum, ls):
#            uniques = self._uniques
#            refs = self._refs
#
#            self.fill(docnum)
#            self._lengths.append(len(ls))
#            for v in ls:
#                try:
#                    i = uniques[v]
#                except KeyError:
#                    uniques[v] = i = len(uniques)
#                refs.append(i)
#
#            self._count = docnum + 1
#
#        def finish(self, doccount):
#            dbfile = self._dbfile
#            refs = self._refs.array
#            lengths = self._lengths.array
#
#            self.fill(doccount)
#            dbfile.write_byte(ord(lengths.typecode))
#            dbfile.write_array(lengths)
#            dbfile.write_byte(ord(refs.typecode))
#            self._write_uniques(refs.typecode)
#            dbfile.write_array(refs)
#
#    class Reader(ListColumnReader):
#        def __init__(self, dbfile, basepos, length, doccount, fixedlen):
#            self._dbfile = dbfile
#            self._basepos = basepos
#            self._doccount = doccount
#            self._fixedlen = fixedlen
#
#            dbfile.seek(basepos)
#            lencode = chr(dbfile.read_byte())
#            self._lengths = dbfile.read_array(lencode, doccount)
#
#            self._typecode = chr(dbfile.read_byte())
#            refst = struct.Struct("!" + self._typecode)
#            self._unpack = refst.unpack
#            self._itemsize = refst.size
#
#            self._read_uniques()
#            self._refbase = dbfile.tell()
#
#            # Create an array of offsets into the references using the lengths
#            offsets = array("i", (0,))
#            for length in self._lengths:
#                offsets.append(offsets[-1] + length)
#            self._offsets = offsets
#
#        def __repr__(self):
#            return "<RefBytes.Reader>"
#
#        def _get_ref(self, docnum):
#            pos = self._basepos + 1 + docnum * self._itemsize
#            return self._unpack(self._dbfile.get(pos, self._itemsize))[0]
#
#        def __getitem__(self, docnum):
#            offset = self._offsets[docnum]
#            length = self._lengths[docnum]
#
#            pos = self._refbase + offset * self._itemsize
#            reflist = self._dbfile.get_array(pos, self._typecode, length)
#            return [self._uniques[ref] for ref in reflist]
