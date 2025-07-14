# -*- coding: utf-8 -*-
import os
import io
try:
    # Python 2.x and 3.x support for checking string types
    assert basestring
    assert unicode
except NameError:
    basestring = str
    unicode = str



class Source(object):
    def __init__(self, url_or_file, type_):
        self.source = url_or_file
        self.type = type_

        if self.type == 'file':
            self.checkFiles()

    def isUrl(self):
        return 'url' in self.type

    def isFile(self, path=None):
        # dirty hack to check where file is opened with codecs module
        # (because it returns 'instance' type when encoding is specified
        if path:
            return isinstance(path, io.IOBase) or path.__class__.__name__ == 'StreamReaderWriter'
        else:
            return 'file' in self.type

    def checkFiles(self):
        if isinstance(self.source, list):
            for path in self.source:
                if not os.path.exists(path):
                    raise IOError('No such file: %s' % path)
        else:
            if not hasattr(self.source, 'read') and not os.path.exists(self.source):
                raise IOError('No such file: %s' % self.source)

    def isString(self):
        return 'string' in self.type

    def isFileObj(self):
        return hasattr(self.source, 'read')

    def to_s(self):
        # String should be in unicode(python2)/str(python3) type since we will
        # later encode it to utf-8 bytes array to pipe into subprocess
        # With some charachters on python 2 it sets to str type (bytes) which is wrong
        # and cant later encode properly, this is a workaround for this.
        # See issue #42
        if isinstance(self.source, unicode):
            return self.source
        else:
            return unicode(self.source, 'utf-8')
