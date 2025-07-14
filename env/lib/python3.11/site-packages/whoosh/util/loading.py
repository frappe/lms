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

import pickle


class RenamingUnpickler(pickle.Unpickler):
    """Subclasses ``pickle.Unpickler`` to allow remapping of class names before
    loading them.
    """

    def __init__(self, f, objmap, shortcuts=None):
        pickle.Unpickler.__init__(self, f)

        if shortcuts:
            objmap = dict((k % shortcuts, v % shortcuts)
                          for k, v in objmap.items())
        self._objmap = objmap

    def find_class(self, modulename, objname):
        fqname = "%s.%s" % (modulename, objname)
        if fqname in self._objmap:
            fqname = self._objmap[fqname]
        try:
            obj = find_object(fqname)
        except ImportError:
            raise ImportError("Couldn't find %r" % fqname)
        return obj


def find_object(name, blacklist=None, whitelist=None):
    """Imports and returns an object given a fully qualified name.

    >>> find_object("whoosh.analysis.StopFilter")
    <class 'whoosh.analysis.StopFilter'>
    """

    if blacklist:
        for pre in blacklist:
            if name.startswith(pre):
                raise TypeError("%r: can't instantiate names starting with %r"
                                % (name, pre))
    if whitelist:
        passes = False
        for pre in whitelist:
            if name.startswith(pre):
                passes = True
                break
        if not passes:
            raise TypeError("Can't instantiate %r" % name)

    lastdot = name.rfind(".")

    assert lastdot > -1, "Name %r must be fully qualified" % name
    modname = name[:lastdot]
    clsname = name[lastdot + 1:]

    mod = __import__(modname, fromlist=[clsname])
    cls = getattr(mod, clsname)
    return cls
