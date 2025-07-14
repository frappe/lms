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

from __future__ import with_statement
import errno, os, sys, tempfile
from threading import Lock

from whoosh.compat import BytesIO, memoryview_
from whoosh.filedb.structfile import BufferFile, StructFile
from whoosh.index import _DEF_INDEX_NAME, EmptyIndexError
from whoosh.util import random_name
from whoosh.util.filelock import FileLock


# Exceptions

class StorageError(Exception):
    pass


class ReadOnlyError(StorageError):
    pass


# Base class

class Storage(object):
    """Abstract base class for storage objects.

    A storage object is a virtual flat filesystem, allowing the creation and
    retrieval of file-like objects
    (:class:`~whoosh.filedb.structfile.StructFile` objects). The default
    implementation (:class:`FileStorage`) uses actual files in a directory.

    All access to files in Whoosh goes through this object. This allows more
    different forms of storage (for example, in RAM, in a database, in a single
    file) to be used transparently.

    For example, to create a :class:`FileStorage` object::

        # Create a storage object
        st = FileStorage("indexdir")
        # Create the directory if it doesn't already exist
        st.create()

    The :meth:`Storage.create` method makes it slightly easier to swap storage
    implementations. The ``create()`` method handles set-up of the storage
    object. For example, ``FileStorage.create()`` creates the directory. A
    database implementation might create tables. This is designed to let you
    avoid putting implementation-specific setup code in your application.
    """

    readonly = False
    supports_mmap = False

    def __iter__(self):
        return iter(self.list())

    def __enter__(self):
        self.create()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def create(self):
        """Creates any required implementation-specific resources. For example,
        a filesystem-based implementation might create a directory, while a
        database implementation might create tables. For example::

            from whoosh.filedb.filestore import FileStorage
            # Create a storage object
            st = FileStorage("indexdir")
            # Create any necessary resources
            st.create()

        This method returns ``self`` so you can also say::

            st = FileStorage("indexdir").create()

        Storage implementations should be written so that calling create() a
        second time on the same storage

        :return: a :class:`Storage` instance.
        """

        return self

    def destroy(self, *args, **kwargs):
        """Removes any implementation-specific resources related to this storage
        object. For example, a filesystem-based implementation might delete a
        directory, and a database implementation might drop tables.

        The arguments are implementation-specific.
        """

        pass

    def create_index(self, schema, indexname=_DEF_INDEX_NAME, indexclass=None):
        """Creates a new index in this storage.

        >>> from whoosh import fields
        >>> from whoosh.filedb.filestore import FileStorage
        >>> schema = fields.Schema(content=fields.TEXT)
        >>> # Create the storage directory
        >>> st = FileStorage.create("indexdir")
        >>> # Create an index in the storage
        >>> ix = st.create_index(schema)

        :param schema: the :class:`whoosh.fields.Schema` object to use for the
            new index.
        :param indexname: the name of the index within the storage object. You
            can use this option to store multiple indexes in the same storage.
        :param indexclass: an optional custom ``Index`` sub-class to use to
            create the index files. The default is
            :class:`whoosh.index.FileIndex`. This method will call the
            ``create`` class method on the given class to create the index.
        :return: a :class:`whoosh.index.Index` instance.
        """

        if self.readonly:
            raise ReadOnlyError
        if indexclass is None:
            import whoosh.index
            indexclass = whoosh.index.FileIndex
        return indexclass.create(self, schema, indexname)

    def open_index(self, indexname=_DEF_INDEX_NAME, schema=None, indexclass=None):
        """Opens an existing index (created using :meth:`create_index`) in this
        storage.

        >>> from whoosh.filedb.filestore import FileStorage
        >>> st = FileStorage("indexdir")
        >>> # Open an index in the storage
        >>> ix = st.open_index()

        :param indexname: the name of the index within the storage object. You
            can use this option to store multiple indexes in the same storage.
        :param schema: if you pass in a :class:`whoosh.fields.Schema` object
            using this argument, it will override the schema that was stored
            with the index.
        :param indexclass: an optional custom ``Index`` sub-class to use to
            open the index files. The default is
            :class:`whoosh.index.FileIndex`. This method will instantiate the
            class with this storage object.
        :return: a :class:`whoosh.index.Index` instance.
        """

        if indexclass is None:
            import whoosh.index
            indexclass = whoosh.index.FileIndex
        return indexclass(self, schema=schema, indexname=indexname)

    def index_exists(self, indexname=None):
        """Returns True if a non-empty index exists in this storage.

        :param indexname: the name of the index within the storage object. You
            can use this option to store multiple indexes in the same storage.
        :rtype: bool
        """

        if indexname is None:
            indexname = _DEF_INDEX_NAME
        try:
            ix = self.open_index(indexname)
            gen = ix.latest_generation()
            ix.close()
            return gen > -1
        except EmptyIndexError:
            pass
        return False

    def create_file(self, name):
        """Creates a file with the given name in this storage.

        :param name: the name for the new file.
        :return: a :class:`whoosh.filedb.structfile.StructFile` instance.
        """

        raise NotImplementedError

    def open_file(self, name, *args, **kwargs):
        """Opens a file with the given name in this storage.

        :param name: the name for the new file.
        :return: a :class:`whoosh.filedb.structfile.StructFile` instance.
        """

        raise NotImplementedError

    def list(self):
        """Returns a list of file names in this storage.

        :return: a list of strings
        """
        raise NotImplementedError

    def file_exists(self, name):
        """Returns True if the given file exists in this storage.

        :param name: the name to check.
        :rtype: bool
        """

        raise NotImplementedError

    def file_modified(self, name):
        """Returns the last-modified time of the given file in this storage (as
        a "ctime" UNIX timestamp).

        :param name: the name to check.
        :return: a "ctime" number.
        """

        raise NotImplementedError

    def file_length(self, name):
        """Returns the size (in bytes) of the given file in this storage.

        :param name: the name to check.
        :rtype: int
        """

        raise NotImplementedError

    def delete_file(self, name):
        """Removes the given file from this storage.

        :param name: the name to delete.
        """

        raise NotImplementedError

    def rename_file(self, frm, to, safe=False):
        """Renames a file in this storage.

        :param frm: The current name of the file.
        :param to: The new name for the file.
        :param safe: if True, raise an exception if a file with the new name
            already exists.
        """

        raise NotImplementedError

    def lock(self, name):
        """Return a named lock object (implementing ``.acquire()`` and
        ``.release()`` methods). Different storage implementations may use
        different lock types with different guarantees. For example, the
        RamStorage object uses Python thread locks, while the FileStorage
        object uses filesystem-based locks that are valid across different
        processes.

        :param name: a name for the lock.
        :return: a lock-like object.
        """

        raise NotImplementedError

    def close(self):
        """Closes any resources opened by this storage object. For some storage
        implementations this will be a no-op, but for others it is necessary
        to release locks and/or prevent leaks, so it's a good idea to call it
        when you're done with a storage object.
        """

        pass

    def optimize(self):
        """Optimizes the storage object. The meaning and cost of "optimizing"
        will vary by implementation. For example, a database implementation
        might run a garbage collection procedure on the underlying database.
        """

        pass

    def temp_storage(self, name=None):
        """Creates a new storage object for temporary files. You can call
        :meth:`Storage.destroy` on the new storage when you're finished with
        it.

        :param name: a name for the new storage. This may be optional or
            required depending on the storage implementation.
        :rtype: :class:`Storage`
        """

        raise NotImplementedError


class OverlayStorage(Storage):
    """Overlays two storage objects. Reads are processed from the first if it
    has the named file, otherwise the second. Writes always go to the second.
    """

    def __init__(self, a, b):
        self.a = a
        self.b = b

    def create_index(self, *args, **kwargs):
        self.b.create_index(*args, **kwargs)

    def open_index(self, *args, **kwargs):
        self.a.open_index(*args, **kwargs)

    def create_file(self, *args, **kwargs):
        return self.b.create_file(*args, **kwargs)

    def open_file(self, name, *args, **kwargs):
        if self.a.file_exists(name):
            return self.a.open_file(name, *args, **kwargs)
        else:
            return self.b.open_file(name, *args, **kwargs)

    def list(self):
        return list(set(self.a.list()) | set(self.b.list()))

    def file_exists(self, name):
        return self.a.file_exists(name) or self.b.file_exists(name)

    def file_modified(self, name):
        if self.a.file_exists(name):
            return self.a.file_modified(name)
        else:
            return self.b.file_modified(name)

    def file_length(self, name):
        if self.a.file_exists(name):
            return self.a.file_length(name)
        else:
            return self.b.file_length(name)

    def delete_file(self, name):
        return self.b.delete_file(name)

    def rename_file(self, *args, **kwargs):
        raise NotImplementedError

    def lock(self, name):
        return self.b.lock(name)

    def close(self):
        self.a.close()
        self.b.close()

    def optimize(self):
        self.a.optimize()
        self.b.optimize()

    def temp_storage(self, name=None):
        return self.b.temp_storage(name=name)


class FileStorage(Storage):
    """Storage object that stores the index as files in a directory on disk.

    Prior to version 3, the initializer would raise an IOError if the directory
    did not exist. As of version 3, the object does not check if the
    directory exists at initialization. This change is to support using the
    :meth:`FileStorage.create` method.
    """

    supports_mmap = True

    def __init__(self, path, supports_mmap=True, readonly=False, debug=False):
        """
        :param path: a path to a directory.
        :param supports_mmap: if True (the default), use the ``mmap`` module to
            open memory mapped files. You can open the storage object with
            ``supports_mmap=False`` to force Whoosh to open files normally
            instead of with ``mmap``.
        :param readonly: If ``True``, the object will raise an exception if you
            attempt to create or rename a file.
        """

        self.folder = path
        self.supports_mmap = supports_mmap
        self.readonly = readonly
        self._debug = debug
        self.locks = {}

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self.folder)

    def create(self):
        """Creates this storage object's directory path using ``os.makedirs`` if
        it doesn't already exist.

        >>> from whoosh.filedb.filestore import FileStorage
        >>> st = FileStorage("indexdir")
        >>> st.create()

        This method returns ``self``, you can say::

            st = FileStorage("indexdir").create()

        Note that you can simply create handle the creation of the directory
        yourself and open the storage object using the initializer::

            dirname = "indexdir"
            os.mkdir(dirname)
            st = FileStorage(dirname)

        However, using the ``create()`` method allows you to potentially swap in
        other storage implementations more easily.

        :return: a :class:`Storage` instance.
        """

        dirpath = os.path.abspath(self.folder)
        # If the given directory does not already exist, try to create it
        try:
            os.makedirs(dirpath)
        except OSError:
            # This is necessary for compatibility between Py2 and Py3
            e = sys.exc_info()[1]
            # If we get an error because the path already exists, ignore it
            if e.errno != errno.EEXIST:
                raise

        # Raise an exception if the given path is not a directory
        if not os.path.isdir(dirpath):
            e = IOError("%r is not a directory" % dirpath)
            e.errno = errno.ENOTDIR
            raise e

        return self

    def destroy(self):
        """Removes any files in this storage object and then removes the
        storage object's directory. What happens if any of the files or the
        directory are in use depends on the underlying platform.
        """

        # Remove all files
        self.clean()
        try:
            # Try to remove the directory
            os.rmdir(self.folder)
        except IOError:
            e = sys.exc_info()[1]
            if e.errno == errno.ENOENT:
                pass
            else:
                raise e

    def create_file(self, name, excl=False, mode="wb", **kwargs):
        """Creates a file with the given name in this storage.

        :param name: the name for the new file.
        :param excl: if True, try to open the file in "exclusive" mode.
        :param mode: the mode flags with which to open the file. The default is
            ``"wb"``.
        :return: a :class:`whoosh.filedb.structfile.StructFile` instance.
        """

        if self.readonly:
            raise ReadOnlyError

        path = self._fpath(name)
        if excl:
            flags = os.O_CREAT | os.O_EXCL | os.O_RDWR
            if hasattr(os, "O_BINARY"):
                flags |= os.O_BINARY
            fd = os.open(path, flags)
            fileobj = os.fdopen(fd, mode)
        else:
            fileobj = open(path, mode)

        f = StructFile(fileobj, name=name, **kwargs)
        return f

    def open_file(self, name, **kwargs):
        """Opens an existing file in this storage.

        :param name: the name of the file to open.
        :param kwargs: additional keyword arguments are passed through to the
            :class:`~whoosh.filedb.structfile.StructFile` initializer.
        :return: a :class:`whoosh.filedb.structfile.StructFile` instance.
        """

        f = StructFile(open(self._fpath(name), "rb"), name=name, **kwargs)
        return f

    def _fpath(self, fname):
        return os.path.abspath(os.path.join(self.folder, fname))

    def clean(self, ignore=False):
        if self.readonly:
            raise ReadOnlyError

        path = self.folder
        files = self.list()
        for fname in files:
            try:
                os.remove(os.path.join(path, fname))
            except OSError:
                if not ignore:
                    raise

    def list(self):
        try:
            files = os.listdir(self.folder)
        except IOError:
            files = []

        return files

    def file_exists(self, name):
        return os.path.exists(self._fpath(name))

    def file_modified(self, name):
        return os.path.getmtime(self._fpath(name))

    def file_length(self, name):
        return os.path.getsize(self._fpath(name))

    def delete_file(self, name):
        if self.readonly:
            raise ReadOnlyError

        os.remove(self._fpath(name))

    def rename_file(self, oldname, newname, safe=False):
        if self.readonly:
            raise ReadOnlyError

        if os.path.exists(self._fpath(newname)):
            if safe:
                raise NameError("File %r exists" % newname)
            else:
                os.remove(self._fpath(newname))
        os.rename(self._fpath(oldname), self._fpath(newname))

    def lock(self, name):
        return FileLock(self._fpath(name))

    def temp_storage(self, name=None):
        name = name or "%s.tmp" % random_name()
        path = os.path.join(self.folder, name)
        tempstore = FileStorage(path)
        return tempstore.create()


class RamStorage(Storage):
    """Storage object that keeps the index in memory.
    """

    supports_mmap = False

    def __init__(self):
        self.files = {}
        self.locks = {}
        self.folder = ''

    def destroy(self):
        del self.files
        del self.locks

    def list(self):
        return list(self.files.keys())

    def clean(self):
        self.files = {}

    def total_size(self):
        return sum(self.file_length(f) for f in self.list())

    def file_exists(self, name):
        return name in self.files

    def file_length(self, name):
        if name not in self.files:
            raise NameError(name)
        return len(self.files[name])

    def file_modified(self, name):
        return -1

    def delete_file(self, name):
        if name not in self.files:
            raise NameError(name)
        del self.files[name]

    def rename_file(self, name, newname, safe=False):
        if name not in self.files:
            raise NameError(name)
        if safe and newname in self.files:
            raise NameError("File %r exists" % newname)

        content = self.files[name]
        del self.files[name]
        self.files[newname] = content

    def create_file(self, name, **kwargs):
        def onclose_fn(sfile):
            self.files[name] = sfile.file.getvalue()
        f = StructFile(BytesIO(), name=name, onclose=onclose_fn)
        return f

    def open_file(self, name, **kwargs):
        if name not in self.files:
            raise NameError(name)
        buf = memoryview_(self.files[name])
        return BufferFile(buf, name=name, **kwargs)

    def lock(self, name):
        if name not in self.locks:
            self.locks[name] = Lock()
        return self.locks[name]

    def temp_storage(self, name=None):
        tdir = tempfile.gettempdir()
        name = name or "%s.tmp" % random_name()
        path = os.path.join(tdir, name)
        tempstore = FileStorage(path)
        return tempstore.create()


def copy_storage(sourcestore, deststore):
    """Copies the files from the source storage object to the destination
    storage object using ``shutil.copyfileobj``.
    """
    from shutil import copyfileobj

    for name in sourcestore.list():
        with sourcestore.open_file(name) as source:
            with deststore.create_file(name) as dest:
                copyfileobj(source, dest)


def copy_to_ram(storage):
    """Copies the given FileStorage object into a new RamStorage object.

    :rtype: :class:`RamStorage`
    """

    ram = RamStorage()
    copy_storage(storage, ram)
    return ram
