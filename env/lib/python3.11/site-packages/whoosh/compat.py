import array, sys


# Run time aliasing of Python2/3 differences

def htmlescape(s, quote=True):
    # this is html.escape reimplemented with cgi.escape,
    # so it works for python 2.x, 3.0 and 3.1
    import cgi
    s = cgi.escape(s, quote)
    if quote:
        # python 3.2 also replaces the single quotes:
        s = s.replace("'", "&#x27;")
    return s

if sys.version_info[0] < 3:
    PY3 = False

    def b(s):
        return s

    import cStringIO as StringIO
    StringIO = BytesIO = StringIO.StringIO
    callable = callable
    integer_types = (int, long)
    iteritems = lambda o: o.iteritems()
    itervalues = lambda o: o.itervalues()
    iterkeys = lambda o: o.iterkeys()
    from itertools import izip
    long_type = long
    next = lambda o: o.next()
    import cPickle as pickle
    from cPickle import dumps, loads, dump, load
    string_type = basestring
    text_type = unicode
    bytes_type = str
    unichr = unichr
    from urllib import urlretrieve
    import Queue as queue

    def byte(num):
        return chr(num)

    def u(s):
        return unicode(s, "unicode_escape")

    def with_metaclass(meta, base=object):
        class _WhooshBase(base):
            __metaclass__ = meta
        return _WhooshBase

    xrange = xrange
    zip_ = zip

    def memoryview_(source, offset=None, length=None):
        if offset or length:
            return buffer(source, offset, length)
        else:
            return buffer(source)

else:
    PY3 = True
    import collections

    def b(s):
        return s.encode("latin-1")

    import io
    BytesIO = io.BytesIO
    callable = lambda o: isinstance(o, collections.Callable)
    exec_ = eval("exec")
    integer_types = (int,)
    iteritems = lambda o: o.items()
    itervalues = lambda o: o.values()
    iterkeys = lambda o: iter(o.keys())
    izip = zip
    long_type = int
    next = next
    import pickle
    from pickle import dumps, loads, dump, load
    StringIO = io.StringIO
    string_type = str
    text_type = str
    bytes_type = bytes
    unichr = chr
    from urllib.request import urlretrieve
    import queue

    def byte(num):
        return bytes((num,))

    def u(s):
        if isinstance(s, bytes):
            return s.decode("ascii")
        return s

    def with_metaclass(meta, base=object):
        ns = dict(base=base, meta=meta)
        exec_("""class _WhooshBase(base, metaclass=meta):
    pass""", ns)
        return ns["_WhooshBase"]

    xrange = range
    zip_ = lambda * args: list(zip(*args))

    def memoryview_(source, offset=None, length=None):
        mv = memoryview(source)
        if offset or length:
            return mv[offset:offset + length]
        else:
            return mv

    try:
        # for python >= 3.2, avoid DeprecationWarning for cgi.escape
        from html import escape as htmlescape
    except ImportError:
        pass


if hasattr(array.array, "tobytes"):
    def array_tobytes(arry):
        return arry.tobytes()

    def array_frombytes(arry, bs):
        return arry.frombytes(bs)
else:
    def array_tobytes(arry):
        return arry.tostring()

    def array_frombytes(arry, bs):
        return arry.fromstring(bs)


# Implementations missing from older versions of Python

try:
    from itertools import permutations  # @UnusedImport
except ImportError:
    # Python 2.5
    def permutations(iterable, r=None):
        pool = tuple(iterable)
        n = len(pool)
        r = n if r is None else r
        if r > n:
            return
        indices = range(n)
        cycles = range(n, n - r, -1)
        yield tuple(pool[i] for i in indices[:r])
        while n:
            for i in reversed(range(r)):
                cycles[i] -= 1
                if cycles[i] == 0:
                    indices[i:] = indices[i + 1:] + indices[i:i + 1]
                    cycles[i] = n - i
                else:
                    j = cycles[i]
                    indices[i], indices[-j] = indices[-j], indices[i]
                    yield tuple(pool[i] for i in indices[:r])
                    break
            else:
                return


try:
    # Python 2.6-2.7
    from itertools import izip_longest  # @UnusedImport
except ImportError:
    try:
        # Python 3.0
        from itertools import zip_longest as izip_longest  # @UnusedImport
    except ImportError:
        # Python 2.5
        from itertools import chain, izip, repeat

        def izip_longest(*args, **kwds):
            fillvalue = kwds.get('fillvalue')

            def sentinel(counter=([fillvalue] * (len(args) - 1)).pop):
                yield counter()

            fillers = repeat(fillvalue)
            iters = [chain(it, sentinel(), fillers) for it in args]
            try:
                for tup in izip(*iters):
                    yield tup
            except IndexError:
                pass


try:
    from operator import methodcaller  # @UnusedImport
except ImportError:
    # Python 2.5
    def methodcaller(name, *args, **kwargs):
        def caller(obj):
            return getattr(obj, name)(*args, **kwargs)
        return caller


try:
    from abc import abstractmethod  # @UnusedImport
except ImportError:
    # Python 2.5
    def abstractmethod(funcobj):
        """A decorator indicating abstract methods.
        """
        funcobj.__isabstractmethod__ = True
        return funcobj
