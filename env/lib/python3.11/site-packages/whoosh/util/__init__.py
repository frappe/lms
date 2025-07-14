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
import random, sys, time
from bisect import insort, bisect_left
from functools import wraps

from whoosh.compat import xrange


# These must be valid separate characters in CASE-INSENSTIVE filenames
IDCHARS = "0123456789abcdefghijklmnopqrstuvwxyz"


if hasattr(time, "perf_counter"):
    now = time.perf_counter
elif sys.platform == 'win32':
    now = time.clock
else:
    now = time.time


def random_name(size=28):
    return "".join(random.choice(IDCHARS) for _ in xrange(size))


def random_bytes(size=28):
    gen = (random.randint(0, 255) for _ in xrange(size))
    if sys.version_info[0] >= 3:
        return bytes(gen)
    else:
        return array("B", gen).tostring()


def make_binary_tree(fn, args, **kwargs):
    """Takes a function/class that takes two positional arguments and a list of
    arguments and returns a binary tree of results/instances.

    >>> make_binary_tree(UnionMatcher, [matcher1, matcher2, matcher3])
    UnionMatcher(matcher1, UnionMatcher(matcher2, matcher3))

    Any keyword arguments given to this function are passed to the class
    initializer.
    """

    count = len(args)
    if not count:
        raise ValueError("Called make_binary_tree with empty list")
    elif count == 1:
        return args[0]

    half = count // 2
    return fn(make_binary_tree(fn, args[:half], **kwargs),
              make_binary_tree(fn, args[half:], **kwargs), **kwargs)


def make_weighted_tree(fn, ls, **kwargs):
    """Takes a function/class that takes two positional arguments and a list of
    (weight, argument) tuples and returns a huffman-like weighted tree of
    results/instances.
    """

    if not ls:
        raise ValueError("Called make_weighted_tree with empty list")

    ls.sort()
    while len(ls) > 1:
        a = ls.pop(0)
        b = ls.pop(0)
        insort(ls, (a[0] + b[0], fn(a[1], b[1])))
    return ls[0][1]


# Fibonacci function

_fib_cache = {}


def fib(n):
    """Returns the nth value in the Fibonacci sequence.
    """

    if n <= 2:
        return n
    if n in _fib_cache:
        return _fib_cache[n]
    result = fib(n - 1) + fib(n - 2)
    _fib_cache[n] = result
    return result


# Decorators

def synchronized(func):
    """Decorator for storage-access methods, which synchronizes on a threading
    lock. The parent object must have 'is_closed' and '_sync_lock' attributes.
    """

    @wraps(func)
    def synchronized_wrapper(self, *args, **kwargs):
        with self._sync_lock:
            return func(self, *args, **kwargs)

    return synchronized_wrapper


def unclosed(method):
    """
    Decorator to check if the object is closed.
    """

    @wraps(method)
    def unclosed_wrapper(self, *args, **kwargs):
        if self.closed:
            raise ValueError("Operation on a closed object")
        return method(self, *args, **kwargs)
    return unclosed_wrapper
