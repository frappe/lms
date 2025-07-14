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

"""Contains the main functions/classes for creating, maintaining, and using
an index.
"""

from __future__ import division
import os.path, re, sys
from time import time, sleep

from whoosh import __version__
from whoosh.legacy import toc_loaders
from whoosh.compat import pickle, string_type
from whoosh.fields import ensure_schema
from whoosh.system import _INT_SIZE, _FLOAT_SIZE, _LONG_SIZE


_DEF_INDEX_NAME = "MAIN"
_CURRENT_TOC_VERSION = -111


# Exceptions

class LockError(Exception):
    pass


class IndexError(Exception):
    """Generic index error."""


class IndexVersionError(IndexError):
    """Raised when you try to open an index using a format that the current
    version of Whoosh cannot read. That is, when the index you're trying to
    open is either not backward or forward compatible with this version of
    Whoosh.
    """

    def __init__(self, msg, version, release=None):
        Exception.__init__(self, msg)
        self.version = version
        self.release = release


class OutOfDateError(IndexError):
    """Raised when you try to commit changes to an index which is not the
    latest generation.
    """


class EmptyIndexError(IndexError):
    """Raised when you try to work with an index that has no indexed terms.
    """


# Convenience functions

def create_in(dirname, schema, indexname=None):
    """Convenience function to create an index in a directory. Takes care of
    creating a FileStorage object for you.

    :param dirname: the path string of the directory in which to create the
        index.
    :param schema: a :class:`whoosh.fields.Schema` object describing the
        index's fields.
    :param indexname: the name of the index to create; you only need to specify
        this if you are creating multiple indexes within the same storage
        object.
    :returns: :class:`Index`
    """

    from whoosh.filedb.filestore import FileStorage

    if not indexname:
        indexname = _DEF_INDEX_NAME
    storage = FileStorage(dirname)
    return FileIndex.create(storage, schema, indexname)


def open_dir(dirname, indexname=None, readonly=False, schema=None):
    """Convenience function for opening an index in a directory. Takes care of
    creating a FileStorage object for you. dirname is the filename of the
    directory in containing the index. indexname is the name of the index to
    create; you only need to specify this if you have multiple indexes within
    the same storage object.

    :param dirname: the path string of the directory in which to create the
        index.
    :param indexname: the name of the index to create; you only need to specify
        this if you have multiple indexes within the same storage object.
    """

    from whoosh.filedb.filestore import FileStorage

    if indexname is None:
        indexname = _DEF_INDEX_NAME
    storage = FileStorage(dirname, readonly=readonly)
    return FileIndex(storage, schema=schema, indexname=indexname)


def exists_in(dirname, indexname=None):
    """Returns True if dirname contains a Whoosh index.

    :param dirname: the file path of a directory.
    :param indexname: the name of the index. If None, the default index name is
        used.
    """

    if os.path.exists(dirname):
        try:
            ix = open_dir(dirname, indexname=indexname)
            return ix.latest_generation() > -1
        except EmptyIndexError:
            pass

    return False


def exists(storage, indexname=None):
    """Deprecated; use ``storage.index_exists()``.

    :param storage: a store.Storage object.
    :param indexname: the name of the index. If None, the default index name is
        used.
    """

    return storage.index_exists(indexname)


def version_in(dirname, indexname=None):
    """Returns a tuple of (release_version, format_version), where
    release_version is the release version number of the Whoosh code that
    created the index -- e.g. (0, 1, 24) -- and format_version is the version
    number of the on-disk format used for the index -- e.g. -102.

    You should avoid attaching significance to the second number (the index
    version). This is simply a version number for the TOC file and probably
    should not have been exposed in a public interface. The best way to check
    if the current version of Whoosh can open an index is to actually try to
    open it and see if it raises a ``whoosh.index.IndexVersionError`` exception.

    Note that the release and format version are available as attributes on the
    Index object in Index.release and Index.version.

    :param dirname: the file path of a directory containing an index.
    :param indexname: the name of the index. If None, the default index name is
        used.
    :returns: ((major_ver, minor_ver, build_ver), format_ver)
    """

    from whoosh.filedb.filestore import FileStorage
    storage = FileStorage(dirname)
    return version(storage, indexname=indexname)


def version(storage, indexname=None):
    """Returns a tuple of (release_version, format_version), where
    release_version is the release version number of the Whoosh code that
    created the index -- e.g. (0, 1, 24) -- and format_version is the version
    number of the on-disk format used for the index -- e.g. -102.

    You should avoid attaching significance to the second number (the index
    version). This is simply a version number for the TOC file and probably
    should not have been exposed in a public interface. The best way to check
    if the current version of Whoosh can open an index is to actually try to
    open it and see if it raises a ``whoosh.index.IndexVersionError`` exception.

    Note that the release and format version are available as attributes on the
    Index object in Index.release and Index.version.

    :param storage: a store.Storage object.
    :param indexname: the name of the index. If None, the default index name is
        used.
    :returns: ((major_ver, minor_ver, build_ver), format_ver)
    """

    try:
        if indexname is None:
            indexname = _DEF_INDEX_NAME

        ix = storage.open_index(indexname)
        return (ix.release, ix.version)
    except IndexVersionError:
        e = sys.exc_info()[1]
        return (None, e.version)


# Index base class

class Index(object):
    """Represents an indexed collection of documents.
    """

    def close(self):
        """Closes any open resources held by the Index object itself. This may
        not close all resources being used everywhere, for example by a
        Searcher object.
        """
        pass

    def add_field(self, fieldname, fieldspec):
        """Adds a field to the index's schema.

        :param fieldname: the name of the field to add.
        :param fieldspec: an instantiated :class:`whoosh.fields.FieldType`
            object.
        """

        w = self.writer()
        w.add_field(fieldname, fieldspec)
        w.commit()

    def remove_field(self, fieldname):
        """Removes the named field from the index's schema. Depending on the
        backend implementation, this may or may not actually remove existing
        data for the field from the index. Optimizing the index should always
        clear out existing data for a removed field.
        """

        w = self.writer()
        w.remove_field(fieldname)
        w.commit()

    def latest_generation(self):
        """Returns the generation number of the latest generation of this
        index, or -1 if the backend doesn't support versioning.
        """
        return -1

    def refresh(self):
        """Returns a new Index object representing the latest generation
        of this index (if this object is the latest generation, or the backend
        doesn't support versioning, returns self).

        :returns: :class:`Index`
        """
        return self

    def up_to_date(self):
        """Returns True if this object represents the latest generation of
        this index. Returns False if this object is not the latest generation
        (that is, someone else has updated the index since you opened this
        object).
        """
        return True

    def last_modified(self):
        """Returns the last modified time of the index, or -1 if the backend
        doesn't support last-modified times.
        """
        return -1

    def is_empty(self):
        """Returns True if this index is empty (that is, it has never had any
        documents successfully written to it.
        """
        raise NotImplementedError

    def optimize(self):
        """Optimizes this index, if necessary.
        """
        pass

    def doc_count_all(self):
        """Returns the total number of documents, DELETED OR UNDELETED,
        in this index.
        """

        r = self.reader()
        try:
            return r.doc_count_all()
        finally:
            r.close()

    def doc_count(self):
        """Returns the total number of UNDELETED documents in this index.
        """

        r = self.reader()
        try:
            return r.doc_count()
        finally:
            r.close()

    def searcher(self, **kwargs):
        """Returns a Searcher object for this index. Keyword arguments are
        passed to the Searcher object's constructor.

        :rtype: :class:`whoosh.searching.Searcher`
        """

        from whoosh.searching import Searcher
        return Searcher(self.reader(), fromindex=self, **kwargs)

    def field_length(self, fieldname):
        """Returns the total length of the field across all documents.
        """

        r = self.reader()
        try:
            return r.field_length(fieldname)
        finally:
            r.close()

    def max_field_length(self, fieldname):
        """Returns the maximum length of the field across all documents.
        """

        r = self.reader()
        try:
            return r.max_field_length(fieldname)
        finally:
            r.close()

    def reader(self, reuse=None):
        """Returns an IndexReader object for this index.

        :param reuse: an existing reader. Some implementations may recycle
            resources from this existing reader to create the new reader. Note
            that any resources in the "recycled" reader that are not used by
            the new reader will be CLOSED, so you CANNOT use it afterward.
        :rtype: :class:`whoosh.reading.IndexReader`
        """

        raise NotImplementedError

    def writer(self, **kwargs):
        """Returns an IndexWriter object for this index.

        :rtype: :class:`whoosh.writing.IndexWriter`
        """
        raise NotImplementedError

    def delete_by_term(self, fieldname, text, searcher=None):
        w = self.writer()
        w.delete_by_term(fieldname, text, searcher=searcher)
        w.commit()

    def delete_by_query(self, q, searcher=None):
        w = self.writer()
        w.delete_by_query(q, searcher=searcher)
        w.commit()


# Codec-based index implementation

def clean_files(storage, indexname, gen, segments):
    # Attempts to remove unused index files (called when a new generation
    # is created). If existing Index and/or reader objects have the files
    # open, they may not be deleted immediately (i.e. on Windows) but will
    # probably be deleted eventually by a later call to clean_files.

    current_segment_names = set(s.segment_id() for s in segments)
    tocpattern = TOC._pattern(indexname)
    segpattern = TOC._segment_pattern(indexname)

    todelete = set()
    for filename in storage:
        if filename.startswith("."):
            continue
        tocm = tocpattern.match(filename)
        segm = segpattern.match(filename)
        if tocm:
            if int(tocm.group(1)) != gen:
                todelete.add(filename)
        elif segm:
            name = segm.group(1)
            if name not in current_segment_names:
                todelete.add(filename)

    for filename in todelete:
        try:
            storage.delete_file(filename)
        except OSError:
            # Another process still has this file open, I guess
            pass


class FileIndex(Index):
    def __init__(self, storage, schema=None, indexname=_DEF_INDEX_NAME):
        from whoosh.filedb.filestore import Storage

        if not isinstance(storage, Storage):
            raise ValueError("%r is not a Storage object" % storage)
        if not isinstance(indexname, string_type):
            raise ValueError("indexname %r is not a string" % indexname)

        if schema:
            schema = ensure_schema(schema)

        self.storage = storage
        self._schema = schema
        self.indexname = indexname

        # Try reading the TOC to see if it's possible
        TOC.read(self.storage, self.indexname, schema=self._schema)

    @classmethod
    def create(cls, storage, schema, indexname=_DEF_INDEX_NAME):
        TOC.create(storage, schema, indexname)
        return cls(storage, schema, indexname)

    def __repr__(self):
        return "%s(%r, %r)" % (self.__class__.__name__,
                               self.storage, self.indexname)

    def close(self):
        pass

    # add_field
    # remove_field

    def latest_generation(self):
        return TOC._latest_generation(self.storage, self.indexname)

    # refresh
    # up_to_date

    def last_modified(self):
        gen = self.latest_generation()
        filename = TOC._filename(self.indexname, gen)
        return self.storage.file_modified(filename)

    def is_empty(self):
        return len(self._read_toc().segments) == 0

    def optimize(self, **kwargs):
        w = self.writer(**kwargs)
        w.commit(optimize=True)

    # searcher

    def writer(self, procs=1, **kwargs):
        if procs > 1:
            from whoosh.multiproc import MpWriter
            return MpWriter(self, procs=procs, **kwargs)
        else:
            from whoosh.writing import SegmentWriter
            return SegmentWriter(self, **kwargs)

    def lock(self, name):
        """Returns a lock object that you can try to call acquire() on to
        lock the index.
        """

        return self.storage.lock(self.indexname + "_" + name)

    def _read_toc(self):
        return TOC.read(self.storage, self.indexname, schema=self._schema)

    def _segments(self):
        return self._read_toc().segments

    def _current_schema(self):
        return self._read_toc().schema

    @property
    def schema(self):
        return self._current_schema()

    @property
    def release(self):
        return self._read_toc().release

    @property
    def version(self):
        return self._read_toc().version

    @classmethod
    def _reader(cls, storage, schema, segments, generation, reuse=None):
        # Returns a reader for the given segments, possibly reusing already
        # opened readers
        from whoosh.reading import SegmentReader, MultiReader, EmptyReader

        reusable = {}
        try:
            if len(segments) == 0:
                # This index has no segments! Return an EmptyReader object,
                # which simply returns empty or zero to every method
                return EmptyReader(schema)

            if reuse:
                # Put all atomic readers in a dictionary keyed by their
                # generation, so we can re-use them if them if possible
                readers = [r for r, _ in reuse.leaf_readers()]
                reusable = dict((r.generation(), r) for r in readers)

            # Make a function to open readers, which reuses reusable readers.
            # It removes any readers it reuses from the "reusable" dictionary,
            # so later we can close any readers left in the dictionary.
            def segreader(segment):
                segid = segment.segment_id()
                if segid in reusable:
                    r = reusable[segid]
                    del reusable[segid]
                    return r
                else:
                    return SegmentReader(storage, schema, segment,
                                         generation=generation)

            if len(segments) == 1:
                # This index has one segment, so return a SegmentReader object
                # for the segment
                return segreader(segments[0])
            else:
                # This index has multiple segments, so create a list of
                # SegmentReaders for the segments, then composite them with a
                # MultiReader

                readers = [segreader(segment) for segment in segments]
                return MultiReader(readers, generation=generation)
        finally:
            for r in reusable.values():
                r.close()

    def reader(self, reuse=None):
        retries = 10
        while retries > 0:
            # Read the information from the TOC file
            try:
                info = self._read_toc()
                return self._reader(self.storage, info.schema, info.segments,
                                    info.generation, reuse=reuse)
            except IOError:
                # Presume that we got a "file not found error" because a writer
                # deleted one of the files just as we were trying to open it,
                # and so retry a few times before actually raising the
                # exception
                e = sys.exc_info()[1]
                retries -= 1
                if retries <= 0:
                    raise e
                sleep(0.05)


# TOC class

class TOC(object):
    """Object representing the state of the index after a commit. Essentially
    a container for the index's schema and the list of segment objects.
    """

    def __init__(self, schema, segments, generation,
                 version=_CURRENT_TOC_VERSION, release=__version__):
        self.schema = schema
        self.segments = segments
        self.generation = generation
        self.version = version
        self.release = release

    @classmethod
    def _filename(cls, indexname, gen):
        return "_%s_%s.toc" % (indexname, gen)

    @classmethod
    def _pattern(cls, indexname):
        return re.compile("^_%s_([0-9]+).toc$" % indexname)

    @classmethod
    def _segment_pattern(cls, indexname):
        return re.compile("(%s_[0-9a-z]+)[.][A-Za-z0-9_.]+" % indexname)

    @classmethod
    def _latest_generation(cls, storage, indexname):
        pattern = cls._pattern(indexname)

        mx = -1
        for filename in storage:
            m = pattern.match(filename)
            if m:
                mx = max(int(m.group(1)), mx)
        return mx

    @classmethod
    def create(cls, storage, schema, indexname=_DEF_INDEX_NAME):
        schema = ensure_schema(schema)

        # Clear existing files
        prefix = "_%s_" % indexname
        for filename in storage:
            if filename.startswith(prefix):
                storage.delete_file(filename)

        # Write a TOC file with an empty list of segments
        toc = cls(schema, [], 0)
        toc.write(storage, indexname)

    @classmethod
    def read(cls, storage, indexname, gen=None, schema=None):
        if gen is None:
            gen = cls._latest_generation(storage, indexname)
            if gen < 0:
                raise EmptyIndexError("Index %r does not exist in %r"
                                      % (indexname, storage))

        # Read the content of this index from the .toc file.
        tocfilename = cls._filename(indexname, gen)
        stream = storage.open_file(tocfilename)

        def check_size(name, target):
            sz = stream.read_varint()
            if sz != target:
                raise IndexError("Index was created on different architecture:"
                                 " saved %s = %s, this computer = %s"
                                 % (name, sz, target))

        check_size("int", _INT_SIZE)
        check_size("long", _LONG_SIZE)
        check_size("float", _FLOAT_SIZE)

        if not stream.read_int() == -12345:
            raise IndexError("Number misread: byte order problem")

        version = stream.read_int()
        release = (stream.read_varint(), stream.read_varint(),
                   stream.read_varint())

        if version != _CURRENT_TOC_VERSION:
            if version in toc_loaders:
                loader = toc_loaders[version]
                schema, segments = loader(stream, gen, schema, version)
            else:
                raise IndexVersionError("Can't read format %s" % version,
                                        version)
        else:
            # If the user supplied a schema object with the constructor, don't
            # load the pickled schema from the saved index.
            if schema:
                stream.skip_string()
            else:
                schema = pickle.loads(stream.read_string())
            schema = ensure_schema(schema)

            # Generation
            index_gen = stream.read_int()
            assert gen == index_gen

            _ = stream.read_int()  # Unused
            segments = stream.read_pickle()

        stream.close()
        return cls(schema, segments, gen, version=version, release=release)

    def write(self, storage, indexname):
        schema = ensure_schema(self.schema)
        schema.clean()

        # Use a temporary file for atomic write.
        tocfilename = self._filename(indexname, self.generation)
        tempfilename = '%s.%s' % (tocfilename, time())
        stream = storage.create_file(tempfilename)

        stream.write_varint(_INT_SIZE)
        stream.write_varint(_LONG_SIZE)
        stream.write_varint(_FLOAT_SIZE)
        stream.write_int(-12345)

        stream.write_int(_CURRENT_TOC_VERSION)
        for num in __version__[:3]:
            stream.write_varint(num)

        try:
            stream.write_string(pickle.dumps(schema, 2))
        except pickle.PicklingError:
            # Try to narrow down the error to a single field
            for fieldname, field in schema.items():
                try:
                    pickle.dumps(field)
                except pickle.PicklingError:
                    e = sys.exc_info()[1]
                    raise pickle.PicklingError("%s %s=%r" % (e, fieldname, field))
                except TypeError:
                    e = sys.exc_info()[1]
                    raise TypeError("%s %s=%r" % (e, fieldname, field))
            # Otherwise, re-raise the original exception
            raise

        stream.write_int(self.generation)
        stream.write_int(0)  # Unused
        stream.write_pickle(self.segments)
        stream.close()

        # Rename temporary file to the proper filename
        storage.rename_file(tempfilename, tocfilename, safe=True)

