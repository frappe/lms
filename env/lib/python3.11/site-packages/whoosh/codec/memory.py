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

from __future__ import with_statement
from bisect import bisect_left
from threading import Lock, RLock

from whoosh.compat import xrange
from whoosh.codec import base
from whoosh.matching import ListMatcher
from whoosh.reading import SegmentReader, TermInfo, TermNotFound
from whoosh.writing import SegmentWriter


class MemWriter(SegmentWriter):
    def commit(self):
        self._finalize_segment()


class MemoryCodec(base.Codec):
    def __init__(self):
        from whoosh.filedb.filestore import RamStorage

        self.storage = RamStorage()
        self.segment = MemSegment(self, "blah")

    def writer(self, schema):
        ix = self.storage.create_index(schema)
        return MemWriter(ix, _lk=False, codec=self,
                         docbase=self.segment._doccount)

    def reader(self, schema):
        return SegmentReader(self.storage, schema, self.segment, codec=self)

    def per_document_writer(self, storage, segment):
        return MemPerDocWriter(self.storage, self.segment)

    def field_writer(self, storage, segment):
        return MemFieldWriter(self.storage, self.segment)

    def per_document_reader(self, storage, segment):
        return MemPerDocReader(self.storage, self.segment)

    def terms_reader(self, storage, segment):
        return MemTermsReader(self.storage, self.segment)

    def new_segment(self, storage, indexname):
        return self.segment


class MemPerDocWriter(base.PerDocWriterWithColumns):
    def __init__(self, storage, segment):
        self._storage = storage
        self._segment = segment
        self.is_closed = False
        self._colwriters = {}
        self._doccount = 0

    def _has_column(self, fieldname):
        return fieldname in self._colwriters

    def _create_column(self, fieldname, column):
        colfile = self._storage.create_file("%s.c" % fieldname)
        self._colwriters[fieldname] = (colfile, column.writer(colfile))

    def _get_column(self, fieldname):
        return self._colwriters[fieldname][1]

    def start_doc(self, docnum):
        self._doccount += 1
        self._docnum = docnum
        self._stored = {}
        self._lengths = {}
        self._vectors = {}

    def add_field(self, fieldname, fieldobj, value, length):
        if value is not None:
            self._stored[fieldname] = value
        if length is not None:
            self._lengths[fieldname] = length

    def add_vector_items(self, fieldname, fieldobj, items):
        self._vectors[fieldname] = tuple(items)

    def finish_doc(self):
        with self._segment._lock:
            docnum = self._docnum
            self._segment._stored[docnum] = self._stored
            self._segment._lengths[docnum] = self._lengths
            self._segment._vectors[docnum] = self._vectors

    def close(self):
        colwriters = self._colwriters
        for fieldname in colwriters:
            colfile, colwriter = colwriters[fieldname]
            colwriter.finish(self._doccount)
            colfile.close()
        self.is_closed = True


class MemPerDocReader(base.PerDocumentReader):
    def __init__(self, storage, segment):
        self._storage = storage
        self._segment = segment

    def doc_count(self):
        return self._segment.doc_count()

    def doc_count_all(self):
        return self._segment.doc_count_all()

    def has_deletions(self):
        return self._segment.has_deletions()

    def is_deleted(self, docnum):
        return self._segment.is_deleted(docnum)

    def deleted_docs(self):
        return self._segment.deleted_docs()

    def supports_columns(self):
        return True

    def has_column(self, fieldname):
        filename = "%s.c" % fieldname
        return self._storage.file_exists(filename)

    def column_reader(self, fieldname, column):
        filename = "%s.c" % fieldname
        colfile = self._storage.open_file(filename)
        length = self._storage.file_length(filename)
        return column.reader(colfile, 0, length, self._segment.doc_count_all())

    def doc_field_length(self, docnum, fieldname, default=0):
        return self._segment._lengths[docnum].get(fieldname, default)

    def field_length(self, fieldname):
        return sum(lens.get(fieldname, 0) for lens
                   in self._segment._lengths.values())

    def min_field_length(self, fieldname):
        return min(lens[fieldname] for lens in self._segment._lengths.values()
                   if fieldname in lens)

    def max_field_length(self, fieldname):
        return max(lens[fieldname] for lens in self._segment._lengths.values()
                   if fieldname in lens)

    def has_vector(self, docnum, fieldname):
        return (docnum in self._segment._vectors
                and fieldname in self._segment._vectors[docnum])

    def vector(self, docnum, fieldname, format_):
        items = self._segment._vectors[docnum][fieldname]
        ids, weights, values = zip(*items)
        return ListMatcher(ids, weights, values, format_)

    def stored_fields(self, docnum):
        return self._segment._stored[docnum]

    def close(self):
        pass


class MemFieldWriter(base.FieldWriter):
    def __init__(self, storage, segment):
        self._storage = storage
        self._segment = segment
        self._fieldname = None
        self._btext = None
        self.is_closed = False

    def start_field(self, fieldname, fieldobj):
        if self._fieldname is not None:
            raise Exception("Called start_field in a field")

        with self._segment._lock:
            invindex = self._segment._invindex
            if fieldname not in invindex:
                invindex[fieldname] = {}

        self._fieldname = fieldname
        self._fieldobj = fieldobj

    def start_term(self, btext):
        if self._btext is not None:
            raise Exception("Called start_term in a term")
        fieldname = self._fieldname

        fielddict = self._segment._invindex[fieldname]
        terminfos = self._segment._terminfos
        with self._segment._lock:
            if btext not in fielddict:
                fielddict[btext] = []

            if (fieldname, btext) not in terminfos:
                terminfos[fieldname, btext] = TermInfo()

        self._postings = fielddict[btext]
        self._terminfo = terminfos[fieldname, btext]
        self._btext = btext

    def add(self, docnum, weight, vbytes, length):
        self._postings.append((docnum, weight, vbytes))
        self._terminfo.add_posting(docnum, weight, length)

    def finish_term(self):
        if self._btext is None:
            raise Exception("Called finish_term outside a term")

        self._postings = None
        self._btext = None
        self._terminfo = None

    def finish_field(self):
        if self._fieldname is None:
            raise Exception("Called finish_field outside a field")
        self._fieldname = None
        self._fieldobj = None

    def close(self):
        self.is_closed = True


class MemTermsReader(base.TermsReader):
    def __init__(self, storage, segment):
        self._storage = storage
        self._segment = segment
        self._invindex = segment._invindex

    def __contains__(self, term):
        return term in self._segment._terminfos

    def terms(self):
        for fieldname in self._invindex:
            for btext in self._invindex[fieldname]:
                yield (fieldname, btext)

    def terms_from(self, fieldname, prefix):
        if fieldname not in self._invindex:
            raise TermNotFound("Unknown field %r" % (fieldname,))
        terms = sorted(self._invindex[fieldname])
        if not terms:
            return
        start = bisect_left(terms, prefix)
        for i in xrange(start, len(terms)):
            yield (fieldname, terms[i])

    def term_info(self, fieldname, text):
        return self._segment._terminfos[fieldname, text]

    def matcher(self, fieldname, btext, format_, scorer=None):
        items = self._invindex[fieldname][btext]
        ids, weights, values = zip(*items)
        return ListMatcher(ids, weights, values, format_, scorer=scorer)

    def indexed_field_names(self):
        return self._invindex.keys()

    def close(self):
        pass


class MemSegment(base.Segment):
    def __init__(self, codec, indexname):
        base.Segment.__init__(self, indexname)
        self._codec = codec
        self._doccount = 0
        self._stored = {}
        self._lengths = {}
        self._vectors = {}
        self._invindex = {}
        self._terminfos = {}
        self._lock = Lock()

    def codec(self):
        return self._codec

    def set_doc_count(self, doccount):
        self._doccount = doccount

    def doc_count(self):
        return len(self._stored)

    def doc_count_all(self):
        return self._doccount

    def delete_document(self, docnum, delete=True):
        if not delete:
            raise Exception("MemoryCodec can't undelete")
        with self._lock:
            del self._stored[docnum]
            del self._lengths[docnum]
            del self._vectors[docnum]

    def has_deletions(self):
        with self._lock:
            return self._doccount - len(self._stored)

    def is_deleted(self, docnum):
        return docnum not in self._stored

    def deleted_docs(self):
        stored = self._stored
        for docnum in xrange(self.doc_count_all()):
            if docnum not in stored:
                yield docnum

    def should_assemble(self):
        return False
