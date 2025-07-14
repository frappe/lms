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

from __future__ import with_statement
import threading, time
from bisect import bisect_right
from contextlib import contextmanager

from whoosh import columns
from whoosh.compat import abstractmethod, bytes_type
from whoosh.externalsort import SortingPool
from whoosh.fields import UnknownFieldError
from whoosh.index import LockError
from whoosh.system import emptybytes
from whoosh.util import fib, random_name
from whoosh.util.filelock import try_for
from whoosh.util.text import utf8encode


# Exceptions

class IndexingError(Exception):
    pass


# Document grouping context manager

@contextmanager
def groupmanager(writer):
    writer.start_group()
    yield
    writer.end_group()


# Merge policies

# A merge policy is a callable that takes the Index object, the SegmentWriter
# object, and the current segment list (not including the segment being
# written), and returns an updated segment list (not including the segment
# being written).

def NO_MERGE(writer, segments):
    """This policy does not merge any existing segments.
    """
    return segments


def MERGE_SMALL(writer, segments):
    """This policy merges small segments, where "small" is defined using a
    heuristic based on the fibonacci sequence.
    """

    from whoosh.reading import SegmentReader

    unchanged_segments = []
    segments_to_merge = []

    sorted_segment_list = sorted(segments, key=lambda s: s.doc_count_all())
    total_docs = 0

    merge_point_found = False
    for i, seg in enumerate(sorted_segment_list):
        count = seg.doc_count_all()
        if count > 0:
            total_docs += count

        if merge_point_found:  # append the remaining to unchanged
            unchanged_segments.append(seg)
        else:  # look for a merge point
            segments_to_merge.append((seg, i)) # merge every segment up to the merge point
            if i > 3 and total_docs < fib(i + 5):  
                merge_point_found = True

    if merge_point_found and len(segments_to_merge) > 1:
        for seg, i in segments_to_merge:
            reader = SegmentReader(writer.storage, writer.schema, seg)
            writer.add_reader(reader)
            reader.close()
        return unchanged_segments
    else:
        return segments


def OPTIMIZE(writer, segments):
    """This policy merges all existing segments.
    """

    from whoosh.reading import SegmentReader

    for seg in segments:
        reader = SegmentReader(writer.storage, writer.schema, seg)
        writer.add_reader(reader)
        reader.close()
    return []


def CLEAR(writer, segments):
    """This policy DELETES all existing segments and only writes the new
    segment.
    """

    return []


# Customized sorting pool for postings

class PostingPool(SortingPool):
    # Subclass whoosh.externalsort.SortingPool to use knowledge of
    # postings to set run size in bytes instead of items

    namechars = "abcdefghijklmnopqrstuvwxyz0123456789"

    def __init__(self, tempstore, segment, limitmb=128, **kwargs):
        SortingPool.__init__(self, **kwargs)
        self.tempstore = tempstore
        self.segment = segment
        self.limit = limitmb * 1024 * 1024
        self.currentsize = 0
        self.fieldnames = set()

    def _new_run(self):
        path = "%s.run" % random_name()
        f = self.tempstore.create_file(path).raw_file()
        return path, f

    def _open_run(self, path):
        return self.tempstore.open_file(path).raw_file()

    def _remove_run(self, path):
        return self.tempstore.delete_file(path)

    def add(self, item):
        # item = (fieldname, tbytes, docnum, weight, vbytes)
        assert isinstance(item[1], bytes_type), "tbytes=%r" % item[1]
        if item[4] is not None:
            assert isinstance(item[4], bytes_type), "vbytes=%r" % item[4]
        self.fieldnames.add(item[0])
        size = (28 + 4 * 5  # tuple = 28 + 4 * length
                + 21 + len(item[0])  # fieldname = str = 21 + length
                + 26 + len(item[1]) * 2  # text = unicode = 26 + 2 * length
                + 18  # docnum = long = 18
                + 16  # weight = float = 16
                + 21 + len(item[4] or ''))  # valuestring
        self.currentsize += size
        if self.currentsize > self.limit:
            self.save()
        self.current.append(item)

    def iter_postings(self):
        # This is just an alias for items() to be consistent with the
        # iter_postings()/add_postings() interface of a lot of other classes
        return self.items()

    def save(self):
        SortingPool.save(self)
        self.currentsize = 0


# Writer base class

class IndexWriter(object):
    """High-level object for writing to an index.

    To get a writer for a particular index, call
    :meth:`~whoosh.index.Index.writer` on the Index object.

    >>> writer = myindex.writer()

    You can use this object as a context manager. If an exception is thrown
    from within the context it calls :meth:`~IndexWriter.cancel` to clean up
    temporary files, otherwise it calls :meth:`~IndexWriter.commit` when the
    context exits.

    >>> with myindex.writer() as w:
    ...     w.add_document(title="First document", content="Hello there.")
    ...     w.add_document(title="Second document", content="This is easy!")
    """

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.cancel()
        else:
            self.commit()

    def group(self):
        """Returns a context manager that calls
        :meth:`~IndexWriter.start_group` and :meth:`~IndexWriter.end_group` for
        you, allowing you to use a ``with`` statement to group hierarchical
        documents::

            with myindex.writer() as w:
                with w.group():
                    w.add_document(kind="class", name="Accumulator")
                    w.add_document(kind="method", name="add")
                    w.add_document(kind="method", name="get_result")
                    w.add_document(kind="method", name="close")

                with w.group():
                    w.add_document(kind="class", name="Calculator")
                    w.add_document(kind="method", name="add")
                    w.add_document(kind="method", name="multiply")
                    w.add_document(kind="method", name="get_result")
                    w.add_document(kind="method", name="close")
        """

        return groupmanager(self)

    def start_group(self):
        """Start indexing a group of hierarchical documents. The backend should
        ensure that these documents are all added to the same segment::

            with myindex.writer() as w:
                w.start_group()
                w.add_document(kind="class", name="Accumulator")
                w.add_document(kind="method", name="add")
                w.add_document(kind="method", name="get_result")
                w.add_document(kind="method", name="close")
                w.end_group()

                w.start_group()
                w.add_document(kind="class", name="Calculator")
                w.add_document(kind="method", name="add")
                w.add_document(kind="method", name="multiply")
                w.add_document(kind="method", name="get_result")
                w.add_document(kind="method", name="close")
                w.end_group()

        A more convenient way to group documents is to use the
        :meth:`~IndexWriter.group` method and the ``with`` statement.
        """

        pass

    def end_group(self):
        """Finish indexing a group of hierarchical documents. See
        :meth:`~IndexWriter.start_group`.
        """

        pass

    def add_field(self, fieldname, fieldtype, **kwargs):
        """Adds a field to the index's schema.

        :param fieldname: the name of the field to add.
        :param fieldtype: an instantiated :class:`whoosh.fields.FieldType`
            object.
        """

        self.schema.add(fieldname, fieldtype, **kwargs)

    def remove_field(self, fieldname, **kwargs):
        """Removes the named field from the index's schema. Depending on the
        backend implementation, this may or may not actually remove existing
        data for the field from the index. Optimizing the index should always
        clear out existing data for a removed field.
        """

        self.schema.remove(fieldname, **kwargs)

    @abstractmethod
    def reader(self, **kwargs):
        """Returns a reader for the existing index.
        """

        raise NotImplementedError

    def searcher(self, **kwargs):
        from whoosh.searching import Searcher

        return Searcher(self.reader(), **kwargs)

    def delete_by_term(self, fieldname, text, searcher=None):
        """Deletes any documents containing "term" in the "fieldname" field.
        This is useful when you have an indexed field containing a unique ID
        (such as "pathname") for each document.

        :returns: the number of documents deleted.
        """

        from whoosh.query import Term

        q = Term(fieldname, text)
        return self.delete_by_query(q, searcher=searcher)

    def delete_by_query(self, q, searcher=None):
        """Deletes any documents matching a query object.

        :returns: the number of documents deleted.
        """

        if searcher:
            s = searcher
        else:
            s = self.searcher()

        try:
            count = 0
            for docnum in s.docs_for_query(q, for_deletion=True):
                self.delete_document(docnum)
                count += 1
        finally:
            if not searcher:
                s.close()

        return count

    @abstractmethod
    def delete_document(self, docnum, delete=True):
        """Deletes a document by number.
        """
        raise NotImplementedError

    @abstractmethod
    def add_document(self, **fields):
        """The keyword arguments map field names to the values to index/store::

            w = myindex.writer()
            w.add_document(path=u"/a", title=u"First doc", text=u"Hello")
            w.commit()

        Depending on the field type, some fields may take objects other than
        unicode strings. For example, NUMERIC fields take numbers, and DATETIME
        fields take ``datetime.datetime`` objects::

            from datetime import datetime, timedelta
            from whoosh import index
            from whoosh.fields import *

            schema = Schema(date=DATETIME, size=NUMERIC(float), content=TEXT)
            myindex = index.create_in("indexdir", schema)

            w = myindex.writer()
            w.add_document(date=datetime.now(), size=5.5, content=u"Hello")
            w.commit()

        Instead of a single object (i.e., unicode string, number, or datetime),
        you can supply a list or tuple of objects. For unicode strings, this
        bypasses the field's analyzer. For numbers and dates, this lets you add
        multiple values for the given field::

            date1 = datetime.now()
            date2 = datetime(2005, 12, 25)
            date3 = datetime(1999, 1, 1)
            w.add_document(date=[date1, date2, date3], size=[9.5, 10],
                           content=[u"alfa", u"bravo", u"charlie"])

        For fields that are both indexed and stored, you can specify an
        alternate value to store using a keyword argument in the form
        "_stored_<fieldname>". For example, if you have a field named "title"
        and you want to index the text "a b c" but store the text "e f g", use
        keyword arguments like this::

            writer.add_document(title=u"a b c", _stored_title=u"e f g")

        You can boost the weight of all terms in a certain field by specifying
        a ``_<fieldname>_boost`` keyword argument. For example, if you have a
        field named "content", you can double the weight of this document for
        searches in the "content" field like this::

            writer.add_document(content="a b c", _title_boost=2.0)

        You can boost every field at once using the ``_boost`` keyword. For
        example, to boost fields "a" and "b" by 2.0, and field "c" by 3.0::

            writer.add_document(a="alfa", b="bravo", c="charlie",
                                _boost=2.0, _c_boost=3.0)

        Note that some scoring algroithms, including Whoosh's default BM25F,
        do not work with term weights less than 1, so you should generally not
        use a boost factor less than 1.

        See also :meth:`Writer.update_document`.
        """

        raise NotImplementedError

    @abstractmethod
    def add_reader(self, reader):
        raise NotImplementedError

    def _doc_boost(self, fields, default=1.0):
        if "_boost" in fields:
            return float(fields["_boost"])
        else:
            return default

    def _field_boost(self, fields, fieldname, default=1.0):
        boostkw = "_%s_boost" % fieldname
        if boostkw in fields:
            return float(fields[boostkw])
        else:
            return default

    def _unique_fields(self, fields):
        # Check which of the supplied fields are unique
        unique_fields = [name for name, field in self.schema.items()
                         if name in fields and field.unique]
        return unique_fields

    def update_document(self, **fields):
        """The keyword arguments map field names to the values to index/store.

        This method adds a new document to the index, and automatically deletes
        any documents with the same values in any fields marked "unique" in the
        schema::

            schema = fields.Schema(path=fields.ID(unique=True, stored=True),
                                   content=fields.TEXT)
            myindex = index.create_in("index", schema)

            w = myindex.writer()
            w.add_document(path=u"/", content=u"Mary had a lamb")
            w.commit()

            w = myindex.writer()
            w.update_document(path=u"/", content=u"Mary had a little lamb")
            w.commit()

            assert myindex.doc_count() == 1

        It is safe to use ``update_document`` in place of ``add_document``; if
        there is no existing document to replace, it simply does an add.

        You cannot currently pass a list or tuple of values to a "unique"
        field.

        Because this method has to search for documents with the same unique
        fields and delete them before adding the new document, it is slower
        than using ``add_document``.

        * Marking more fields "unique" in the schema will make each
          ``update_document`` call slightly slower.

        * When you are updating multiple documents, it is faster to batch
          delete all changed documents and then use ``add_document`` to add
          the replacements instead of using ``update_document``.

        Note that this method will only replace a *committed* document;
        currently it cannot replace documents you've added to the IndexWriter
        but haven't yet committed. For example, if you do this:

        >>> writer.update_document(unique_id=u"1", content=u"Replace me")
        >>> writer.update_document(unique_id=u"1", content=u"Replacement")

        ...this will add two documents with the same value of ``unique_id``,
        instead of the second document replacing the first.

        See :meth:`Writer.add_document` for information on
        ``_stored_<fieldname>``, ``_<fieldname>_boost``, and ``_boost`` keyword
        arguments.
        """

        # Delete the set of documents matching the unique terms
        unique_fields = self._unique_fields(fields)
        if unique_fields:
            with self.searcher() as s:
                uniqueterms = [(name, fields[name]) for name in unique_fields]
                docs = s._find_unique(uniqueterms)
                for docnum in docs:
                    self.delete_document(docnum)

        # Add the given fields
        self.add_document(**fields)

    def commit(self):
        """Finishes writing and unlocks the index.
        """
        pass

    def cancel(self):
        """Cancels any documents/deletions added by this object
        and unlocks the index.
        """
        pass


# Codec-based writer

class SegmentWriter(IndexWriter):
    def __init__(self, ix, poolclass=None, timeout=0.0, delay=0.1, _lk=True,
                 limitmb=128, docbase=0, codec=None, compound=True, **kwargs):
        # Lock the index
        self.writelock = None
        if _lk:
            self.writelock = ix.lock("WRITELOCK")
            if not try_for(self.writelock.acquire, timeout=timeout,
                           delay=delay):
                raise LockError

        if codec is None:
            from whoosh.codec import default_codec
            codec = default_codec()
        self.codec = codec

        # Get info from the index
        self.storage = ix.storage
        self.indexname = ix.indexname
        info = ix._read_toc()
        self.generation = info.generation + 1
        self.schema = info.schema
        self.segments = info.segments
        self.docnum = self.docbase = docbase
        self._setup_doc_offsets()

        # Internals
        self._tempstorage = self.storage.temp_storage("%s.tmp" % self.indexname)
        newsegment = codec.new_segment(self.storage, self.indexname)
        self.newsegment = newsegment
        self.compound = compound and newsegment.should_assemble()
        self.is_closed = False
        self._added = False
        self.pool = PostingPool(self._tempstorage, self.newsegment,
                                limitmb=limitmb)

        # Set up writers
        self.perdocwriter = codec.per_document_writer(self.storage, newsegment)
        self.fieldwriter = codec.field_writer(self.storage, newsegment)

        self.merge = True
        self.optimize = False
        self.mergetype = None

    def __repr__(self):
        return "<%s %r>" % (self.__class__.__name__, self.newsegment)

    def _check_state(self):
        if self.is_closed:
            raise IndexingError("This writer is closed")

    def _setup_doc_offsets(self):
        self._doc_offsets = []
        base = 0
        for s in self.segments:
            self._doc_offsets.append(base)
            base += s.doc_count_all()

    def _document_segment(self, docnum):
        #Returns the index.Segment object containing the given document
        #number.
        offsets = self._doc_offsets
        if len(offsets) == 1:
            return 0
        return bisect_right(offsets, docnum) - 1

    def _segment_and_docnum(self, docnum):
        #Returns an (index.Segment, segment_docnum) pair for the segment
        #containing the given document number.

        segmentnum = self._document_segment(docnum)
        offset = self._doc_offsets[segmentnum]
        segment = self.segments[segmentnum]
        return segment, docnum - offset

    def _process_posts(self, items, startdoc, docmap):
        schema = self.schema
        for fieldname, text, docnum, weight, vbytes in items:
            if fieldname not in schema:
                continue
            if docmap is not None:
                newdoc = docmap[docnum]
            else:
                newdoc = startdoc + docnum

            yield (fieldname, text, newdoc, weight, vbytes)

    def temp_storage(self):
        return self._tempstorage

    def add_field(self, fieldname, fieldspec, **kwargs):
        self._check_state()
        if self._added:
            raise Exception("Can't modify schema after adding data to writer")
        super(SegmentWriter, self).add_field(fieldname, fieldspec, **kwargs)

    def remove_field(self, fieldname):
        self._check_state()
        if self._added:
            raise Exception("Can't modify schema after adding data to writer")
        super(SegmentWriter, self).remove_field(fieldname)

    def has_deletions(self):
        """
        Returns True if the current index has documents that are marked deleted
        but haven't been optimized out of the index yet.
        """

        return any(s.has_deletions() for s in self.segments)

    def delete_document(self, docnum, delete=True):
        self._check_state()
        if docnum >= sum(seg.doc_count_all() for seg in self.segments):
            raise IndexingError("No document ID %r in this index" % docnum)
        segment, segdocnum = self._segment_and_docnum(docnum)
        segment.delete_document(segdocnum, delete=delete)

    def deleted_count(self):
        """
        :returns: the total number of deleted documents in the index.
        """

        return sum(s.deleted_count() for s in self.segments)

    def is_deleted(self, docnum):
        segment, segdocnum = self._segment_and_docnum(docnum)
        return segment.is_deleted(segdocnum)

    def reader(self, reuse=None):
        from whoosh.index import FileIndex

        self._check_state()
        return FileIndex._reader(self.storage, self.schema, self.segments,
                                 self.generation, reuse=reuse)

    def iter_postings(self):
        return self.pool.iter_postings()

    def add_postings_to_pool(self, reader, startdoc, docmap):
        items = self._process_posts(reader.iter_postings(), startdoc, docmap)
        add_post = self.pool.add
        for item in items:
            add_post(item)

    def write_postings(self, lengths, items, startdoc, docmap):
        items = self._process_posts(items, startdoc, docmap)
        self.fieldwriter.add_postings(self.schema, lengths, items)

    def write_per_doc(self, fieldnames, reader):
        # Very bad hack: reader should be an IndexReader, but may be a
        # PerDocumentReader if this is called from multiproc, where the code
        # tries to be efficient by merging per-doc and terms separately.
        # TODO: fix this!

        schema = self.schema
        if reader.has_deletions():
            docmap = {}
        else:
            docmap = None

        pdw = self.perdocwriter
        # Open all column readers
        cols = {}
        for fieldname in fieldnames:
            fieldobj = schema[fieldname]
            coltype = fieldobj.column_type
            if coltype and reader.has_column(fieldname):
                creader = reader.column_reader(fieldname, coltype)
                if isinstance(creader, columns.TranslatingColumnReader):
                    creader = creader.raw_column()
                cols[fieldname] = creader

        for docnum, stored in reader.iter_docs():
            if docmap is not None:
                docmap[docnum] = self.docnum

            pdw.start_doc(self.docnum)
            for fieldname in fieldnames:
                fieldobj = schema[fieldname]
                length = reader.doc_field_length(docnum, fieldname)
                pdw.add_field(fieldname, fieldobj,
                              stored.get(fieldname), length)

                if fieldobj.vector and reader.has_vector(docnum, fieldname):
                    v = reader.vector(docnum, fieldname, fieldobj.vector)
                    pdw.add_vector_matcher(fieldname, fieldobj, v)

                if fieldname in cols:
                    cv = cols[fieldname][docnum]
                    pdw.add_column_value(fieldname, fieldobj.column_type, cv)

            pdw.finish_doc()
            self.docnum += 1

        return docmap

    def add_reader(self, reader):
        self._check_state()
        basedoc = self.docnum
        ndxnames = set(fname for fname in reader.indexed_field_names()
                       if fname in self.schema)
        fieldnames = set(self.schema.names()) | ndxnames

        docmap = self.write_per_doc(fieldnames, reader)
        self.add_postings_to_pool(reader, basedoc, docmap)
        self._added = True

    def _check_fields(self, schema, fieldnames):
        # Check if the caller gave us a bogus field
        for name in fieldnames:
            if name not in schema:
                raise UnknownFieldError("No field named %r in %s"
                                        % (name, schema))

    def add_document(self, **fields):
        self._check_state()
        perdocwriter = self.perdocwriter
        schema = self.schema
        docnum = self.docnum
        add_post = self.pool.add

        docboost = self._doc_boost(fields)
        fieldnames = sorted([name for name in fields.keys()
                             if not name.startswith("_")])
        self._check_fields(schema, fieldnames)

        perdocwriter.start_doc(docnum)
        for fieldname in fieldnames:
            value = fields.get(fieldname)
            if value is None:
                continue
            field = schema[fieldname]

            length = 0
            if field.indexed:
                # TODO: Method for adding progressive field values, ie
                # setting start_pos/start_char?
                fieldboost = self._field_boost(fields, fieldname, docboost)
                # Ask the field to return a list of (text, weight, vbytes)
                # tuples
                items = field.index(value)
                # Only store the length if the field is marked scorable
                scorable = field.scorable
                # Add the terms to the pool
                for tbytes, freq, weight, vbytes in items:
                    weight *= fieldboost
                    if scorable:
                        length += freq
                    add_post((fieldname, tbytes, docnum, weight, vbytes))

            if field.separate_spelling():
                spellfield = field.spelling_fieldname(fieldname)
                for word in field.spellable_words(value):
                    word = utf8encode(word)[0]
                    # item = (fieldname, tbytes, docnum, weight, vbytes)
                    add_post((spellfield, word, 0, 1, vbytes))

            vformat = field.vector
            if vformat:
                analyzer = field.analyzer
                # Call the format's word_values method to get posting values
                vitems = vformat.word_values(value, analyzer, mode="index")
                # Remove unused frequency field from the tuple
                vitems = sorted((text, weight, vbytes)
                                for text, _, weight, vbytes in vitems)
                perdocwriter.add_vector_items(fieldname, field, vitems)

            # Allow a custom value for stored field/column
            customval = fields.get("_stored_%s" % fieldname, value)

            # Add the stored value and length for this field to the per-
            # document writer
            sv = customval if field.stored else None
            perdocwriter.add_field(fieldname, field, sv, length)

            column = field.column_type
            if column and customval is not None:
                cv = field.to_column_value(customval)
                perdocwriter.add_column_value(fieldname, column, cv)

        perdocwriter.finish_doc()
        self._added = True
        self.docnum += 1

    def doc_count(self):
        return self.docnum - self.docbase

    def get_segment(self):
        newsegment = self.newsegment
        newsegment.set_doc_count(self.docnum)
        return newsegment

    def per_document_reader(self):
        if not self.perdocwriter.is_closed:
            raise Exception("Per-doc writer is still open")
        return self.codec.per_document_reader(self.storage, self.get_segment())

    # The following methods break out the commit functionality into smaller
    # pieces to allow MpWriter to call them individually

    def _merge_segments(self, mergetype, optimize, merge):
        # The writer supports two ways of setting mergetype/optimize/merge:
        # as attributes or as keyword arguments to commit(). Originally there
        # were just the keyword arguments, but then I added the ability to use
        # the writer as a context manager using "with", so the user no longer
        # explicitly called commit(), hence the attributes
        mergetype = mergetype if mergetype is not None else self.mergetype
        optimize = optimize if optimize is not None else self.optimize
        merge = merge if merge is not None else self.merge

        if mergetype:
            pass
        elif optimize:
            mergetype = OPTIMIZE
        elif not merge:
            mergetype = NO_MERGE
        else:
            mergetype = MERGE_SMALL

        # Call the merge policy function. The policy may choose to merge
        # other segments into this writer's pool
        return mergetype(self, self.segments)

    def _flush_segment(self):
        self.perdocwriter.close()
        if self.codec.length_stats:
            pdr = self.per_document_reader()
        else:
            pdr = None
        postings = self.pool.iter_postings()
        self.fieldwriter.add_postings(self.schema, pdr, postings)
        self.fieldwriter.close()
        if pdr:
            pdr.close()

    def _close_segment(self):
        if not self.perdocwriter.is_closed:
            self.perdocwriter.close()
        if not self.fieldwriter.is_closed:
            self.fieldwriter.close()
        self.pool.cleanup()

    def _assemble_segment(self):
        if self.compound:
            # Assemble the segment files into a compound file
            newsegment = self.get_segment()
            newsegment.create_compound_file(self.storage)
            newsegment.compound = True

    def _partial_segment(self):
        # For use by a parent multiprocessing writer: Closes out the segment
        # but leaves the pool files intact so the parent can access them
        self._check_state()
        self.perdocwriter.close()
        self.fieldwriter.close()
        # Don't call self.pool.cleanup()! We want to grab the pool files.
        return self.get_segment()

    def _finalize_segment(self):
        # Finish writing segment
        self._flush_segment()
        # Close segment files
        self._close_segment()
        # Assemble compound segment if necessary
        self._assemble_segment()

        return self.get_segment()

    def _commit_toc(self, segments):
        from whoosh.index import TOC, clean_files

        # Write a new TOC with the new segment list (and delete old files)
        toc = TOC(self.schema, segments, self.generation)
        toc.write(self.storage, self.indexname)
        # Delete leftover files
        clean_files(self.storage, self.indexname, self.generation, segments)

    def _finish(self):
        self._tempstorage.destroy()
        if self.writelock:
            self.writelock.release()
        self.is_closed = True
        #self.storage.close()

    # Finalization methods

    def commit(self, mergetype=None, optimize=None, merge=None):
        """Finishes writing and saves all additions and changes to disk.

        There are four possible ways to use this method::

            # Merge small segments but leave large segments, trying to
            # balance fast commits with fast searching:
            writer.commit()

            # Merge all segments into a single segment:
            writer.commit(optimize=True)

            # Don't merge any existing segments:
            writer.commit(merge=False)

            # Use a custom merge function
            writer.commit(mergetype=my_merge_function)

        :param mergetype: a custom merge function taking a Writer object and
            segment list as arguments, and returning a new segment list. If you
            supply a ``mergetype`` function, the values of the ``optimize`` and
            ``merge`` arguments are ignored.
        :param optimize: if True, all existing segments are merged with the
            documents you've added to this writer (and the value of the
            ``merge`` argument is ignored).
        :param merge: if False, do not merge small segments.
        """

        self._check_state()
        # Merge old segments if necessary
        finalsegments = self._merge_segments(mergetype, optimize, merge)
        if self._added:
            # Flush the current segment being written and add it to the
            # list of remaining segments returned by the merge policy
            # function
            finalsegments.append(self._finalize_segment())
        else:
            # Close segment files
            self._close_segment()
        # Write TOC
        self._commit_toc(finalsegments)

        # Final cleanup
        self._finish()

    def cancel(self):
        self._check_state()
        self._close_segment()
        self._finish()


# Writer wrappers

class AsyncWriter(threading.Thread, IndexWriter):
    """Convenience wrapper for a writer object that might fail due to locking
    (i.e. the ``filedb`` writer). This object will attempt once to obtain the
    underlying writer, and if it's successful, will simply pass method calls on
    to it.

    If this object *can't* obtain a writer immediately, it will *buffer*
    delete, add, and update method calls in memory until you call ``commit()``.
    At that point, this object will start running in a separate thread, trying
    to obtain the writer over and over, and once it obtains it, "replay" all
    the buffered method calls on it.

    In a typical scenario where you're adding a single or a few documents to
    the index as the result of a Web transaction, this lets you just create the
    writer, add, and commit, without having to worry about index locks,
    retries, etc.

    For example, to get an aynchronous writer, instead of this:

    >>> writer = myindex.writer()

    Do this:

    >>> from whoosh.writing import AsyncWriter
    >>> writer = AsyncWriter(myindex)
    """

    def __init__(self, index, delay=0.25, writerargs=None):
        """
        :param index: the :class:`whoosh.index.Index` to write to.
        :param delay: the delay (in seconds) between attempts to instantiate
            the actual writer.
        :param writerargs: an optional dictionary specifying keyword arguments
            to to be passed to the index's ``writer()`` method.
        """

        threading.Thread.__init__(self)
        self.running = False
        self.index = index
        self.writerargs = writerargs or {}
        self.delay = delay
        self.events = []
        try:
            self.writer = self.index.writer(**self.writerargs)
        except LockError:
            self.writer = None

    def reader(self):
        return self.index.reader()

    def searcher(self, **kwargs):
        from whoosh.searching import Searcher
        return Searcher(self.reader(), fromindex=self.index, **kwargs)

    def _record(self, method, args, kwargs):
        if self.writer:
            getattr(self.writer, method)(*args, **kwargs)
        else:
            self.events.append((method, args, kwargs))

    def run(self):
        self.running = True
        writer = self.writer
        while writer is None:
            try:
                writer = self.index.writer(**self.writerargs)
            except LockError:
                time.sleep(self.delay)
        for method, args, kwargs in self.events:
            getattr(writer, method)(*args, **kwargs)
        writer.commit(*self.commitargs, **self.commitkwargs)

    def delete_document(self, *args, **kwargs):
        self._record("delete_document", args, kwargs)

    def add_document(self, *args, **kwargs):
        self._record("add_document", args, kwargs)

    def update_document(self, *args, **kwargs):
        self._record("update_document", args, kwargs)

    def add_field(self, *args, **kwargs):
        self._record("add_field", args, kwargs)

    def remove_field(self, *args, **kwargs):
        self._record("remove_field", args, kwargs)

    def delete_by_term(self, *args, **kwargs):
        self._record("delete_by_term", args, kwargs)

    def commit(self, *args, **kwargs):
        if self.writer:
            self.writer.commit(*args, **kwargs)
        else:
            self.commitargs, self.commitkwargs = args, kwargs
            self.start()

    def cancel(self, *args, **kwargs):
        if self.writer:
            self.writer.cancel(*args, **kwargs)


# Ex post factor functions

def add_spelling(ix, fieldnames, commit=True):
    """Adds spelling files to an existing index that was created without
    them, and modifies the schema so the given fields have the ``spelling``
    attribute. Only works on filedb indexes.

    >>> ix = index.open_dir("testindex")
    >>> add_spelling(ix, ["content", "tags"])

    :param ix: a :class:`whoosh.filedb.fileindex.FileIndex` object.
    :param fieldnames: a list of field names to create word graphs for.
    :param force: if True, overwrites existing word graph files. This is only
        useful for debugging.
    """

    from whoosh.automata import fst
    from whoosh.reading import SegmentReader

    writer = ix.writer()
    storage = writer.storage
    schema = writer.schema
    segments = writer.segments

    for segment in segments:
        ext = segment.codec().FST_EXT

        r = SegmentReader(storage, schema, segment)
        f = segment.create_file(storage, ext)
        gw = fst.GraphWriter(f)
        for fieldname in fieldnames:
            gw.start_field(fieldname)
            for word in r.lexicon(fieldname):
                gw.insert(word)
            gw.finish_field()
        gw.close()

    for fieldname in fieldnames:
        schema[fieldname].spelling = True

    if commit:
        writer.commit(merge=False)


# Buffered writer class

class BufferedWriter(IndexWriter):
    """Convenience class that acts like a writer but buffers added documents
    before dumping the buffered documents as a batch into the actual index.

    In scenarios where you are continuously adding single documents very
    rapidly (for example a web application where lots of users are adding
    content simultaneously), using a BufferedWriter is *much* faster than
    opening and committing a writer for each document you add. If you're adding
    batches of documents at a time, you can just use a regular writer.

    (This class may also be useful for batches of ``update_document`` calls. In
    a normal writer, ``update_document`` calls cannot update documents you've
    added *in that writer*. With ``BufferedWriter``, this will work.)

    To use this class, create it from your index and *keep it open*, sharing
    it between threads.

    >>> from whoosh.writing import BufferedWriter
    >>> writer = BufferedWriter(myindex, period=120, limit=20)
    >>> # Then you can use the writer to add and update documents
    >>> writer.add_document(...)
    >>> writer.add_document(...)
    >>> writer.add_document(...)
    >>> # Before the writer goes out of scope, call close() on it
    >>> writer.close()

    .. note::
        This object stores documents in memory and may keep an underlying
        writer open, so you must explicitly call the
        :meth:`~BufferedWriter.close` method on this object before it goes out
        of scope to release the write lock and make sure any uncommitted
        changes are saved.

    You can read/search the combination of the on-disk index and the
    buffered documents in memory by calling ``BufferedWriter.reader()`` or
    ``BufferedWriter.searcher()``. This allows quasi-real-time search, where
    documents are available for searching as soon as they are buffered in
    memory, before they are committed to disk.

    .. tip::
        By using a searcher from the shared writer, multiple *threads* can
        search the buffered documents. Of course, other *processes* will only
        see the documents that have been written to disk. If you want indexed
        documents to become available to other processes as soon as possible,
        you have to use a traditional writer instead of a ``BufferedWriter``.

    You can control how often the ``BufferedWriter`` flushes the in-memory
    index to disk using the ``period`` and ``limit`` arguments. ``period`` is
    the maximum number of seconds between commits. ``limit`` is the maximum
    number of additions to buffer between commits.

    You don't need to call ``commit()`` on the ``BufferedWriter`` manually.
    Doing so will just flush the buffered documents to disk early. You can
    continue to make changes after calling ``commit()``, and you can call
    ``commit()`` multiple times.
    """

    def __init__(self, index, period=60, limit=10, writerargs=None,
                 commitargs=None):
        """
        :param index: the :class:`whoosh.index.Index` to write to.
        :param period: the maximum amount of time (in seconds) between commits.
            Set this to ``0`` or ``None`` to not use a timer. Do not set this
            any lower than a few seconds.
        :param limit: the maximum number of documents to buffer before
            committing.
        :param writerargs: dictionary specifying keyword arguments to be passed
            to the index's ``writer()`` method when creating a writer.
        """

        self.index = index
        self.period = period
        self.limit = limit
        self.writerargs = writerargs or {}
        self.commitargs = commitargs or {}

        self.lock = threading.RLock()
        self.writer = self.index.writer(**self.writerargs)

        self._make_ram_index()
        self.bufferedcount = 0

        # Start timer
        if self.period:
            self.timer = threading.Timer(self.period, self.commit)
            self.timer.start()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _make_ram_index(self):
        from whoosh.codec.memory import MemoryCodec

        self.codec = MemoryCodec()

    def _get_ram_reader(self):
        return self.codec.reader(self.schema)

    @property
    def schema(self):
        return self.writer.schema

    def reader(self, **kwargs):
        from whoosh.reading import MultiReader

        reader = self.writer.reader()
        with self.lock:
            ramreader = self._get_ram_reader()

        # If there are in-memory docs, combine the readers
        if ramreader.doc_count():
            if reader.is_atomic():
                reader = MultiReader([reader, ramreader])
            else:
                reader.add_reader(ramreader)

        return reader

    def searcher(self, **kwargs):
        from whoosh.searching import Searcher

        return Searcher(self.reader(), fromindex=self.index, **kwargs)

    def close(self):
        self.commit(restart=False)

    def commit(self, restart=True):
        if self.period:
            self.timer.cancel()

        with self.lock:
            ramreader = self._get_ram_reader()
            self._make_ram_index()

        if self.bufferedcount:
            self.writer.add_reader(ramreader)
        self.writer.commit(**self.commitargs)
        self.bufferedcount = 0

        if restart:
            self.writer = self.index.writer(**self.writerargs)
            if self.period:
                self.timer = threading.Timer(self.period, self.commit)
                self.timer.start()

    def add_reader(self, reader):
        # Pass through to the underlying on-disk index
        self.writer.add_reader(reader)
        self.commit()

    def add_document(self, **fields):
        with self.lock:
            # Hijack a writer to make the calls into the codec
            with self.codec.writer(self.writer.schema) as w:
                w.add_document(**fields)

            self.bufferedcount += 1
            if self.bufferedcount >= self.limit:
                self.commit()

    def update_document(self, **fields):
        with self.lock:
            IndexWriter.update_document(self, **fields)

    def delete_document(self, docnum, delete=True):
        with self.lock:
            base = self.index.doc_count_all()
            if docnum < base:
                self.writer.delete_document(docnum, delete=delete)
            else:
                ramsegment = self.codec.segment
                ramsegment.delete_document(docnum - base, delete=delete)

    def is_deleted(self, docnum):
        base = self.index.doc_count_all()
        if docnum < base:
            return self.writer.is_deleted(docnum)
        else:
            return self._get_ram_reader().is_deleted(docnum - base)


# Backwards compatibility with old name
BatchWriter = BufferedWriter
