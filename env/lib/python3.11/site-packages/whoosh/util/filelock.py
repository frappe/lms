# Copyright 2010 Matt Chaput. All rights reserved.
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
This module contains classes implementing exclusive locks for platforms with
fcntl (UNIX and Mac OS X) and Windows. Whoosh originally used directory
creation as a locking method, but it had the problem that if the program
crashed the lock directory was left behind and would keep the index locked
until it was cleaned up. Using OS-level file locks fixes this.
"""

import errno
import os
import sys
import time


def try_for(fn, timeout=5.0, delay=0.1):
    """Calls ``fn`` every ``delay`` seconds until it returns True or
    ``timeout`` seconds elapse. Returns True if the lock was acquired, or False
    if the timeout was reached.

    :param timeout: Length of time (in seconds) to keep retrying to acquire the
        lock. 0 means return immediately. Only used when blocking is False.
    :param delay: How often (in seconds) to retry acquiring the lock during
        the timeout period. Only used when blocking is False and timeout > 0.
    """

    until = time.time() + timeout
    v = fn()
    while not v and time.time() < until:
        time.sleep(delay)
        v = fn()
    return v


class LockBase(object):
    """Base class for file locks.
    """

    def __init__(self, filename):
        self.fd = None
        self.filename = filename
        self.locked = False

    def __del__(self):
        if hasattr(self, "fd") and self.fd:
            try:
                self.release()
            except:
                pass

    def acquire(self, blocking=False):
        """Acquire the lock. Returns True if the lock was acquired.

        :param blocking: if True, call blocks until the lock is acquired.
            This may not be available on all platforms. On Windows, this is
            actually just a delay of 10 seconds, rechecking every second.
        """
        pass

    def release(self):
        pass


class FcntlLock(LockBase):
    """File lock based on UNIX-only fcntl module.
    """

    def acquire(self, blocking=False):
        import fcntl  # @UnresolvedImport

        flags = os.O_CREAT | os.O_WRONLY
        self.fd = os.open(self.filename, flags)

        mode = fcntl.LOCK_EX
        if not blocking:
            mode |= fcntl.LOCK_NB

        try:
            fcntl.flock(self.fd, mode)
            self.locked = True
            return True
        except IOError:
            e = sys.exc_info()[1]
            if e.errno not in (errno.EAGAIN, errno.EACCES):
                raise
            os.close(self.fd)
            self.fd = None
            return False

    def release(self):
        if self.fd is None:
            raise Exception("Lock was not acquired")

        import fcntl  # @UnresolvedImport
        fcntl.flock(self.fd, fcntl.LOCK_UN)
        os.close(self.fd)
        self.fd = None


class MsvcrtLock(LockBase):
    """File lock based on Windows-only msvcrt module.
    """

    def acquire(self, blocking=False):
        import msvcrt  # @UnresolvedImport

        flags = os.O_CREAT | os.O_WRONLY
        mode = msvcrt.LK_NBLCK
        if blocking:
            mode = msvcrt.LK_LOCK

        self.fd = os.open(self.filename, flags)
        try:
            msvcrt.locking(self.fd, mode, 1)
            return True
        except IOError:
            e = sys.exc_info()[1]
            if e.errno not in (errno.EAGAIN, errno.EACCES, errno.EDEADLK):
                raise
            os.close(self.fd)
            self.fd = None
            return False

    def release(self):
        import msvcrt  # @UnresolvedImport

        if self.fd is None:
            raise Exception("Lock was not acquired")
        msvcrt.locking(self.fd, msvcrt.LK_UNLCK, 1)
        os.close(self.fd)
        self.fd = None


if os.name == "nt":
    FileLock = MsvcrtLock
else:
    FileLock = FcntlLock
