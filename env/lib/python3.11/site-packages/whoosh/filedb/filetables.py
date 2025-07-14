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

"""This module defines writer and reader classes for a fast, immutable
on-disk key-value database format. The current format is based heavily on
D. J. Bernstein's CDB format (http://cr.yp.to/cdb.html).
"""

import os, struct
from binascii import crc32
from bisect import bisect_left
from hashlib import md5  # @UnresolvedImport

from whoosh.compat import b, bytes_type
from whoosh.compat import xrange
from whoosh.util.numlists import GrowableArray
from whoosh.system import _INT_SIZE, emptybytes


# Exceptions

class FileFormatError(Exception):
    pass


# Hash functions

def cdb_hash(key):
    h = 5381
    for c in key:
        h = (h + (h << 5)) & 0xffffffff ^ ord(c)
    return h


def md5_hash(key):
    return int(md5(key).hexdigest(), 16) & 0xffffffff


def crc_hash(key):
    return crc32(key) & 0xffffffff


_hash_functions = (md5_hash, crc_hash, cdb_hash)


# Structs

# Two uints before the key/value pair giving the length of the key and value
_lengths = struct.Struct("!ii")
# A pointer in a hash table, giving the hash value and the key position
_pointer = struct.Struct("!Iq")
# A pointer in the hash table directory, giving the position and number of slots
_dir_entry = struct.Struct("!qi")

_directory_size = 256 * _dir_entry.size


# Basic hash file

class HashWriter(object):
    """Implements a fast on-disk key-value store. This hash uses a two-level
    hashing scheme, where a key is hashed, the low eight bits of the hash value
    are used to index into one of 256 hash tables. This is basically the CDB
    algorithm, but unlike CDB this object writes all data serially (it doesn't
    seek backwards to overwrite information at the end).

    Also unlike CDB, this format uses 64-bit file pointers, so the file length
    is essentially unlimited. However, each key and value must be less than
    2 GB in length.
    """

    def __init__(self, dbfile, magic=b("HSH3"), hashtype=0):
        """
        :param dbfile: a :class:`~whoosh.filedb.structfile.StructFile` object
            to write to.
        :param magic: the format tag bytes to write at the start of the file.
        :param hashtype: an integer indicating which hashing algorithm to use.
            Possible values are 0 (MD5), 1 (CRC32), or 2 (CDB hash).
        """

        self.dbfile = dbfile
        self.hashtype = hashtype
        self.hashfn = _hash_functions[self.hashtype]
        # A place for subclasses to put extra metadata
        self.extras = {}

        self.startoffset = dbfile.tell()
        # Write format tag
        dbfile.write(magic)
        # Write hash type
        dbfile.write_byte(self.hashtype)
        # Unused future expansion bits
        dbfile.write_int(0)
        dbfile.write_int(0)

        # 256 lists of hashed keys and positions
        self.buckets = [[] for _ in xrange(256)]
        # List to remember the positions of the hash tables
        self.directory = []

    def tell(self):
        return self.dbfile.tell()

    def add(self, key, value):
        """Adds a key/value pair to the file. Note that keys DO NOT need to be
        unique. You can store multiple values under the same key and retrieve
        them using :meth:`HashReader.all`.
        """

        assert isinstance(key, bytes_type)
        assert isinstance(value, bytes_type)

        dbfile = self.dbfile
        pos = dbfile.tell()
        dbfile.write(_lengths.pack(len(key), len(value)))
        dbfile.write(key)
        dbfile.write(value)

        # Get hash value for the key
        h = self.hashfn(key)
        # Add hash and on-disk position to appropriate bucket
        self.buckets[h & 255].append((h, pos))

    def add_all(self, items):
        """Convenience method to add a sequence of ``(key, value)`` pairs. This
        is the same as calling :meth:`HashWriter.add` on each pair in the
        sequence.
        """

        add = self.add
        for key, value in items:
            add(key, value)

    def _write_hashes(self):
        # Writes 256 hash tables containing pointers to the key/value pairs

        dbfile = self.dbfile
        # Represent and empty slot in the hash table using 0,0 (no key can
        # start at position 0 because of the header)
        null = (0, 0)

        for entries in self.buckets:
            # Start position of this bucket's hash table
            pos = dbfile.tell()
            # Remember the start position and the number of slots
            numslots = 2 * len(entries)
            self.directory.append((pos, numslots))

            # Create the empty hash table
            hashtable = [null] * numslots
            # For each (hash value, key position) tuple in the bucket
            for hashval, position in entries:
                # Bitshift and wrap to get the slot for this entry
                slot = (hashval >> 8) % numslots
                # If the slot is taken, keep going until we find an empty slot
                while hashtable[slot] != null:
                    slot = (slot + 1) % numslots
                # Insert the entry into the hashtable
                hashtable[slot] = (hashval, position)

            # Write the hash table for this bucket to disk
            for hashval, position in hashtable:
                dbfile.write(_pointer.pack(hashval, position))

    def _write_directory(self):
        # Writes a directory of pointers to the 256 hash tables

        dbfile = self.dbfile
        for position, numslots in self.directory:
            dbfile.write(_dir_entry.pack(position, numslots))

    def _write_extras(self):
        self.dbfile.write_pickle(self.extras)

    def close(self):
        dbfile = self.dbfile

        # Write hash tables
        self._write_hashes()
        # Write directory of pointers to hash tables
        self._write_directory()

        expos = dbfile.tell()
        # Write extra information
        self._write_extras()
        # Write length of pickle
        dbfile.write_int(dbfile.tell() - expos)

        endpos = dbfile.tell()
        dbfile.close()
        return endpos


class HashReader(object):
    """Reader for the fast on-disk key-value files created by
    :class:`HashWriter`.
    """

    def __init__(self, dbfile, length=None, magic=b("HSH3"), startoffset=0):
        """
        :param dbfile: a :class:`~whoosh.filedb.structfile.StructFile` object
            to read from.
        :param length: the length of the file data. This is necessary since the
            hashing information is written at the end of the file.
        :param magic: the format tag bytes to look for at the start of the
            file. If the file's format tag does not match these bytes, the
            object raises a :class:`FileFormatError` exception.
        :param startoffset: the starting point of the file data.
        """

        self.dbfile = dbfile
        self.startoffset = startoffset
        self.is_closed = False

        if length is None:
            dbfile.seek(0, os.SEEK_END)
            length = dbfile.tell() - startoffset

        dbfile.seek(startoffset)
        # Check format tag
        filemagic = dbfile.read(4)
        if filemagic != magic:
            raise FileFormatError("Unknown file header %r" % filemagic)
        # Read hash type
        self.hashtype = dbfile.read_byte()
        self.hashfn = _hash_functions[self.hashtype]
        # Skip unused future expansion bits
        dbfile.read_int()
        dbfile.read_int()
        self.startofdata = dbfile.tell()

        exptr = startoffset + length - _INT_SIZE
        # Get the length of extras from the end of the file
        exlen = dbfile.get_int(exptr)
        # Read the extras
        expos = exptr - exlen
        dbfile.seek(expos)
        self._read_extras()

        # Calculate the directory base from the beginning of the extras
        dbfile.seek(expos - _directory_size)
        # Read directory of hash tables
        self.tables = []
        entrysize = _dir_entry.size
        unpackentry = _dir_entry.unpack
        for _ in xrange(256):
            # position, numslots
            self.tables.append(unpackentry(dbfile.read(entrysize)))
        # The position of the first hash table is the end of the key/value pairs
        self.endofdata = self.tables[0][0]

    @classmethod
    def open(cls, storage, name):
        """Convenience method to open a hash file given a
        :class:`whoosh.filedb.filestore.Storage` object and a name. This takes
        care of opening the file and passing its length to the initializer.
        """

        length = storage.file_length(name)
        dbfile = storage.open_file(name)
        return cls(dbfile, length)

    def file(self):
        return self.dbfile

    def _read_extras(self):
        try:
            self.extras = self.dbfile.read_pickle()
        except EOFError:
            self.extras = {}

    def close(self):
        if self.is_closed:
            raise Exception("Tried to close %r twice" % self)
        self.dbfile.close()
        self.is_closed = True

    def key_at(self, pos):
        # Returns the key bytes at the given position

        dbfile = self.dbfile
        keylen = dbfile.get_uint(pos)
        return dbfile.get(pos + _lengths.size, keylen)

    def key_and_range_at(self, pos):
        # Returns a (keybytes, datapos, datalen) tuple for the key at the given
        # position
        dbfile = self.dbfile
        lenssize = _lengths.size

        if pos >= self.endofdata:
            return None

        keylen, datalen = _lengths.unpack(dbfile.get(pos, lenssize))
        keybytes = dbfile.get(pos + lenssize, keylen)
        datapos = pos + lenssize + keylen
        return keybytes, datapos, datalen

    def _ranges(self, pos=None, eod=None):
        # Yields a series of (keypos, keylength, datapos, datalength) tuples
        # for the key/value pairs in the file
        dbfile = self.dbfile
        pos = pos or self.startofdata
        eod = eod or self.endofdata
        lenssize = _lengths.size
        unpacklens = _lengths.unpack

        while pos < eod:
            keylen, datalen = unpacklens(dbfile.get(pos, lenssize))
            keypos = pos + lenssize
            datapos = keypos + keylen
            yield (keypos, keylen, datapos, datalen)
            pos = datapos + datalen

    def __getitem__(self, key):
        for value in self.all(key):
            return value
        raise KeyError(key)

    def __iter__(self):
        dbfile = self.dbfile
        for keypos, keylen, datapos, datalen in self._ranges():
            key = dbfile.get(keypos, keylen)
            value = dbfile.get(datapos, datalen)
            yield (key, value)

    def __contains__(self, key):
        for _ in self.ranges_for_key(key):
            return True
        return False

    def keys(self):
        dbfile = self.dbfile
        for keypos, keylen, _, _ in self._ranges():
            yield dbfile.get(keypos, keylen)

    def values(self):
        dbfile = self.dbfile
        for _, _, datapos, datalen in self._ranges():
            yield dbfile.get(datapos, datalen)

    def items(self):
        dbfile = self.dbfile
        for keypos, keylen, datapos, datalen in self._ranges():
            yield (dbfile.get(keypos, keylen), dbfile.get(datapos, datalen))

    def get(self, key, default=None):
        for value in self.all(key):
            return value
        return default

    def all(self, key):
        """Yields a sequence of values associated with the given key.
        """

        dbfile = self.dbfile
        for datapos, datalen in self.ranges_for_key(key):
            yield dbfile.get(datapos, datalen)

    def ranges_for_key(self, key):
        """Yields a sequence of ``(datapos, datalength)`` tuples associated
        with the given key.
        """

        if not isinstance(key, bytes_type):
            raise TypeError("Key %r should be bytes" % key)
        dbfile = self.dbfile

        # Hash the key
        keyhash = self.hashfn(key)
        # Get the position and number of slots for the hash table in which the
        # key may be found
        tablestart, numslots = self.tables[keyhash & 255]
        # If the hash table is empty, we know the key doesn't exists
        if not numslots:
            return

        ptrsize = _pointer.size
        unpackptr = _pointer.unpack
        lenssize = _lengths.size
        unpacklens = _lengths.unpack

        # Calculate where the key's slot should be
        slotpos = tablestart + (((keyhash >> 8) % numslots) * ptrsize)
        # Read slots looking for our key's hash value
        for _ in xrange(numslots):
            slothash, itempos = unpackptr(dbfile.get(slotpos, ptrsize))
            # If this slot is empty, we're done
            if not itempos:
                return

            # If the key hash in this slot matches our key's hash, we might have
            # a match, so read the actual key and see if it's our key
            if slothash == keyhash:
                # Read the key and value lengths
                keylen, datalen = unpacklens(dbfile.get(itempos, lenssize))
                # Only bother reading the actual key if the lengths match
                if keylen == len(key):
                    keystart = itempos + lenssize
                    if key == dbfile.get(keystart, keylen):
                        # The keys match, so yield (datapos, datalen)
                        yield (keystart + keylen, datalen)

            slotpos += ptrsize
            # If we reach the end of the hashtable, wrap around
            if slotpos == tablestart + (numslots * ptrsize):
                slotpos = tablestart

    def range_for_key(self, key):
        for item in self.ranges_for_key(key):
            return item
        raise KeyError(key)


# Ordered hash file

class OrderedHashWriter(HashWriter):
    """Implements an on-disk hash, but requires that keys be added in order.
    An :class:`OrderedHashReader` can then look up "nearest keys" based on
    the ordering.
    """

    def __init__(self, dbfile):
        HashWriter.__init__(self, dbfile)
        # Keep an array of the positions of all keys
        self.index = GrowableArray("H")
        # Keep track of the last key added
        self.lastkey = emptybytes

    def add(self, key, value):
        if key <= self.lastkey:
            raise ValueError("Keys must increase: %r..%r"
                             % (self.lastkey, key))
        self.index.append(self.dbfile.tell())
        HashWriter.add(self, key, value)
        self.lastkey = key

    def _write_extras(self):
        dbfile = self.dbfile
        index = self.index

        # Store metadata about the index array
        self.extras["indextype"] = index.typecode
        self.extras["indexlen"] = len(index)
        # Write the extras
        HashWriter._write_extras(self)
        # Write the index array
        index.to_file(dbfile)


class OrderedHashReader(HashReader):
    def closest_key(self, key):
        """Returns the closest key equal to or greater than the given key. If
        there is no key in the file equal to or greater than the given key,
        returns None.
        """

        pos = self.closest_key_pos(key)
        if pos is None:
            return None
        return self.key_at(pos)

    def ranges_from(self, key):
        """Yields a series of ``(keypos, keylen, datapos, datalen)`` tuples
        for the ordered series of keys equal or greater than the given key.
        """

        pos = self.closest_key_pos(key)
        if pos is None:
            return

        for item in self._ranges(pos=pos):
            yield item

    def keys_from(self, key):
        """Yields an ordered series of keys equal to or greater than the given
        key.
        """

        dbfile = self.dbfile
        for keypos, keylen, _, _ in self.ranges_from(key):
            yield dbfile.get(keypos, keylen)

    def items_from(self, key):
        """Yields an ordered series of ``(key, value)`` tuples for keys equal
        to or greater than the given key.
        """

        dbfile = self.dbfile
        for keypos, keylen, datapos, datalen in self.ranges_from(key):
            yield (dbfile.get(keypos, keylen), dbfile.get(datapos, datalen))

    def _read_extras(self):
        dbfile = self.dbfile

        # Read the extras
        HashReader._read_extras(self)

        # Set up for reading the index array
        indextype = self.extras["indextype"]
        self.indexbase = dbfile.tell()
        self.indexlen = self.extras["indexlen"]
        self.indexsize = struct.calcsize(indextype)
        # Set up the function to read values from the index array
        if indextype == "B":
            self._get_pos = dbfile.get_byte
        elif indextype == "H":
            self._get_pos = dbfile.get_ushort
        elif indextype == "i":
            self._get_pos = dbfile.get_int
        elif indextype == "I":
            self._get_pos = dbfile.get_uint
        elif indextype == "q":
            self._get_pos = dbfile.get_long
        else:
            raise Exception("Unknown index type %r" % indextype)

    def closest_key_pos(self, key):
        # Given a key, return the position of that key OR the next highest key
        # if the given key does not exist
        if not isinstance(key, bytes_type):
            raise TypeError("Key %r should be bytes" % key)

        indexbase = self.indexbase
        indexsize = self.indexsize
        key_at = self.key_at
        _get_pos = self._get_pos

        # Do a binary search of the positions in the index array
        lo = 0
        hi = self.indexlen
        while lo < hi:
            mid = (lo + hi) // 2
            midkey = key_at(_get_pos(indexbase + mid * indexsize))
            if midkey < key:
                lo = mid + 1
            else:
                hi = mid

        # If we went off the end, return None
        if lo == self.indexlen:
            return None
        # Return the closest key
        return _get_pos(indexbase + lo * indexsize)


# Fielded Ordered hash file

class FieldedOrderedHashWriter(HashWriter):
    """Implements an on-disk hash, but writes separate position indexes for
    each field.
    """

    def __init__(self, dbfile):
        HashWriter.__init__(self, dbfile)
        # Map field names to (startpos, indexpos, length, typecode)
        self.fieldmap = self.extras["fieldmap"] = {}

        # Keep track of the last key added
        self.lastkey = emptybytes

    def start_field(self, fieldname):
        self.fieldstart = self.dbfile.tell()
        self.fieldname = fieldname
        # Keep an array of the positions of all keys
        self.poses = GrowableArray("H")
        self.lastkey = emptybytes

    def add(self, key, value):
        if key <= self.lastkey:
            raise ValueError("Keys must increase: %r..%r"
                             % (self.lastkey, key))
        self.poses.append(self.dbfile.tell() - self.fieldstart)
        HashWriter.add(self, key, value)
        self.lastkey = key

    def end_field(self):
        dbfile = self.dbfile
        fieldname = self.fieldname
        poses = self.poses
        self.fieldmap[fieldname] = (self.fieldstart, dbfile.tell(), len(poses),
                                    poses.typecode)
        poses.to_file(dbfile)


class FieldedOrderedHashReader(HashReader):
    def __init__(self, *args, **kwargs):
        HashReader.__init__(self, *args, **kwargs)
        self.fieldmap = self.extras["fieldmap"]
        # Make a sorted list of the field names with their start and end ranges
        self.fieldlist = []
        for fieldname in sorted(self.fieldmap.keys()):
            startpos, ixpos, ixsize, ixtype = self.fieldmap[fieldname]
            self.fieldlist.append((fieldname, startpos, ixpos))

    def field_start(self, fieldname):
        return self.fieldmap[fieldname][0]

    def fielded_ranges(self, pos=None, eod=None):
        flist = self.fieldlist
        fpos = 0
        fieldname, start, end = flist[fpos]
        for keypos, keylen, datapos, datalen in self._ranges(pos, eod):
            if keypos >= end:
                fpos += 1
                fieldname, start, end = flist[fpos]
            yield fieldname, keypos, keylen, datapos, datalen

    def iter_terms(self):
        get = self.dbfile.get
        for fieldname, keypos, keylen, _, _ in self.fielded_ranges():
            yield fieldname, get(keypos, keylen)

    def iter_term_items(self):
        get = self.dbfile.get
        for item in self.fielded_ranges():
            fieldname, keypos, keylen, datapos, datalen = item
            yield fieldname, get(keypos, keylen), get(datapos, datalen)

    def contains_term(self, fieldname, btext):
        try:
            x = self.range_for_term(fieldname, btext)
            return True
        except KeyError:
            return False

    def range_for_term(self, fieldname, btext):
        start, ixpos, ixsize, code = self.fieldmap[fieldname]
        for datapos, datalen in self.ranges_for_key(btext):
            if start < datapos < ixpos:
                return datapos, datalen
        raise KeyError((fieldname, btext))

    def term_data(self, fieldname, btext):
        datapos, datalen = self.range_for_term(fieldname, btext)
        return self.dbfile.get(datapos, datalen)

    def term_get(self, fieldname, btext, default=None):
        try:
            return self.term_data(fieldname, btext)
        except KeyError:
            return default

    def closest_term_pos(self, fieldname, key):
        # Given a key, return the position of that key OR the next highest key
        # if the given key does not exist
        if not isinstance(key, bytes_type):
            raise TypeError("Key %r should be bytes" % key)

        dbfile = self.dbfile
        key_at = self.key_at
        startpos, ixpos, ixsize, ixtype = self.fieldmap[fieldname]

        if ixtype == "B":
            get_pos = dbfile.get_byte
        elif ixtype == "H":
            get_pos = dbfile.get_ushort
        elif ixtype == "i":
            get_pos = dbfile.get_int
        elif ixtype == "I":
            get_pos = dbfile.get_uint
        elif ixtype == "q":
            get_pos = dbfile.get_long
        else:
            raise Exception("Unknown index type %r" % ixtype)

        # Do a binary search of the positions in the index array
        lo = 0
        hi = ixsize
        while lo < hi:
            mid = (lo + hi) // 2
            midkey = key_at(startpos + get_pos(ixpos + mid * ixsize))
            if midkey < key:
                lo = mid + 1
            else:
                hi = mid

        # If we went off the end, return None
        if lo == ixsize:
            return None
        # Return the closest key
        return startpos + get_pos(ixpos + lo * ixsize)

    def closest_term(self, fieldname, btext):
        pos = self.closest_term_pos(fieldname, btext)
        if pos is None:
            return None
        return self.key_at(pos)

    def term_ranges_from(self, fieldname, btext):
        pos = self.closest_term_pos(fieldname, btext)
        if pos is None:
            return

        startpos, ixpos, ixsize, ixtype = self.fieldmap[fieldname]
        for item in self._ranges(pos, ixpos):
            yield item

    def terms_from(self, fieldname, btext):
        dbfile = self.dbfile
        for keypos, keylen, _, _ in self.term_ranges_from(fieldname, btext):
            yield dbfile.get(keypos, keylen)

    def term_items_from(self, fieldname, btext):
        dbfile = self.dbfile
        for item in self.term_ranges_from(fieldname, btext):
            keypos, keylen, datapos, datalen = item
            yield (dbfile.get(keypos, keylen), dbfile.get(datapos, datalen))



