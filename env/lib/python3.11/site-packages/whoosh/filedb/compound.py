# Copyright 2011 Matt Chaput. All rights reserved.
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

import errno
import os
import sys
from threading import Lock
from shutil import copyfileobj

try:
    import mmap
except ImportError:
    mmap = None

from whoosh.compat import BytesIO, memoryview_
from whoosh.filedb.structfile import BufferFile, StructFile
from whoosh.filedb.filestore import FileStorage, StorageError
from whoosh.system import emptybytes
from whoosh.util import random_name


class CompoundStorage(FileStorage):
    readonly = True

    def __init__(self, dbfile, use_mmap=True, basepos=0):
        self._file = dbfile
        self.is_closed = False

        # Seek to the end to get total file size (to check if mmap is OK)
        dbfile.seek(0, os.SEEK_END)
        filesize = self._file.tell()
        dbfile.seek(basepos)

        self._diroffset = self._file.read_long()
        self._dirlength = self._file.read_int()
        self._file.seek(self._diroffset)
        self._dir = self._file.read_pickle()
        self._options = self._file.read_pickle()
        self._locks = {}
        self._source = None

        use_mmap = (
            use_mmap
            and hasattr(self._file, "fileno")  # check file is a real file
            and filesize < sys.maxsize  # check fit on 32-bit Python
        )
        if mmap and use_mmap:
            # Try to open the entire segment as a memory-mapped object
            try:
                fileno = self._file.fileno()
                self._source = mmap.mmap(fileno, 0, access=mmap.ACCESS_READ)
            except (mmap.error, OSError):
                e = sys.exc_info()[1]
                # If we got an error because there wasn't enough memory to
                # open the map, ignore it and fall through, we'll just use the
                # (slower) "sub-file" implementation
                if e.errno == errno.ENOMEM:
                    pass
                else:
                    raise
            else:
                # If that worked, we can close the file handle we were given
                self._file.close()
                self._file = None

    def __repr__(self):
        return "<%s (%s)>" % (self.__class__.__name__, self._name)

    def close(self):
        if self.is_closed:
            raise Exception("Already closed")
        self.is_closed = True

        if self._source:
            try:
                self._source.close()
            except BufferError:
                del self._source
        if self._file:
            self._file.close()

    def range(self, name):
        try:
            fileinfo = self._dir[name]
        except KeyError:
            raise NameError("Unknown file %r" % (name,))
        return fileinfo["offset"], fileinfo["length"]

    def open_file(self, name, *args, **kwargs):
        if self.is_closed:
            raise StorageError("Storage was closed")

        offset, length = self.range(name)
        if self._source:
            # Create a memoryview/buffer from the mmap
            buf = memoryview_(self._source, offset, length)
            f = BufferFile(buf, name=name)
        elif hasattr(self._file, "subset"):
            f = self._file.subset(offset, length, name=name)
        else:
            f = StructFile(SubFile(self._file, offset, length), name=name)
        return f

    def list(self):
        return list(self._dir.keys())

    def file_exists(self, name):
        return name in self._dir

    def file_length(self, name):
        info = self._dir[name]
        return info["length"]

    def file_modified(self, name):
        info = self._dir[name]
        return info["modified"]

    def lock(self, name):
        if name not in self._locks:
            self._locks[name] = Lock()
        return self._locks[name]

    @staticmethod
    def assemble(dbfile, store, names, **options):
        assert names, names

        directory = {}
        basepos = dbfile.tell()
        dbfile.write_long(0)  # Directory position
        dbfile.write_int(0)  # Directory length

        # Copy the files into the compound file
        for name in names:
            if name.endswith(".toc") or name.endswith(".seg"):
                raise Exception(name)

        for name in names:
            offset = dbfile.tell()
            length = store.file_length(name)
            modified = store.file_modified(name)
            directory[name] = {"offset": offset, "length": length,
                               "modified": modified}
            f = store.open_file(name)
            copyfileobj(f, dbfile)
            f.close()

        CompoundStorage.write_dir(dbfile, basepos, directory, options)

    @staticmethod
    def write_dir(dbfile, basepos, directory, options=None):
        options = options or {}

        dirpos = dbfile.tell()  # Remember the start of the directory
        dbfile.write_pickle(directory)  # Write the directory
        dbfile.write_pickle(options)
        endpos = dbfile.tell()  # Remember the end of the directory
        dbfile.flush()
        dbfile.seek(basepos)  # Seek back to the start
        dbfile.write_long(dirpos)  # Directory position
        dbfile.write_int(endpos - dirpos)  # Directory length

        dbfile.close()


class SubFile(object):
    def __init__(self, parentfile, offset, length, name=None):
        self._file = parentfile
        self._offset = offset
        self._length = length
        self._end = offset + length
        self._pos = 0

        self.name = name
        self.closed = False

    def close(self):
        self.closed = True

    def subset(self, position, length, name=None):
        start = self._offset + position
        end = start + length
        name = name or self.name
        assert self._offset >= start >= self._end
        assert self._offset >= end >= self._end
        return SubFile(self._file, self._offset + position, length, name=name)

    def read(self, size=None):
        if size is None:
            size = self._length - self._pos
        else:
            size = min(size, self._length - self._pos)
        if size < 0:
            size = 0

        if size > 0:
            self._file.seek(self._offset + self._pos)
            self._pos += size
            return self._file.read(size)
        else:
            return emptybytes

    def readline(self):
        maxsize = self._length - self._pos
        self._file.seek(self._offset + self._pos)
        data = self._file.readline()
        if len(data) > maxsize:
            data = data[:maxsize]
        self._pos += len(data)
        return data

    def seek(self, where, whence=0):
        if whence == 0:  # Absolute
            pos = where
        elif whence == 1:  # Relative
            pos = self._pos + where
        elif whence == 2:  # From end
            pos = self._length - where
        else:
            raise ValueError

        self._pos = pos

    def tell(self):
        return self._pos


class CompoundWriter(object):
    def __init__(self, tempstorage, buffersize=32 * 1024):
        assert isinstance(buffersize, int)
        self._tempstorage = tempstorage
        self._tempname = "%s.ctmp" % random_name()
        self._temp = tempstorage.create_file(self._tempname, mode="w+b")
        self._buffersize = buffersize
        self._streams = {}

    def create_file(self, name):
        ss = self.SubStream(self._temp, self._buffersize)
        self._streams[name] = ss
        return StructFile(ss)

    def _readback(self):
        temp = self._temp
        for name, substream in self._streams.items():
            substream.close()

            def gen():
                for f, offset, length in substream.blocks:
                    if f is None:
                        f = temp
                    f.seek(offset)
                    yield f.read(length)

            yield (name, gen)
        temp.close()
        self._tempstorage.delete_file(self._tempname)

    def save_as_compound(self, dbfile):
        basepos = dbfile.tell()
        dbfile.write_long(0)  # Directory offset
        dbfile.write_int(0)  # Directory length

        directory = {}
        for name, blocks in self._readback():
            filestart = dbfile.tell()
            for block in blocks():
                dbfile.write(block)
            directory[name] = {"offset": filestart,
                               "length": dbfile.tell() - filestart}

        CompoundStorage.write_dir(dbfile, basepos, directory)

    def save_as_files(self, storage, name_fn):
        for name, blocks in self._readback():
            f = storage.create_file(name_fn(name))
            for block in blocks():
                f.write(block)
            f.close()

    class SubStream(object):
        def __init__(self, dbfile, buffersize):
            self._dbfile = dbfile
            self._buffersize = buffersize
            self._buffer = BytesIO()
            self.blocks = []

        def tell(self):
            return sum(b[2] for b in self.blocks) + self._buffer.tell()

        def write(self, inbytes):
            bio = self._buffer
            buflen = bio.tell()
            length = buflen + len(inbytes)
            if length >= self._buffersize:
                offset = self._dbfile.tell()
                self._dbfile.write(bio.getvalue()[:buflen])
                self._dbfile.write(inbytes)

                self.blocks.append((None, offset, length))
                self._buffer.seek(0)
            else:
                bio.write(inbytes)

        def close(self):
            bio = self._buffer
            length = bio.tell()
            if length:
                self.blocks.append((bio, 0, length))
