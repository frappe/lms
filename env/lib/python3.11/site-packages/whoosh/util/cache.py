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
import functools, random
from array import array
from heapq import nsmallest
from operator import itemgetter
from threading import Lock
from time import time

from whoosh.compat import iteritems, xrange


try:
    from collections import Counter
except ImportError:
    class Counter(dict):
        def __missing__(self, key):
            return 0


def unbound_cache(func):
    """Caching decorator with an unbounded cache size.
    """

    cache = {}

    @functools.wraps(func)
    def caching_wrapper(*args):
        try:
            return cache[args]
        except KeyError:
            result = func(*args)
            cache[args] = result
            return result

    return caching_wrapper


def lru_cache(maxsize=100):
    """A simple cache that, when the cache is full, deletes the least recently
    used 10% of the cached values.

    This function duplicates (more-or-less) the protocol of the
    ``functools.lru_cache`` decorator in the Python 3.2 standard library.

    Arguments to the cached function must be hashable.

    View the cache statistics tuple ``(hits, misses, maxsize, currsize)``
    with f.cache_info().  Clear the cache and statistics with f.cache_clear().
    Access the underlying function with f.__wrapped__.
    """

    def decorating_function(user_function):
        stats = [0, 0]  # Hits, misses
        data = {}
        lastused = {}

        @functools.wraps(user_function)
        def wrapper(*args):
            try:
                result = data[args]
                stats[0] += 1  # Hit
            except KeyError:
                stats[1] += 1  # Miss
                if len(data) == maxsize:
                    for k, _ in nsmallest(maxsize // 10 or 1,
                                          iteritems(lastused),
                                          key=itemgetter(1)):
                        del data[k]
                        del lastused[k]
                data[args] = user_function(*args)
                result = data[args]
            finally:
                lastused[args] = time()
            return result

        def cache_info():
            return stats[0], stats[1], maxsize, len(data)

        def cache_clear():
            data.clear()
            lastused.clear()
            stats[0] = stats[1] = 0

        wrapper.cache_info = cache_info
        wrapper.cache_clear = cache_clear
        return wrapper
    return decorating_function


def lfu_cache(maxsize=100):
    """A simple cache that, when the cache is full, deletes the least frequently
    used 10% of the cached values.

    This function duplicates (more-or-less) the protocol of the
    ``functools.lru_cache`` decorator in the Python 3.2 standard library.

    Arguments to the cached function must be hashable.

    View the cache statistics tuple ``(hits, misses, maxsize, currsize)``
    with f.cache_info().  Clear the cache and statistics with f.cache_clear().
    Access the underlying function with f.__wrapped__.
    """

    def decorating_function(user_function):
        stats = [0, 0]  # Hits, misses
        data = {}
        usecount = Counter()

        @functools.wraps(user_function)
        def wrapper(*args):
            try:
                result = data[args]
                stats[0] += 1  # Hit
            except KeyError:
                stats[1] += 1  # Miss
                if len(data) == maxsize:
                    for k, _ in nsmallest(maxsize // 10 or 1,
                                          iteritems(usecount),
                                          key=itemgetter(1)):
                        del data[k]
                        del usecount[k]
                data[args] = user_function(*args)
                result = data[args]
            finally:
                usecount[args] += 1
            return result

        def cache_info():
            return stats[0], stats[1], maxsize, len(data)

        def cache_clear():
            data.clear()
            usecount.clear()

        wrapper.cache_info = cache_info
        wrapper.cache_clear = cache_clear
        return wrapper
    return decorating_function


def random_cache(maxsize=100):
    """A very simple cache that, when the cache is filled, deletes 10% of the
    cached values AT RANDOM.

    This function duplicates (more-or-less) the protocol of the
    ``functools.lru_cache`` decorator in the Python 3.2 standard library.

    Arguments to the cached function must be hashable.

    View the cache statistics tuple ``(hits, misses, maxsize, currsize)``
    with f.cache_info().  Clear the cache and statistics with f.cache_clear().
    Access the underlying function with f.__wrapped__.
    """

    def decorating_function(user_function):
        stats = [0, 0]  # hits, misses
        data = {}

        @functools.wraps(user_function)
        def wrapper(*args):
            try:
                result = data[args]
                stats[0] += 1  # Hit
            except KeyError:
                stats[1] += 1  # Miss
                if len(data) == maxsize:
                    keys = data.keys()
                    for i in xrange(maxsize // 10 or 1):
                        n = random.randint(0, len(keys) - 1)
                        k = keys.pop(n)
                        del data[k]
                data[args] = user_function(*args)
                result = data[args]
            return result

        def cache_info():
            return stats[0], stats[1], maxsize, len(data)

        def cache_clear():
            data.clear()

        wrapper.cache_info = cache_info
        wrapper.cache_clear = cache_clear
        return wrapper
    return decorating_function


def db_lru_cache(maxsize=100):
    """Double-barrel least-recently-used cache decorator. This is a simple
    LRU algorithm that keeps a primary and secondary dict. Keys are checked
    in the primary dict, and then the secondary. Once the primary dict fills
    up, the secondary dict is cleared and the two dicts are swapped.

    This function duplicates (more-or-less) the protocol of the
    ``functools.lru_cache`` decorator in the Python 3.2 standard library.

    Arguments to the cached function must be hashable.

    View the cache statistics tuple ``(hits, misses, maxsize, currsize)``
    with f.cache_info().  Clear the cache and statistics with f.cache_clear().
    Access the underlying function with f.__wrapped__.
    """

    def decorating_function(user_function):
        # Cache1, Cache2, Pointer, Hits, Misses
        stats = [{}, {}, 0, 0, 0]

        @functools.wraps(user_function)
        def wrapper(*args):
            ptr = stats[2]
            a = stats[ptr]
            b = stats[not ptr]
            key = args

            if key in a:
                stats[3] += 1  # Hit
                return a[key]
            elif key in b:
                stats[3] += 1  # Hit
                return b[key]
            else:
                stats[4] += 1  # Miss
                result = user_function(*args)
                a[key] = result
                if len(a) >= maxsize:
                    stats[2] = not ptr
                    b.clear()
                return result

        def cache_info():
            return stats[3], stats[4], maxsize, len(stats[0]) + len(stats[1])

        def cache_clear():
            """Clear the cache and cache statistics"""
            stats[0].clear()
            stats[1].clear()
            stats[3] = stats[4] = 0

        wrapper.cache_info = cache_info
        wrapper.cache_clear = cache_clear

        return wrapper
    return decorating_function


def clockface_lru_cache(maxsize=100):
    """Least-recently-used cache decorator.

    This function duplicates (more-or-less) the protocol of the
    ``functools.lru_cache`` decorator in the Python 3.2 standard library, but
    uses the clock face LRU algorithm instead of an ordered dictionary.

    If *maxsize* is set to None, the LRU features are disabled and the cache
    can grow without bound.

    Arguments to the cached function must be hashable.

    View the cache statistics named tuple (hits, misses, maxsize, currsize)
    with f.cache_info().  Clear the cache and statistics with f.cache_clear().
    Access the underlying function with f.__wrapped__.
    """

    def decorating_function(user_function):
        stats = [0, 0, 0]  # hits, misses, hand
        data = {}

        if maxsize:
            # The keys at each point on the clock face
            clock_keys = [None] * maxsize
            # The "referenced" bits at each point on the clock face
            clock_refs = array("B", (0 for _ in xrange(maxsize)))
            lock = Lock()

            @functools.wraps(user_function)
            def wrapper(*args):
                key = args
                try:
                    with lock:
                        pos, result = data[key]
                        # The key is in the cache. Set the key's reference bit
                        clock_refs[pos] = 1
                        # Record a cache hit
                        stats[0] += 1
                except KeyError:
                    # Compute the value
                    result = user_function(*args)
                    with lock:
                        # Current position of the clock hand
                        hand = stats[2]
                        # Remember to stop here after a full revolution
                        end = hand
                        # Sweep around the clock looking for a position with
                        # the reference bit off
                        while True:
                            hand = (hand + 1) % maxsize
                            current_ref = clock_refs[hand]
                            if current_ref:
                                # This position's "referenced" bit is set. Turn
                                # the bit off and move on.
                                clock_refs[hand] = 0
                            elif not current_ref or hand == end:
                                # We've either found a position with the
                                # "reference" bit off or reached the end of the
                                # circular cache. So we'll replace this
                                # position with the new key
                                current_key = clock_keys[hand]
                                if current_key in data:
                                    del data[current_key]
                                clock_keys[hand] = key
                                clock_refs[hand] = 1
                                break
                        # Put the key and result in the cache
                        data[key] = (hand, result)
                        # Save the new hand position
                        stats[2] = hand
                        # Record a cache miss
                        stats[1] += 1
                return result

        else:
            @functools.wraps(user_function)
            def wrapper(*args):
                key = args
                try:
                    result = data[key]
                    stats[0] += 1
                except KeyError:
                    result = user_function(*args)
                    data[key] = result
                    stats[1] += 1
                return result

        def cache_info():
            return stats[0], stats[1], maxsize, len(data)

        def cache_clear():
            """Clear the cache and cache statistics"""
            data.clear()
            stats[0] = stats[1] = stats[2] = 0
            for i in xrange(maxsize):
                clock_keys[i] = None
                clock_refs[i] = 0

        wrapper.cache_info = cache_info
        wrapper.cache_clear = cache_clear
        return wrapper
    return decorating_function

