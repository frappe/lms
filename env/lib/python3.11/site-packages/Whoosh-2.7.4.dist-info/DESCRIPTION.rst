About Whoosh
============

Whoosh is a fast, featureful full-text indexing and searching library
implemented in pure Python. Programmers can use it to easily add search
functionality to their applications and websites. Every part of how Whoosh
works can be extended or replaced to meet your needs exactly.

Some of Whoosh's features include:

* Pythonic API.
* Pure-Python. No compilation or binary packages needed, no mysterious crashes.
* Fielded indexing and search.
* Fast indexing and retrieval -- faster than any other pure-Python, scoring,
  full-text search solution I know of.
* Pluggable scoring algorithm (including BM25F), text analysis, storage,
  posting format, etc.
* Powerful query language.
* Pure Python spell-checker (as far as I know, the only one). 

Whoosh might be useful in the following circumstances:

* Anywhere a pure-Python solution is desirable to avoid having to build/compile
  native libraries (or force users to build/compile them).
* As a research platform (at least for programmers that find Python easier to
  read and work with than Java ;)
* When an easy-to-use Pythonic interface is more important to you than raw
  speed. 

Whoosh was created and is maintained by Matt Chaput. It was originally created
for use in the online help system of Side Effects Software's 3D animation
software Houdini. Side Effects Software Inc. graciously agreed to open-source
the code.

This software is licensed under the terms of the simplified BSD (A.K.A. "two
clause" or "FreeBSD") license. See LICENSE.txt for information.

Installing Whoosh
=================

If you have ``setuptools`` or ``pip`` installed, you can use ``easy_install``
or ``pip`` to download and install Whoosh automatically::

    $ easy_install Whoosh

    or

    $ pip install Whoosh

Learning more
=============

* Read the online documentation at https://whoosh.readthedocs.org/en/latest/

* Join the Whoosh mailing list at http://groups.google.com/group/whoosh

* File bug reports and view the Whoosh wiki at
  http://bitbucket.org/mchaput/whoosh/

Getting the source
==================

Download source releases from PyPI at http://pypi.python.org/pypi/Whoosh/

You can check out the latest version of the source code using Mercurial::

    hg clone http://bitbucket.org/mchaput/whoosh



