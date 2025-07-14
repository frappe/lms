"""
An implementation of an object that acts like a collection of on/off bits.
"""

import operator
from array import array
from bisect import bisect_left, bisect_right, insort

from whoosh.compat import integer_types, izip, izip_longest, next, xrange
from whoosh.util.numeric import bytes_for_bits


# Number of '1' bits in each byte (0-255)
_1SPERBYTE = array('B', [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4, 1, 2,
2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5, 1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4,
3, 4, 4, 5, 2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6, 1, 2, 2, 3, 2, 3,
3, 4, 2, 3, 3, 4, 3, 4, 4, 5, 2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6, 3, 4, 4, 5, 4, 5, 5, 6, 4, 5,
5, 6, 5, 6, 6, 7, 1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5, 2, 3, 3, 4,
3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6, 2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5,
5, 6, 3, 4, 4, 5, 4, 5, 5, 6, 4, 5, 5, 6, 5, 6, 6, 7, 2, 3, 3, 4, 3, 4, 4, 5,
3, 4, 4, 5, 4, 5, 5, 6, 3, 4, 4, 5, 4, 5, 5, 6, 4, 5, 5, 6, 5, 6, 6, 7, 3, 4,
4, 5, 4, 5, 5, 6, 4, 5, 5, 6, 5, 6, 6, 7, 4, 5, 5, 6, 5, 6, 6, 7, 5, 6, 6, 7,
6, 7, 7, 8])


class DocIdSet(object):
    """Base class for a set of positive integers, implementing a subset of the
    built-in ``set`` type's interface with extra docid-related methods.

    This is a superclass for alternative set implementations to the built-in
    ``set`` which are more memory-efficient and specialized toward storing
    sorted lists of positive integers, though they will inevitably be slower
    than ``set`` for most operations since they're pure Python.
    """

    def __eq__(self, other):
        for a, b in izip(self, other):
            if a != b:
                return False
        return True

    def __neq__(self, other):
        return not self.__eq__(other)

    def __len__(self):
        raise NotImplementedError

    def __iter__(self):
        raise NotImplementedError

    def __contains__(self, i):
        raise NotImplementedError

    def __or__(self, other):
        return self.union(other)

    def __and__(self, other):
        return self.intersection(other)

    def __sub__(self, other):
        return self.difference(other)

    def copy(self):
        raise NotImplementedError

    def add(self, n):
        raise NotImplementedError

    def discard(self, n):
        raise NotImplementedError

    def update(self, other):
        add = self.add
        for i in other:
            add(i)

    def intersection_update(self, other):
        for n in self:
            if n not in other:
                self.discard(n)

    def difference_update(self, other):
        for n in other:
            self.discard(n)

    def invert_update(self, size):
        """Updates the set in-place to contain numbers in the range
        ``[0 - size)`` except numbers that are in this set.
        """

        for i in xrange(size):
            if i in self:
                self.discard(i)
            else:
                self.add(i)

    def intersection(self, other):
        c = self.copy()
        c.intersection_update(other)
        return c

    def union(self, other):
        c = self.copy()
        c.update(other)
        return c

    def difference(self, other):
        c = self.copy()
        c.difference_update(other)
        return c

    def invert(self, size):
        c = self.copy()
        c.invert_update(size)
        return c

    def isdisjoint(self, other):
        a = self
        b = other
        if len(other) < len(self):
            a, b = other, self
        for num in a:
            if num in b:
                return False
        return True

    def before(self, i):
        """Returns the previous integer in the set before ``i``, or None.
        """
        raise NotImplementedError

    def after(self, i):
        """Returns the next integer in the set after ``i``, or None.
        """
        raise NotImplementedError

    def first(self):
        """Returns the first (lowest) integer in the set.
        """
        raise NotImplementedError

    def last(self):
        """Returns the last (highest) integer in the set.
        """
        raise NotImplementedError


class BaseBitSet(DocIdSet):
    # Methods to override

    def byte_count(self):
        raise NotImplementedError

    def _get_byte(self, i):
        raise NotImplementedError

    def _iter_bytes(self):
        raise NotImplementedError

    # Base implementations

    def __len__(self):
        return sum(_1SPERBYTE[b] for b in self._iter_bytes())

    def __iter__(self):
        base = 0
        for byte in self._iter_bytes():
            for i in xrange(8):
                if byte & (1 << i):
                    yield base + i
            base += 8

    def __nonzero__(self):
        return any(n for n in self._iter_bytes())

    __bool__ = __nonzero__

    def __contains__(self, i):
        bucket = i // 8
        if bucket >= self.byte_count():
            return False
        return bool(self._get_byte(bucket) & (1 << (i & 7)))

    def first(self):
        return self.after(-1)

    def last(self):
        return self.before(self.byte_count() * 8 + 1)

    def before(self, i):
        _get_byte = self._get_byte
        size = self.byte_count() * 8

        if i <= 0:
            return None
        elif i >= size:
            i = size - 1
        else:
            i -= 1
        bucket = i // 8

        while i >= 0:
            byte = _get_byte(bucket)
            if not byte:
                bucket -= 1
                i = bucket * 8 + 7
                continue
            if byte & (1 << (i & 7)):
                return i
            if i % 8 == 0:
                bucket -= 1
            i -= 1

        return None

    def after(self, i):
        _get_byte = self._get_byte
        size = self.byte_count() * 8

        if i >= size:
            return None
        elif i < 0:
            i = 0
        else:
            i += 1
        bucket = i // 8

        while i < size:
            byte = _get_byte(bucket)
            if not byte:
                bucket += 1
                i = bucket * 8
                continue
            if byte & (1 << (i & 7)):
                return i
            i += 1
            if i % 8 == 0:
                bucket += 1

        return None


class OnDiskBitSet(BaseBitSet):
    """A DocIdSet backed by an array of bits on disk.

    >>> st = RamStorage()
    >>> f = st.create_file("test.bin")
    >>> bs = BitSet([1, 10, 15, 7, 2])
    >>> bytecount = bs.to_disk(f)
    >>> f.close()
    >>> # ...
    >>> f = st.open_file("test.bin")
    >>> odbs = OnDiskBitSet(f, bytecount)
    >>> list(odbs)
    [1, 2, 7, 10, 15]
    """

    def __init__(self, dbfile, basepos, bytecount):
        """
        :param dbfile: a :class:`~whoosh.filedb.structfile.StructFile` object
            to read from.
        :param basepos: the base position of the bytes in the given file.
        :param bytecount: the number of bytes to use for the bit array.
        """

        self._dbfile = dbfile
        self._basepos = basepos
        self._bytecount = bytecount

    def __repr__(self):
        return "%s(%s, %d, %d)" % (self.__class__.__name__, self.dbfile,
                                   self._basepos, self.bytecount)

    def byte_count(self):
        return self._bytecount

    def _get_byte(self, n):
        return self._dbfile.get_byte(self._basepos + n)

    def _iter_bytes(self):
        dbfile = self._dbfile
        dbfile.seek(self._basepos)
        for _ in xrange(self._bytecount):
            yield dbfile.read_byte()


class BitSet(BaseBitSet):
    """A DocIdSet backed by an array of bits. This can also be useful as a bit
    array (e.g. for a Bloom filter). It is much more memory efficient than a
    large built-in set of integers, but wastes memory for sparse sets.
    """

    def __init__(self, source=None, size=0):
        """
        :param maxsize: the maximum size of the bit array.
        :param source: an iterable of positive integers to add to this set.
        :param bits: an array of unsigned bytes ("B") to use as the underlying
            bit array. This is used by some of the object's methods.
        """

        # If the source is a list, tuple, or set, we can guess the size
        if not size and isinstance(source, (list, tuple, set, frozenset)):
            size = max(source)
        bytecount = bytes_for_bits(size)
        self.bits = array("B", (0 for _ in xrange(bytecount)))

        if source:
            add = self.add
            for num in source:
                add(num)

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, list(self))

    def byte_count(self):
        return len(self.bits)

    def _get_byte(self, n):
        return self.bits[n]

    def _iter_bytes(self):
        return iter(self.bits)

    def _trim(self):
        bits = self.bits
        last = len(self.bits) - 1
        while last >= 0 and not bits[last]:
            last -= 1
        del self.bits[last + 1:]

    def _resize(self, tosize):
        curlength = len(self.bits)
        newlength = bytes_for_bits(tosize)
        if newlength > curlength:
            self.bits.extend((0,) * (newlength - curlength))
        elif newlength < curlength:
            del self.bits[newlength + 1:]

    def _zero_extra_bits(self, size):
        bits = self.bits
        spill = size - ((len(bits) - 1) * 8)
        if spill:
            mask = 2 ** spill - 1
            bits[-1] = bits[-1] & mask

    def _logic(self, obj, op, other):
        objbits = obj.bits
        for i, (byte1, byte2) in enumerate(izip_longest(objbits, other.bits,
                                                        fillvalue=0)):
            value = op(byte1, byte2) & 0xFF
            if i >= len(objbits):
                objbits.append(value)
            else:
                objbits[i] = value

        obj._trim()
        return obj

    def to_disk(self, dbfile):
        dbfile.write_array(self.bits)
        return len(self.bits)

    @classmethod
    def from_bytes(cls, bs):
        b = cls()
        b.bits = array("B", bs)
        return b

    @classmethod
    def from_disk(cls, dbfile, bytecount):
        return cls.from_bytes(dbfile.read_array("B", bytecount))

    def copy(self):
        b = self.__class__()
        b.bits = array("B", iter(self.bits))
        return b

    def clear(self):
        for i in xrange(len(self.bits)):
            self.bits[i] = 0

    def add(self, i):
        bucket = i >> 3
        if bucket >= len(self.bits):
            self._resize(i + 1)
        self.bits[bucket] |= 1 << (i & 7)

    def discard(self, i):
        bucket = i >> 3
        self.bits[bucket] &= ~(1 << (i & 7))

    def _resize_to_other(self, other):
        if isinstance(other, (list, tuple, set, frozenset)):
            maxbit = max(other)
            if maxbit // 8 > len(self.bits):
                self._resize(maxbit)

    def update(self, iterable):
        self._resize_to_other(iterable)
        DocIdSet.update(self, iterable)

    def intersection_update(self, other):
        if isinstance(other, BitSet):
            return self._logic(self, operator.__and__, other)
        discard = self.discard
        for n in self:
            if n not in other:
                discard(n)

    def difference_update(self, other):
        if isinstance(other, BitSet):
            return self._logic(self, lambda x, y: x & ~y, other)
        discard = self.discard
        for n in other:
            discard(n)

    def invert_update(self, size):
        bits = self.bits
        for i in xrange(len(bits)):
            bits[i] = ~bits[i] & 0xFF
        self._zero_extra_bits(size)

    def union(self, other):
        if isinstance(other, BitSet):
            return self._logic(self.copy(), operator.__or__, other)
        b = self.copy()
        b.update(other)
        return b

    def intersection(self, other):
        if isinstance(other, BitSet):
            return self._logic(self.copy(), operator.__and__, other)
        return BitSet(source=(n for n in self if n in other))

    def difference(self, other):
        if isinstance(other, BitSet):
            return self._logic(self.copy(), lambda x, y: x & ~y, other)
        return BitSet(source=(n for n in self if n not in other))


class SortedIntSet(DocIdSet):
    """A DocIdSet backed by a sorted array of integers.
    """

    def __init__(self, source=None, typecode="I"):
        if source:
            self.data = array(typecode, sorted(source))
        else:
            self.data = array(typecode)
        self.typecode = typecode

    def copy(self):
        sis = SortedIntSet()
        sis.data = array(self.typecode, self.data)
        return sis

    def size(self):
        return len(self.data) * self.data.itemsize

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self.data)

    def __len__(self):
        return len(self.data)

    def __iter__(self):
        return iter(self.data)

    def __nonzero__(self):
        return bool(self.data)

    __bool__ = __nonzero__

    def __contains__(self, i):
        data = self.data
        if not data or i < data[0] or i > data[-1]:
            return False

        pos = bisect_left(data, i)
        if pos == len(data):
            return False
        return data[pos] == i

    def add(self, i):
        data = self.data
        if not data or i > data[-1]:
            data.append(i)
        else:
            mn = data[0]
            mx = data[-1]
            if i == mn or i == mx:
                return
            elif i > mx:
                data.append(i)
            elif i < mn:
                data.insert(0, i)
            else:
                pos = bisect_left(data, i)
                if data[pos] != i:
                    data.insert(pos, i)

    def discard(self, i):
        data = self.data
        pos = bisect_left(data, i)
        if data[pos] == i:
            data.pop(pos)

    def clear(self):
        self.data = array(self.typecode)

    def intersection_update(self, other):
        self.data = array(self.typecode, (num for num in self if num in other))

    def difference_update(self, other):
        self.data = array(self.typecode,
                          (num for num in self if num not in other))

    def intersection(self, other):
        return SortedIntSet((num for num in self if num in other))

    def difference(self, other):
        return SortedIntSet((num for num in self if num not in other))

    def first(self):
        return self.data[0]

    def last(self):
        return self.data[-1]

    def before(self, i):
        data = self.data
        pos = bisect_left(data, i)
        if pos < 1:
            return None
        else:
            return data[pos - 1]

    def after(self, i):
        data = self.data
        if not data or i >= data[-1]:
            return None
        elif i < data[0]:
            return data[0]

        pos = bisect_right(data, i)
        return data[pos]


class ReverseIdSet(DocIdSet):
    """
    Wraps a DocIdSet object and reverses its semantics, so docs in the wrapped
    set are not in this set, and vice-versa.
    """

    def __init__(self, idset, limit):
        """
        :param idset: the DocIdSet object to wrap.
        :param limit: the highest possible ID plus one.
        """

        self.idset = idset
        self.limit = limit

    def __len__(self):
        return self.limit - len(self.idset)

    def __contains__(self, i):
        return i not in self.idset

    def __iter__(self):
        ids = iter(self.idset)
        try:
            nx = next(ids)
        except StopIteration:
            nx = -1

        for i in xrange(self.limit):
            if i == nx:
                try:
                    nx = next(ids)
                except StopIteration:
                    nx = -1
            else:
                yield i

    def add(self, n):
        self.idset.discard(n)

    def discard(self, n):
        self.idset.add(n)

    def first(self):
        for i in self:
            return i

    def last(self):
        idset = self.idset
        maxid = self.limit - 1
        if idset.last() < maxid - 1:
            return maxid

        for i in xrange(maxid, -1, -1):
            if i not in idset:
                return i

ROARING_CUTOFF = 1 << 12


class RoaringIdSet(DocIdSet):
    """
    Separates IDs into ranges of 2^16 bits, and stores each range in the most
    efficient type of doc set, either a BitSet (if the range has >= 2^12 IDs)
    or a sorted ID set of 16-bit shorts.
    """

    cutoff = 2**12

    def __init__(self, source=None):
        self.idsets = []
        if source:
            self.update(source)

    def __len__(self):
        if not self.idsets:
            return 0

        return sum(len(idset) for idset in self.idsets)

    def __contains__(self, n):
        bucket = n >> 16
        if bucket >= len(self.idsets):
            return False
        return (n - (bucket << 16)) in self.idsets[bucket]

    def __iter__(self):
        for i, idset in self.idsets:
            floor = i << 16
            for n in idset:
                yield floor + n

    def _find(self, n):
        bucket = n >> 16
        floor = n << 16
        if bucket >= len(self.idsets):
            self.idsets.extend([SortedIntSet() for _
                                in xrange(len(self.idsets), bucket + 1)])
        idset = self.idsets[bucket]
        return bucket, floor, idset

    def add(self, n):
        bucket, floor, idset = self._find(n)
        oldlen = len(idset)
        idset.add(n - floor)
        if oldlen <= ROARING_CUTOFF < len(idset):
            self.idsets[bucket] = BitSet(idset)

    def discard(self, n):
        bucket, floor, idset = self._find(n)
        oldlen = len(idset)
        idset.discard(n - floor)
        if oldlen > ROARING_CUTOFF >= len(idset):
            self.idsets[bucket] = SortedIntSet(idset)


class MultiIdSet(DocIdSet):
    """Wraps multiple SERIAL sub-DocIdSet objects and presents them as an
    aggregated, read-only set.
    """

    def __init__(self, idsets, offsets):
        """
        :param idsets: a list of DocIdSet objects.
        :param offsets: a list of offsets corresponding to the DocIdSet objects
            in ``idsets``.
        """

        assert len(idsets) == len(offsets)
        self.idsets = idsets
        self.offsets = offsets

    def _document_set(self, n):
        offsets = self.offsets
        return max(bisect_left(offsets, n), len(self.offsets) - 1)

    def _set_and_docnum(self, n):
        setnum = self._document_set(n)
        offset = self.offsets[setnum]
        return self.idsets[setnum], n - offset

    def __len__(self):
        return sum(len(idset) for idset in self.idsets)

    def __iter__(self):
        for idset, offset in izip(self.idsets, self.offsets):
            for docnum in idset:
                yield docnum + offset

    def __contains__(self, item):
        idset, n = self._set_and_docnum(item)
        return n in idset


