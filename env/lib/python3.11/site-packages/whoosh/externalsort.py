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

"""
This module implements a general external merge sort for Python objects.
"""

from __future__ import with_statement

import os, tempfile
from heapq import heapify, heappop, heapreplace

from whoosh.compat import dump, load


## Python 3.2 had a bug that make marshal.load unusable
#if (hasattr(platform, "python_implementation")
#    and platform.python_implementation() == "CPython"
#    and platform.python_version() == "3.2.0"):
#    # Use pickle instead of marshal on Python 3.2
#    from whoosh.compat import dump as dump_pickle
#    from whoosh.compat import load
#
#    def dump(obj, f):
#        dump_pickle(obj, f, -1)
#else:
#    from marshal import dump, load


try:
    from heapq import merge

    def imerge(iterables):
        return merge(*iterables)
except ImportError:
    def imerge(iterables):
        _hpop, _hreplace, _Stop = (heappop, heapreplace, StopIteration)
        h = []
        h_append = h.append
        for itnum, it in enumerate(map(iter, iterables)):
            try:
                nx = it.next
                h_append([nx(), itnum, nx])
            except _Stop:
                pass
        heapify(h)

        while 1:
            try:
                while 1:
                    v, itnum, nx = s = h[0]
                    yield v
                    s[0] = nx()
                    _hreplace(h, s)
            except _Stop:
                _hpop(h)
            except IndexError:
                return


class SortingPool(object):
    """This object implements a general K-way external merge sort for Python
    objects.

    >>> pool = MergePool()
    >>> # Add an unlimited number of items in any order
    >>> for item in my_items:
    ...     pool.add(item)
    ...
    >>> # Get the items back in sorted order
    >>> for item in pool.items():
    ...     print(item)

    This class uses the `marshal` module to write the items to temporary files,
    so you can only sort marshal-able types (generally: numbers, strings,
    tuples, lists, and dicts).
    """

    def __init__(self, maxsize=1000000, tempdir=None, prefix="",
                 suffix=".run"):
        """
        :param maxsize: the maximum number of items to keep in memory at once.
        :param tempdir: the path of a directory to use for temporary file
            storage. The default is to use the system's temp directory.
        :param prefix: a prefix to add to temporary filenames.
        :param suffix: a suffix to add to temporary filenames.
        """

        self.tempdir = tempdir
        if maxsize < 1:
            raise ValueError("maxsize=%s must be >= 1" % maxsize)
        self.maxsize = maxsize
        self.prefix = prefix
        self.suffix = suffix
        # Current run queue
        self.current = []
        # List of run filenames
        self.runs = []

    def _new_run(self):
        fd, path = tempfile.mkstemp(prefix=self.prefix, suffix=self.suffix,
                                    dir=self.tempdir)
        f = os.fdopen(fd, "wb")
        return path, f

    def _open_run(self, path):
        return open(path, "rb")

    def _remove_run(self, path):
        os.remove(path)

    def _read_run(self, path):
        f = self._open_run(path)
        try:
            while True:
                yield load(f)
        except EOFError:
            return
        finally:
            f.close()
            self._remove_run(path)

    def _merge_runs(self, paths):
        iters = [self._read_run(path) for path in paths]
        for item in imerge(iters):
            yield item

    def add(self, item):
        """Adds `item` to the pool to be sorted.
        """

        if len(self.current) >= self.maxsize:
            self.save()
        self.current.append(item)

    def _write_run(self, f, items):
        for item in items:
            dump(item, f, 2)
        f.close()

    def _add_run(self, filename):
        self.runs.append(filename)

    def save(self):
        current = self.current
        if current:
            current.sort()
            path, f = self._new_run()
            self._write_run(f, current)
            self._add_run(path)
            self.current = []

    def cleanup(self):
        for path in self.runs:
            try:
                os.remove(path)
            except OSError:
                pass

    def reduce_to(self, target, k):
        # Reduce the number of runs to "target" by merging "k" runs at a time

        if k < 2:
            raise ValueError("k=%s must be > 2" % k)
        if target < 1:
            raise ValueError("target=%s must be >= 1" % target)
        runs = self.runs
        while len(runs) > target:
            newpath, f = self._new_run()
            # Take k runs off the end of the run list
            tomerge = []
            while runs and len(tomerge) < k:
                tomerge.append(runs.pop())
            # Merge them into a new run and add it at the start of the list
            self._write_run(f, self._merge_runs(tomerge))
            runs.insert(0, newpath)

    def items(self, maxfiles=128):
        """Returns a sorted list or iterator of the items in the pool.

        :param maxfiles: maximum number of files to open at once.
        """

        if maxfiles < 2:
            raise ValueError("maxfiles=%s must be >= 2" % maxfiles)

        if not self.runs:
            # We never wrote a run to disk, so just sort the queue in memory
            # and return that
            return sorted(self.current)
        # Write a new run with the leftover items in the queue
        self.save()

        # If we have more runs than allowed open files, merge some of the runs
        if maxfiles < len(self.runs):
            self.reduce_to(maxfiles, maxfiles)

        # Take all the runs off the run list and merge them
        runs = self.runs
        self.runs = []  # Minor detail, makes this object reusable
        return self._merge_runs(runs)


def sort(items, maxsize=100000, tempdir=None, maxfiles=128):
    """Sorts the given items using an external merge sort.

    :param tempdir: the path of a directory to use for temporary file
        storage. The default is to use the system's temp directory.
    :param maxsize: the maximum number of items to keep in memory at once.
    :param maxfiles: maximum number of files to open at once.
    """

    p = SortingPool(maxsize=maxsize, tempdir=tempdir)
    for item in items:
        p.add(item)
    return p.items(maxfiles=maxfiles)
