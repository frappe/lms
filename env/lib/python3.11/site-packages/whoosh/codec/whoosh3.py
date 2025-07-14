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
This module implements a "codec" for writing/reading Whoosh X indexes.
"""

import struct
from array import array
from collections import defaultdict

from whoosh import columns, formats
from whoosh.compat import b, bytes_type, string_type, integer_types
from whoosh.compat import dumps, loads, iteritems, xrange
from whoosh.codec import base
from whoosh.filedb import compound, filetables
from whoosh.matching import ListMatcher, ReadTooFar, LeafMatcher
from whoosh.reading import TermInfo, TermNotFound
from whoosh.system import emptybytes
from whoosh.system import _SHORT_SIZE, _INT_SIZE, _LONG_SIZE, _FLOAT_SIZE
from whoosh.system import pack_ushort, unpack_ushort
from whoosh.system import pack_int, unpack_int, pack_long, unpack_long
from whoosh.util.numlists import delta_encode, delta_decode
from whoosh.util.numeric import length_to_byte, byte_to_length

try:
    import zlib
except ImportError:
    zlib = None


# This byte sequence is written at the start of a posting list to identify the
# codec/version
WHOOSH3_HEADER_MAGIC = b("W3Bl")

# Column type to store field length info
LENGTHS_COLUMN = columns.NumericColumn("B", default=0)
# Column type to store pointers to vector posting lists
VECTOR_COLUMN = columns.NumericColumn("I")
# Column type to store vector posting list lengths
VECTOR_LEN_COLUMN = columns.NumericColumn("i")
# Column type to store values of stored fields
STORED_COLUMN = columns.PickleColumn(columns.CompressedBytesColumn())


class W3Codec(base.Codec):
    # File extensions
    TERMS_EXT = ".trm"  # Term index
    POSTS_EXT = ".pst"  # Term postings
    VPOSTS_EXT = ".vps"  # Vector postings
    COLUMN_EXT = ".col"  # Per-document value columns

    def __init__(self, blocklimit=128, compression=3, inlinelimit=1):
        self._blocklimit = blocklimit
        self._compression = compression
        self._inlinelimit = inlinelimit

    # def automata(self):

    # Per-document value writer
    def per_document_writer(self, storage, segment):
        return W3PerDocWriter(self, storage, segment)

    # Inverted index writer
    def field_writer(self, storage, segment):
        return W3FieldWriter(self, storage, segment)

    # Postings

    def postings_writer(self, dbfile, byteids=False):
        return W3PostingsWriter(dbfile, blocklimit=self._blocklimit,
                                byteids=byteids, compression=self._compression,
                                inlinelimit=self._inlinelimit)

    def postings_reader(self, dbfile, terminfo, format_, term=None, scorer=None):
        if terminfo.is_inlined():
            # If the postings were inlined into the terminfo object, pull them
            # out and use a ListMatcher to wrap them in a Matcher interface
            ids, weights, values = terminfo.inlined_postings()
            m = ListMatcher(ids, weights, values, format_, scorer=scorer,
                            term=term, terminfo=terminfo)
        else:
            offset, length = terminfo.extent()
            m = W3LeafMatcher(dbfile, offset, length, format_, term=term,
                              scorer=scorer)
        return m

    # Readers

    def per_document_reader(self, storage, segment):
        return W3PerDocReader(storage, segment)

    def terms_reader(self, storage, segment):
        tiname = segment.make_filename(self.TERMS_EXT)
        tilen = storage.file_length(tiname)
        tifile = storage.open_file(tiname)

        postfile = segment.open_file(storage, self.POSTS_EXT)

        return W3TermsReader(self, tifile, tilen, postfile)

    # Graph methods provided by CodecWithGraph

    # Columns

    def supports_columns(self):
        return True

    @classmethod
    def column_filename(cls, segment, fieldname):
        ext = "".join((".", fieldname, cls.COLUMN_EXT))
        return segment.make_filename(ext)

    # Segments and generations

    def new_segment(self, storage, indexname):
        return W3Segment(self, indexname)


# Common functions

def _vecfield(fieldname):
    return "_%s_vec" % fieldname


def _lenfield(fieldname):
    return "_%s_len" % fieldname


# Per-doc information writer

class W3PerDocWriter(base.PerDocWriterWithColumns):
    def __init__(self, codec, storage, segment):
        self._codec = codec
        self._storage = storage
        self._segment = segment

        tempst = storage.temp_storage("%s.tmp" % segment.indexname)
        self._cols = compound.CompoundWriter(tempst)
        self._colwriters = {}
        self._create_column("_stored", STORED_COLUMN)

        self._fieldlengths = defaultdict(int)
        self._doccount = 0
        self._docnum = None
        self._storedfields = None
        self._indoc = False
        self.is_closed = False

        # We'll wait to create the vector file until someone actually tries
        # to add a vector
        self._vpostfile = None

    def _create_file(self, ext):
        return self._segment.create_file(self._storage, ext)

    def _has_column(self, fieldname):
        return fieldname in self._colwriters

    def _create_column(self, fieldname, column):
        writers = self._colwriters
        if fieldname in writers:
            raise Exception("Already added column %r" % fieldname)

        f = self._cols.create_file(fieldname)
        writers[fieldname] = column.writer(f)

    def _get_column(self, fieldname):
        return self._colwriters[fieldname]

    def _prep_vectors(self):
        self._vpostfile = self._create_file(W3Codec.VPOSTS_EXT)
        # We'll use offset==0 as a marker for "no vectors", so we can't start
        # postings at position 0, so just write a few header bytes :)
        self._vpostfile.write(b("VPST"))

    def start_doc(self, docnum):
        if self._indoc:
            raise Exception("Called start_doc when already in a doc")
        if docnum != self._doccount:
            raise Exception("Called start_doc(%r) was expecting %r"
                            % (docnum, self._doccount))

        self._docnum = docnum
        self._doccount += 1
        self._storedfields = {}
        self._indoc = True

    def add_field(self, fieldname, fieldobj, value, length):
        if value is not None:
            self._storedfields[fieldname] = value
        if length:
            # Add byte to length column
            lenfield = _lenfield(fieldname)
            lb = length_to_byte(length)
            self.add_column_value(lenfield, LENGTHS_COLUMN, lb)
            # Add length to total field length
            self._fieldlengths[fieldname] += length

    def add_vector_items(self, fieldname, fieldobj, items):
        if not items:
            # Don't do anything if the list of items is empty
            return

        if self._vpostfile is None:
            self._prep_vectors()

        # Write vector postings
        vpostwriter = self._codec.postings_writer(self._vpostfile, byteids=True)
        vpostwriter.start_postings(fieldobj.vector, W3TermInfo())
        for text, weight, vbytes in items:
            vpostwriter.add_posting(text, weight, vbytes)
        # finish_postings() returns terminfo object
        vinfo = vpostwriter.finish_postings()

        # Add row to vector lookup column
        vecfield = _vecfield(fieldname)  # Compute vector column name
        offset, length = vinfo.extent()
        assert offset != 0
        self.add_column_value(vecfield, VECTOR_COLUMN, offset)
        self.add_column_value(vecfield + "L", VECTOR_LEN_COLUMN, length)

    def finish_doc(self):
        sf = self._storedfields
        if sf:
            self.add_column_value("_stored", STORED_COLUMN, sf)
            sf.clear()
        self._indoc = False

    def _column_filename(self, fieldname):
        return W3Codec.column_filename(self._segment, fieldname)

    def close(self):
        if self._indoc is not None:
            # Called close without calling finish_doc
            self.finish_doc()

        self._segment._fieldlengths = self._fieldlengths

        # Finish open columns and close the columns writer
        for writer in self._colwriters.values():
            writer.finish(self._doccount)
        self._cols.save_as_files(self._storage, self._column_filename)

        # If vectors were written, close the vector writers
        if self._vpostfile:
            self._vpostfile.close()

        self.is_closed = True


class W3FieldWriter(base.FieldWriter):
    def __init__(self, codec, storage, segment):
        self._codec = codec
        self._storage = storage
        self._segment = segment

        self._fieldname = None
        self._fieldid = None
        self._btext = None
        self._fieldobj = None
        self._format = None

        _tifile = self._create_file(W3Codec.TERMS_EXT)
        self._tindex = filetables.OrderedHashWriter(_tifile)
        self._fieldmap = self._tindex.extras["fieldmap"] = {}

        self._postfile = self._create_file(W3Codec.POSTS_EXT)

        self._postwriter = None
        self._infield = False
        self.is_closed = False

    def _create_file(self, ext):
        return self._segment.create_file(self._storage, ext)

    def start_field(self, fieldname, fieldobj):
        fmap = self._fieldmap
        if fieldname in fmap:
            self._fieldid = fmap[fieldname]
        else:
            self._fieldid = len(fmap)
            fmap[fieldname] = self._fieldid

        self._fieldname = fieldname
        self._fieldobj = fieldobj
        self._format = fieldobj.format
        self._infield = True

        # Start a new postwriter for this field
        self._postwriter = self._codec.postings_writer(self._postfile)

    def start_term(self, btext):
        if self._postwriter is None:
            raise Exception("Called start_term before start_field")
        self._btext = btext
        self._postwriter.start_postings(self._fieldobj.format,  W3TermInfo())

    def add(self, docnum, weight, vbytes, length):
        self._postwriter.add_posting(docnum, weight, vbytes, length)

    def finish_term(self):
        terminfo = self._postwriter.finish_postings()

        # Add row to term info table
        keybytes = pack_ushort(self._fieldid) + self._btext
        valbytes = terminfo.to_bytes()
        self._tindex.add(keybytes, valbytes)

    # FieldWriterWithGraph.add_spell_word

    def finish_field(self):
        if not self._infield:
            raise Exception("Called finish_field before start_field")
        self._infield = False
        self._postwriter = None

    def close(self):
        self._tindex.close()
        self._postfile.close()
        self.is_closed = True


# Reader objects

class W3PerDocReader(base.PerDocumentReader):
    def __init__(self, storage, segment):
        self._storage = storage
        self._segment = segment
        self._doccount = segment.doc_count_all()

        self._vpostfile = None
        self._colfiles = {}
        self._readers = {}
        self._minlengths = {}
        self._maxlengths = {}

    def close(self):
        for colfile, _, _ in self._colfiles.values():
            colfile.close()
        if self._vpostfile:
            self._vpostfile.close()

    def doc_count(self):
        return self._doccount - self._segment.deleted_count()

    def doc_count_all(self):
        return self._doccount

    # Deletions

    def has_deletions(self):
        return self._segment.has_deletions()

    def is_deleted(self, docnum):
        return self._segment.is_deleted(docnum)

    def deleted_docs(self):
        return self._segment.deleted_docs()

    # Columns

    def has_column(self, fieldname):
        filename = W3Codec.column_filename(self._segment, fieldname)
        return self._storage.file_exists(filename)

    def _get_column_file(self, fieldname):
        filename = W3Codec.column_filename(self._segment, fieldname)
        length = self._storage.file_length(filename)
        colfile = self._storage.open_file(filename)
        return colfile, 0, length

    def column_reader(self, fieldname, column):
        if fieldname not in self._colfiles:
            self._colfiles[fieldname] = self._get_column_file(fieldname)
        colfile, offset, length = self._colfiles[fieldname]
        return column.reader(colfile, offset, length, self._doccount)

    # Lengths

    def _cached_reader(self, fieldname, column):
        if fieldname in self._readers:
            return self._readers[fieldname]
        else:
            if not self.has_column(fieldname):
                return None

            reader = self.column_reader(fieldname, column)
            self._readers[fieldname] = reader
            return reader

    def doc_field_length(self, docnum, fieldname, default=0):
        if docnum > self._doccount:
            raise IndexError("Asked for docnum %r of %d"
                             % (docnum, self._doccount))

        lenfield = _lenfield(fieldname)
        reader = self._cached_reader(lenfield, LENGTHS_COLUMN)
        if reader is None:
            return default

        lbyte = reader[docnum]
        if lbyte:
            return byte_to_length(lbyte)

    def field_length(self, fieldname):
        return self._segment._fieldlengths.get(fieldname, 0)

    def _minmax_length(self, fieldname, op, cache):
        if fieldname in cache:
            return cache[fieldname]

        lenfield = _lenfield(fieldname)
        reader = self._cached_reader(lenfield, LENGTHS_COLUMN)
        length = byte_to_length(op(reader))
        cache[fieldname] = length
        return length

    def min_field_length(self, fieldname):
        return self._minmax_length(fieldname, min, self._minlengths)

    def max_field_length(self, fieldname):
        return self._minmax_length(fieldname, max, self._maxlengths)

    # Vectors

    def _prep_vectors(self):
        f = self._segment.open_file(self._storage, W3Codec.VPOSTS_EXT)
        self._vpostfile = f

    def _vector_extent(self, docnum, fieldname):
        if docnum > self._doccount:
            raise IndexError("Asked for document %r of %d"
                             % (docnum, self._doccount))
        vecfield = _vecfield(fieldname)  # Compute vector column name

        # Get the offset from the vector offset column
        offset = self._cached_reader(vecfield, VECTOR_COLUMN)[docnum]

        # Get the length from the length column, if it exists, otherwise return
        # -1 for the length (backwards compatibility with old dev versions)
        lreader = self._cached_reader(vecfield + "L", VECTOR_COLUMN)
        if lreader:
            length = lreader[docnum]
        else:
            length = -1

        return offset, length

    def has_vector(self, docnum, fieldname):
        if self.has_column(_vecfield(fieldname)):
            offset, length = self._vector_extent(docnum, fieldname)
            return offset != 0
        return False

    def vector(self, docnum, fieldname, format_):
        if self._vpostfile is None:
            self._prep_vectors()
        offset, length = self._vector_extent(docnum, fieldname)
        if not offset:
            raise Exception("Field %r has no vector in docnum %s" %
                            (fieldname, docnum))
        m = W3LeafMatcher(self._vpostfile, offset, length, format_,
                          byteids=True)
        return m

    # Stored fields

    def stored_fields(self, docnum):
        reader = self._cached_reader("_stored", STORED_COLUMN)
        v = reader[docnum]
        if v is None:
            v = {}
        return v


class W3FieldCursor(base.FieldCursor):
    def __init__(self, tindex, fieldname, keycoder, keydecoder, fieldobj):
        self._tindex = tindex
        self._fieldname = fieldname
        self._keycoder = keycoder
        self._keydecoder = keydecoder
        self._fieldobj = fieldobj

        prefixbytes = keycoder(fieldname, b'')
        self._startpos = self._tindex.closest_key_pos(prefixbytes)

        self._pos = self._startpos
        self._text = None
        self._datapos = None
        self._datalen = None
        self.next()

    def first(self):
        self._pos = self._startpos
        return self.next()

    def find(self, term):
        if not isinstance(term, bytes_type):
            term = self._fieldobj.to_bytes(term)
        key = self._keycoder(self._fieldname, term)
        self._pos = self._tindex.closest_key_pos(key)
        return self.next()

    def next(self):
        if self._pos is not None:
            keyrng = self._tindex.key_and_range_at(self._pos)
            if keyrng is not None:
                keybytes, datapos, datalen = keyrng
                fname, text = self._keydecoder(keybytes)
                if fname == self._fieldname:
                    self._pos = datapos + datalen
                    self._text = self._fieldobj.from_bytes(text)
                    self._datapos = datapos
                    self._datalen = datalen
                    return self._text

        self._text = self._pos = self._datapos = self._datalen = None
        return None

    def text(self):
        return self._text

    def term_info(self):
        if self._pos is None:
            return None

        databytes = self._tindex.dbfile.get(self._datapos, self._datalen)
        return W3TermInfo.from_bytes(databytes)

    def is_valid(self):
        return self._pos is not None


class W3TermsReader(base.TermsReader):
    def __init__(self, codec, dbfile, length, postfile):
        self._codec = codec
        self._dbfile = dbfile
        self._tindex = filetables.OrderedHashReader(dbfile, length)
        self._fieldmap = self._tindex.extras["fieldmap"]
        self._postfile = postfile

        self._fieldunmap = [None] * len(self._fieldmap)
        for fieldname, num in iteritems(self._fieldmap):
            self._fieldunmap[num] = fieldname

    def _keycoder(self, fieldname, tbytes):
        assert isinstance(tbytes, bytes_type), "tbytes=%r" % tbytes
        fnum = self._fieldmap.get(fieldname, 65535)
        return pack_ushort(fnum) + tbytes

    def _keydecoder(self, keybytes):
        fieldid = unpack_ushort(keybytes[:_SHORT_SIZE])[0]
        return self._fieldunmap[fieldid], keybytes[_SHORT_SIZE:]

    def _range_for_key(self, fieldname, tbytes):
        return self._tindex.range_for_key(self._keycoder(fieldname, tbytes))

    def __contains__(self, term):
        return self._keycoder(*term) in self._tindex

    def indexed_field_names(self):
        return self._fieldmap.keys()

    def cursor(self, fieldname, fieldobj):
        tindex = self._tindex
        coder = self._keycoder
        decoder = self._keydecoder
        return W3FieldCursor(tindex, fieldname, coder, decoder, fieldobj)

    def terms(self):
        keydecoder = self._keydecoder
        return (keydecoder(keybytes) for keybytes in self._tindex.keys())

    def terms_from(self, fieldname, prefix):
        prefixbytes = self._keycoder(fieldname, prefix)
        keydecoder = self._keydecoder
        return (keydecoder(keybytes) for keybytes
                in self._tindex.keys_from(prefixbytes))

    def items(self):
        tidecoder = W3TermInfo.from_bytes
        keydecoder = self._keydecoder
        return ((keydecoder(keybytes), tidecoder(valbytes))
                for keybytes, valbytes in self._tindex.items())

    def items_from(self, fieldname, prefix):
        prefixbytes = self._keycoder(fieldname, prefix)
        tidecoder = W3TermInfo.from_bytes
        keydecoder = self._keydecoder
        return ((keydecoder(keybytes), tidecoder(valbytes))
                for keybytes, valbytes in self._tindex.items_from(prefixbytes))

    def term_info(self, fieldname, tbytes):
        key = self._keycoder(fieldname, tbytes)
        try:
            return W3TermInfo.from_bytes(self._tindex[key])
        except KeyError:
            raise TermNotFound("No term %s:%r" % (fieldname, tbytes))

    def frequency(self, fieldname, tbytes):
        datapos = self._range_for_key(fieldname, tbytes)[0]
        return W3TermInfo.read_weight(self._dbfile, datapos)

    def doc_frequency(self, fieldname, tbytes):
        datapos = self._range_for_key(fieldname, tbytes)[0]
        return W3TermInfo.read_doc_freq(self._dbfile, datapos)

    def matcher(self, fieldname, tbytes, format_, scorer=None):
        terminfo = self.term_info(fieldname, tbytes)
        m = self._codec.postings_reader(self._postfile, terminfo, format_,
                                        term=(fieldname, tbytes), scorer=scorer)
        return m

    def close(self):
        self._tindex.close()
        self._postfile.close()


# Postings

class W3PostingsWriter(base.PostingsWriter):
    """This object writes posting lists to the postings file. It groups postings
    into blocks and tracks block level statistics to makes it easier to skip
    through the postings.
    """

    def __init__(self, postfile, blocklimit, byteids=False, compression=3,
                 inlinelimit=1):
        self._postfile = postfile
        self._blocklimit = blocklimit
        self._byteids = byteids
        self._compression = compression
        self._inlinelimit = inlinelimit

        self._blockcount = 0
        self._format = None
        self._terminfo = None

    def written(self):
        return self._blockcount > 0

    def start_postings(self, format_, terminfo):
        # Start a new term
        if self._terminfo:
            # If self._terminfo is not None, that means we are already in a term
            raise Exception("Called start in a term")

        assert isinstance(format_, formats.Format)
        self._format = format_
        # Reset block count
        self._blockcount = 0
        # Reset block bufferg
        self._new_block()
        # Remember terminfo object passed to us
        self._terminfo = terminfo
        # Remember where we started in the posting file
        self._startoffset = self._postfile.tell()

    def add_posting(self, id_, weight, vbytes, length=None):
        # Add a posting to the buffered block

        # If the number of buffered postings == the block limit, write out the
        # buffered block and reset before adding this one
        if len(self._ids) >= self._blocklimit:
            self._write_block()

        # Check types
        if self._byteids:
            assert isinstance(id_, string_type), "id_=%r" % id_
        else:
            assert isinstance(id_, integer_types), "id_=%r" % id_
        assert isinstance(weight, (int, float)), "weight=%r" % weight
        assert isinstance(vbytes, bytes_type), "vbytes=%r" % vbytes
        assert length is None or isinstance(length, integer_types)

        self._ids.append(id_)
        self._weights.append(weight)

        if weight > self._maxweight:
            self._maxweight = weight
        if vbytes:
            self._values.append(vbytes)
        if length:
            minlength = self._minlength
            if minlength is None or length < minlength:
                self._minlength = length
            if length > self._maxlength:
                self._maxlength = length

    def finish_postings(self):
        terminfo = self._terminfo
        # If we have fewer than "inlinelimit" postings in this posting list,
        # "inline" the postings into the terminfo instead of writing them to
        # the posting file
        if not self.written() and len(self) < self._inlinelimit:
            terminfo.add_block(self)
            terminfo.set_inline(self._ids, self._weights, self._values)
        else:
            # If there are leftover items in the current block, write them out
            if self._ids:
                self._write_block(last=True)
            startoffset = self._startoffset
            length = self._postfile.tell() - startoffset
            terminfo.set_extent(startoffset, length)

        # Clear self._terminfo to indicate we're between terms
        self._terminfo = None
        # Return the current terminfo object
        return terminfo

    def _new_block(self):
        # Reset block buffer

        # List of IDs (docnums for regular posting list, terms for vector PL)
        self._ids = [] if self._byteids else array("I")
        # List of weights
        self._weights = array("f")
        # List of encoded payloads
        self._values = []
        # Statistics
        self._minlength = None
        self._maxlength = 0
        self._maxweight = 0

    def _write_block(self, last=False):
        # Write the buffered block to the postings file

        # If this is the first block, write a small header first
        if not self._blockcount:
            self._postfile.write(WHOOSH3_HEADER_MAGIC)

        # Add this block's statistics to the terminfo object, which tracks the
        # overall statistics for all term postings
        self._terminfo.add_block(self)

        # Minify the IDs, weights, and values, and put them in a tuple
        data = (self._mini_ids(), self._mini_weights(), self._mini_values())
        # Pickle the tuple
        databytes = dumps(data, 2)
        # If the pickle is less than 20 bytes, don't bother compressing
        if len(databytes) < 20:
            comp = 0
        # Compress the pickle (if self._compression > 0)
        comp = self._compression
        if comp:
            databytes = zlib.compress(databytes, comp)

        # Make a tuple of block info. The posting reader can check this info
        # and decide whether to skip the block without having to decompress the
        # full block data
        #
        # - Number of postings in block
        # - Last ID in block
        # - Maximum weight in block
        # - Compression level
        # - Minimum length byte
        # - Maximum length byte
        ids = self._ids
        infobytes = dumps((len(ids), ids[-1], self._maxweight, comp,
                           length_to_byte(self._minlength),
                           length_to_byte(self._maxlength),
                           ), 2)

        # Write block length
        postfile = self._postfile
        blocklength = len(infobytes) + len(databytes)
        if last:
            # If this is the last block, use a negative number
            blocklength *= -1
        postfile.write_int(blocklength)
        # Write block info
        postfile.write(infobytes)
        # Write block data
        postfile.write(databytes)

        self._blockcount += 1
        # Reset block buffer
        self._new_block()

    # Methods to reduce the byte size of the various lists

    def _mini_ids(self):
        # Minify IDs

        ids = self._ids
        if not self._byteids:
            ids = delta_encode(ids)
        return tuple(ids)

    def _mini_weights(self):
        # Minify weights

        weights = self._weights

        if all(w == 1.0 for w in weights):
            return None
        elif all(w == weights[0] for w in weights):
            return weights[0]
        else:
            return tuple(weights)

    def _mini_values(self):
        # Minify values

        fixedsize = self._format.fixed_value_size()
        values = self._values

        if fixedsize is None or fixedsize < 0:
            vs = tuple(values)
        elif fixedsize == 0:
            vs = None
        else:
            vs = emptybytes.join(values)
        return vs

    # Block stats methods

    def __len__(self):
        # Returns the number of unwritten buffered postings
        return len(self._ids)

    def min_id(self):
        # First ID in the buffered block
        return self._ids[0]

    def max_id(self):
        # Last ID in the buffered block
        return self._ids[-1]

    def min_length(self):
        # Shortest field length in the buffered block
        return self._minlength

    def max_length(self):
        # Longest field length in the buffered block
        return self._maxlength

    def max_weight(self):
        # Highest weight in the buffered block
        return self._maxweight


class W3LeafMatcher(LeafMatcher):
    """Reads on-disk postings from the postings file and presents the
    :class:`whoosh.matching.Matcher` interface.
    """

    def __init__(self, postfile, startoffset, length, format_, term=None,
                 byteids=None, scorer=None):
        self._postfile = postfile
        self._startoffset = startoffset
        self._length = length
        self.format = format_
        self._term = term
        self._byteids = byteids
        self.scorer = scorer

        self._fixedsize = self.format.fixed_value_size()
        # Read the header tag at the start of the postings
        self._read_header()
        # "Reset" to read the first block
        self.reset()

    def _read_header(self):
        # Seek to the start of the postings and check the header tag
        postfile = self._postfile

        postfile.seek(self._startoffset)
        magic = postfile.read(4)
        if magic != WHOOSH3_HEADER_MAGIC:
            raise Exception("Block tag error %r" % magic)

        # Remember the base offset (start of postings, after the header)
        self._baseoffset = postfile.tell()

    def reset(self):
        # Reset block stats
        self._blocklength = None
        self._maxid = None
        self._maxweight = None
        self._compression = None
        self._minlength = None
        self._maxlength = None

        self._lastblock = False
        self._atend = False
        # Consume first block
        self._goto(self._baseoffset)

    def _goto(self, position):
        # Read the posting block at the given position

        postfile = self._postfile

        # Reset block data -- we'll lazy load the data from the new block as
        # needed
        self._data = None
        self._ids = None
        self._weights = None
        self._values = None
        # Reset pointer into the block
        self._i = 0

        # Seek to the start of the block
        postfile.seek(position)
        # Read the block length
        length = postfile.read_int()
        # If the block length is negative, that means this is the last block
        if length < 0:
            self._lastblock = True
            length *= -1

        # Remember the offset of the next block
        self._nextoffset = position + _INT_SIZE + length
        # Read the pickled block info tuple
        info = postfile.read_pickle()
        # Remember the offset of the block's data
        self._dataoffset = postfile.tell()

        # Decompose the info tuple to set the current block info
        (self._blocklength, self._maxid, self._maxweight, self._compression,
         mnlen, mxlen) = info
        self._minlength = byte_to_length(mnlen)
        self._maxlength = byte_to_length(mxlen)

    def _next_block(self):
        if self._atend:
            # We were already at the end, and yet somebody called _next_block()
            # again, so something is wrong somewhere
            raise Exception("No next block")
        elif self._lastblock:
            # Reached the end of the postings
            self._atend = True
        else:
            # Go to the next block
            self._goto(self._nextoffset)

    def _skip_to_block(self, skipwhile):
        # Skip blocks as long as the skipwhile() function returns True

        skipped = 0
        while self.is_active() and skipwhile():
            self._next_block()
            skipped += 1
        return skipped

    def is_active(self):
        return not self._atend and self._i < self._blocklength

    def id(self):
        # Get the current ID (docnum for regular postings, term for vector)

        # If we haven't loaded the block IDs yet, load them now
        if self._ids is None:
            self._read_ids()

        return self._ids[self._i]

    def weight(self):
        # Get the weight for the current posting

        # If we haven't loaded the block weights yet, load them now
        if self._weights is None:
            self._read_weights()

        return self._weights[self._i]

    def value(self):
        # Get the value for the current posting

        # If we haven't loaded the block values yet, load them now
        if self._values is None:
            self._read_values()

        return self._values[self._i]

    def next(self):
        # Move to the next posting

        # Increment the in-block pointer
        self._i += 1
        # If we reached the end of the block, move to the next block
        if self._i == self._blocklength:
            self._next_block()
            return True
        else:
            return False

    def skip_to(self, targetid):
        # Skip to the next ID equal to or greater than the given target ID

        if not self.is_active():
            raise ReadTooFar

        # If we're already at or past target ID, do nothing
        if targetid <= self.id():
            return

        # Skip to the block that would contain the target ID
        block_max_id = self.block_max_id
        if targetid > block_max_id():
            self._skip_to_block(lambda: targetid > block_max_id())

        # Iterate through the IDs in the block until we find or pass the
        # target
        while self.is_active() and self.id() < targetid:
            self.next()

    def skip_to_quality(self, minquality):
        # Skip blocks until we find one that might exceed the given minimum
        # quality

        block_quality = self.block_quality

        # If the quality of this block is already higher than the minimum,
        # do nothing
        if block_quality() > minquality:
            return 0

        # Skip blocks as long as the block quality is not greater than the
        # minimum
        return self._skip_to_block(lambda: block_quality() <= minquality)

    def block_min_id(self):
        if self._ids is None:
            self._read_ids()
        return self._ids[0]

    def block_max_id(self):
        return self._maxid

    def block_min_length(self):
        return self._minlength

    def block_max_length(self):
        return self._maxlength

    def block_max_weight(self):
        return self._maxweight

    def _read_data(self):
        # Load block data tuple from disk

        datalen = self._nextoffset - self._dataoffset
        b = self._postfile.get(self._dataoffset, datalen)

        # Decompress the pickled data if necessary
        if self._compression:
            b = zlib.decompress(b)

        # Unpickle the data tuple and save it in an attribute
        self._data = loads(b)

    def _read_ids(self):
        # If we haven't loaded the data from disk yet, load it now
        if self._data is None:
            self._read_data()
        ids = self._data[0]

        # De-minify the IDs
        if not self._byteids:
            ids = tuple(delta_decode(ids))

        self._ids = ids

    def _read_weights(self):
        # If we haven't loaded the data from disk yet, load it now
        if self._data is None:
            self._read_data()
        weights = self._data[1]

        # De-minify the weights
        postcount = self._blocklength
        if weights is None:
            self._weights = array("f", (1.0 for _ in xrange(postcount)))
        elif isinstance(weights, float):
            self._weights = array("f", (weights for _ in xrange(postcount)))
        else:
            self._weights = weights

    def _read_values(self):
        # If we haven't loaded the data from disk yet, load it now
        if self._data is None:
            self._read_data()

        # De-minify the values
        fixedsize = self._fixedsize
        vs = self._data[2]
        if fixedsize is None or fixedsize < 0:
            self._values = vs
        elif fixedsize is 0:
            self._values = (None,) * self._blocklength
        else:
            assert isinstance(vs, bytes_type)
            self._values = tuple(vs[i:i + fixedsize]
                                 for i in xrange(0, len(vs), fixedsize))


# Term info implementation

class W3TermInfo(TermInfo):
    # B   | Flags
    # f   | Total weight
    # I   | Total doc freq
    # B   | Min length (encoded as byte)
    # B   | Max length (encoded as byte)
    # f   | Max weight
    # I   | Minimum (first) ID
    # I   | Maximum (last) ID
    _struct = struct.Struct("!BfIBBfII")

    def __init__(self, *args, **kwargs):
        TermInfo.__init__(self, *args, **kwargs)
        self._offset = None
        self._length = None
        self._inlined = None

    def add_block(self, block):
        self._weight += sum(block._weights)
        self._df += len(block)

        ml = block.min_length()
        if self._minlength is None:
            self._minlength = ml
        else:
            self._minlength = min(self._minlength, ml)

        self._maxlength = max(self._maxlength, block.max_length())
        self._maxweight = max(self._maxweight, block.max_weight())
        if self._minid is None:
            self._minid = block.min_id()
        self._maxid = block.max_id()

    def set_extent(self, offset, length):
        self._offset = offset
        self._length = length

    def extent(self):
        return self._offset, self._length

    def set_inlined(self, ids, weights, values):
        self._inlined = (tuple(ids), tuple(weights), tuple(values))

    def is_inlined(self):
        return self._inlined is not None

    def inlined_postings(self):
        return self._inlined

    def to_bytes(self):
        isinlined = self.is_inlined()

        # Encode the lengths as 0-255 values
        minlength = (0 if self._minlength is None
                     else length_to_byte(self._minlength))
        maxlength = length_to_byte(self._maxlength)
        # Convert None values to the out-of-band NO_ID constant so they can be
        # stored as unsigned ints
        minid = 0xffffffff if self._minid is None else self._minid
        maxid = 0xffffffff if self._maxid is None else self._maxid

        # Pack the term info into bytes
        st = self._struct.pack(isinlined, self._weight, self._df,
                               minlength, maxlength, self._maxweight,
                               minid, maxid)

        if isinlined:
            # Postings are inlined - dump them using the pickle protocol
            postbytes = dumps(self._inlined, 2)
        else:
            postbytes = pack_long(self._offset) + pack_int(self._length)
        st += postbytes
        return st

    @classmethod
    def from_bytes(cls, s):
        st = cls._struct
        vals = st.unpack(s[:st.size])
        terminfo = cls()

        flags = vals[0]
        terminfo._weight = vals[1]
        terminfo._df = vals[2]
        terminfo._minlength = byte_to_length(vals[3])
        terminfo._maxlength = byte_to_length(vals[4])
        terminfo._maxweight = vals[5]
        terminfo._minid = None if vals[6] == 0xffffffff else vals[6]
        terminfo._maxid = None if vals[7] == 0xffffffff else vals[7]

        if flags:
            # Postings are stored inline
            terminfo._inlined = loads(s[st.size:])
        else:
            # Last bytes are pointer into posting file and length
            offpos = st.size
            lenpos = st.size + _LONG_SIZE
            terminfo._offset = unpack_long(s[offpos:lenpos])[0]
            terminfo._length = unpack_int(s[lenpos:lenpos + _INT_SIZE])

        return terminfo

    @classmethod
    def read_weight(cls, dbfile, datapos):
        return dbfile.get_float(datapos + 1)

    @classmethod
    def read_doc_freq(cls, dbfile, datapos):
        return dbfile.get_uint(datapos + 1 + _FLOAT_SIZE)

    @classmethod
    def read_min_and_max_length(cls, dbfile, datapos):
        lenpos = datapos + 1 + _FLOAT_SIZE + _INT_SIZE
        ml = byte_to_length(dbfile.get_byte(lenpos))
        xl = byte_to_length(dbfile.get_byte(lenpos + 1))
        return ml, xl

    @classmethod
    def read_max_weight(cls, dbfile, datapos):
        weightspos = datapos + 1 + _FLOAT_SIZE + _INT_SIZE + 2
        return dbfile.get_float(weightspos)


# Segment implementation

class W3Segment(base.Segment):
    def __init__(self, codec, indexname, doccount=0, segid=None, deleted=None):
        self.indexname = indexname
        self.segid = self._random_id() if segid is None else segid

        self._codec = codec
        self._doccount = doccount
        self._deleted = deleted
        self.compound = False

    def codec(self, **kwargs):
        return self._codec

    def set_doc_count(self, dc):
        self._doccount = dc

    def doc_count_all(self):
        return self._doccount

    def deleted_count(self):
        if self._deleted is None:
            return 0
        return len(self._deleted)

    def deleted_docs(self):
        if self._deleted is None:
            return ()
        else:
            return iter(self._deleted)

    def delete_document(self, docnum, delete=True):
        if delete:
            if self._deleted is None:
                self._deleted = set()
            self._deleted.add(docnum)
        elif self._deleted is not None and docnum in self._deleted:
            self._deleted.clear(docnum)

    def is_deleted(self, docnum):
        if self._deleted is None:
            return False
        return docnum in self._deleted
