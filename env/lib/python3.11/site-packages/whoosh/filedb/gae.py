"""
This module contains EXPERIMENTAL support for storing a Whoosh index's files in
the Google App Engine blobstore. This will use a lot of RAM since all files are
loaded into RAM, but it potentially useful as a workaround for the lack of file
storage in Google App Engine.

Use at your own risk, but please report any problems to me so I can fix them.

To create a new index::

    from whoosh.filedb.gae import DatastoreStorage

    ix = DatastoreStorage().create_index(schema)

To open an existing index::

    ix = DatastoreStorage().open_index()
"""

import time

from google.appengine.api import memcache  # @UnresolvedImport
from google.appengine.ext import db  # @UnresolvedImport

from whoosh.compat import BytesIO
from whoosh.index import TOC, FileIndex, _DEF_INDEX_NAME
from whoosh.filedb.filestore import ReadOnlyError, Storage
from whoosh.filedb.structfile import StructFile


class DatastoreFile(db.Model):
    """A file-like object that is backed by a BytesIO() object whose contents
    is loaded from a BlobProperty in the app engine datastore.
    """

    value = db.BlobProperty()
    mtime = db.IntegerProperty(default=0)

    def __init__(self, *args, **kwargs):
        super(DatastoreFile, self).__init__(*args, **kwargs)
        self.data = BytesIO()

    @classmethod
    def loadfile(cls, name):
        value = memcache.get(name, namespace="DatastoreFile")
        if value is None:
            file = cls.get_by_key_name(name)
            memcache.set(name, file.value, namespace="DatastoreFile")
        else:
            file = cls(value=value)
        file.data = BytesIO(file.value)
        return file

    def close(self):
        oldvalue = self.value
        self.value = self.getvalue()
        if oldvalue != self.value:
            self.mtime = int(time.time())
            self.put()
            memcache.set(self.key().id_or_name(), self.value,
                         namespace="DatastoreFile")

    def tell(self):
        return self.data.tell()

    def write(self, data):
        return self.data.write(data)

    def read(self, length):
        return self.data.read(length)

    def seek(self, *args):
        return self.data.seek(*args)

    def readline(self):
        return self.data.readline()

    def getvalue(self):
        return self.data.getvalue()


class MemcacheLock(object):
    def __init__(self, name):
        self.name = name

    def acquire(self, blocking=False):
        val = memcache.add(self.name, "L", 360, namespace="whooshlocks")

        if blocking and not val:
            # Simulate blocking by retrying the acquire over and over
            import time
            while not val:
                time.sleep(0.1)
                val = memcache.add(self.name, "", 360, namespace="whooshlocks")

        return val

    def release(self):
        memcache.delete(self.name, namespace="whooshlocks")


class DatastoreStorage(Storage):
    """An implementation of :class:`whoosh.store.Storage` that stores files in
    the app engine datastore as blob properties.
    """

    def create_index(self, schema, indexname=_DEF_INDEX_NAME):
        if self.readonly:
            raise ReadOnlyError

        TOC.create(self, schema, indexname)
        return FileIndex(self, schema, indexname)

    def open_index(self, indexname=_DEF_INDEX_NAME, schema=None):
        return FileIndex(self, schema=schema, indexname=indexname)

    def list(self):
        query = DatastoreFile.all()
        keys = []
        for file in query:
            keys.append(file.key().id_or_name())
        return keys

    def clean(self):
        pass

    def total_size(self):
        return sum(self.file_length(f) for f in self.list())

    def file_exists(self, name):
        return DatastoreFile.get_by_key_name(name) is not None

    def file_modified(self, name):
        return DatastoreFile.get_by_key_name(name).mtime

    def file_length(self, name):
        return len(DatastoreFile.get_by_key_name(name).value)

    def delete_file(self, name):
        memcache.delete(name, namespace="DatastoreFile")
        return DatastoreFile.get_by_key_name(name).delete()

    def rename_file(self, name, newname, safe=False):
        file = DatastoreFile.get_by_key_name(name)
        newfile = DatastoreFile(key_name=newname)
        newfile.value = file.value
        newfile.mtime = file.mtime
        newfile.put()
        file.delete()

    def create_file(self, name, **kwargs):
        f = StructFile(DatastoreFile(key_name=name), name=name,
                       onclose=lambda sfile: sfile.file.close())
        return f

    def open_file(self, name, *args, **kwargs):
        return StructFile(DatastoreFile.loadfile(name))

    def lock(self, name):
        return MemcacheLock(name)

    def temp_storage(self, name=None):
        tempstore = DatastoreStorage()
        return tempstore.create()
