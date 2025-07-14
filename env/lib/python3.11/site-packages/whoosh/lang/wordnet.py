# Copyright 2009 Matt Chaput. All rights reserved.
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

"""This module contains low-level functions and a high-level class for parsing
the prolog file "wn_s.pl" from the WordNet prolog download
into an object suitable for looking up synonyms and performing query expansion.

http://wordnetcode.princeton.edu/3.0/WNprolog-3.0.tar.gz
"""

from collections import defaultdict

from whoosh.compat import iterkeys, text_type
from whoosh.fields import Schema, ID, STORED


def parse_file(f):
    """Parses the WordNet wn_s.pl prolog file and returns two dictionaries:
    word2nums and num2words.
    """

    word2nums = defaultdict(list)
    num2words = defaultdict(list)

    for line in f:
        if not line.startswith("s("):
            continue

        line = line[2:]
        num = int(line[:line.find(",")])
        qt = line.find("'")
        line = line[qt + 1:]
        qt = line.find("'")
        word = line[:qt].lower()

        if not word.isalpha():
            continue

        word2nums[word].append(num)
        num2words[num].append(word)

    return word2nums, num2words


def make_index(storage, indexname, word2nums, num2words):
    """Creates a Whoosh index in the given storage object containing
    synonyms taken from word2nums and num2words. Returns the Index
    object.
    """

    schema = Schema(word=ID, syns=STORED)
    ix = storage.create_index(schema, indexname=indexname)
    w = ix.writer()
    for word in iterkeys(word2nums):
        syns = synonyms(word2nums, num2words, word)
        w.add_document(word=text_type(word), syns=syns)
    w.commit()
    return ix


def synonyms(word2nums, num2words, word):
    """Uses the word2nums and num2words dicts to look up synonyms
    for the given word. Returns a list of synonym strings.
    """

    keys = word2nums[word]
    syns = set()
    for key in keys:
        syns = syns.union(num2words[key])

    if word in syns:
        syns.remove(word)
    return sorted(syns)


class Thesaurus(object):
    """Represents the WordNet synonym database, either loaded into memory
    from the wn_s.pl Prolog file, or stored on disk in a Whoosh index.

    This class allows you to parse the prolog file "wn_s.pl" from the WordNet prolog
    download into an object suitable for looking up synonyms and performing query
    expansion.

    http://wordnetcode.princeton.edu/3.0/WNprolog-3.0.tar.gz

    To load a Thesaurus object from the wn_s.pl file...

    >>> t = Thesaurus.from_filename("wn_s.pl")

    To save the in-memory Thesaurus to a Whoosh index...

    >>> from whoosh.filedb.filestore import FileStorage
    >>> fs = FileStorage("index")
    >>> t.to_storage(fs)

    To load a Thesaurus object from a Whoosh index...

    >>> t = Thesaurus.from_storage(fs)

    The Thesaurus object is thus usable in two ways:

    * Parse the wn_s.pl file into memory (Thesaurus.from_*) and then look up
      synonyms in memory. This has a startup cost for parsing the file, and uses
      quite a bit of memory to store two large dictionaries, however synonym
      look-ups are very fast.

    * Parse the wn_s.pl file into memory (Thesaurus.from_filename) then save it to
      an index (to_storage). From then on, open the thesaurus from the saved
      index (Thesaurus.from_storage). This has a large cost for storing the index,
      but after that it is faster to open the Thesaurus (than re-parsing the file)
      but slightly slower to look up synonyms.

    Here are timings for various tasks on my (fast) Windows machine, which might
    give an idea of relative costs for in-memory vs. on-disk.

    ================================================ ================
    Task                                             Approx. time (s)
    ================================================ ================
    Parsing the wn_s.pl file                         1.045
    Saving to an on-disk index                       13.084
    Loading from an on-disk index                    0.082
    Look up synonyms for "light" (in memory)         0.0011
    Look up synonyms for "light" (loaded from disk)  0.0028
    ================================================ ================

    Basically, if you can afford spending the memory necessary to parse the
    Thesaurus and then cache it, it's faster. Otherwise, use an on-disk index.
    """

    def __init__(self):
        self.w2n = None
        self.n2w = None
        self.searcher = None

    @classmethod
    def from_file(cls, fileobj):
        """Creates a Thesaurus object from the given file-like object, which should
        contain the WordNet wn_s.pl file.

        >>> f = open("wn_s.pl")
        >>> t = Thesaurus.from_file(f)
        >>> t.synonyms("hail")
        ['acclaim', 'come', 'herald']
        """

        thes = cls()
        thes.w2n, thes.n2w = parse_file(fileobj)
        return thes

    @classmethod
    def from_filename(cls, filename):
        """Creates a Thesaurus object from the given filename, which should
        contain the WordNet wn_s.pl file.

        >>> t = Thesaurus.from_filename("wn_s.pl")
        >>> t.synonyms("hail")
        ['acclaim', 'come', 'herald']
        """

        f = open(filename, "rb")
        try:
            return cls.from_file(f)
        finally:
            f.close()

    @classmethod
    def from_storage(cls, storage, indexname="THES"):
        """Creates a Thesaurus object from the given storage object,
        which should contain an index created by Thesaurus.to_storage().

        >>> from whoosh.filedb.filestore import FileStorage
        >>> fs = FileStorage("index")
        >>> t = Thesaurus.from_storage(fs)
        >>> t.synonyms("hail")
        ['acclaim', 'come', 'herald']

        :param storage: A :class:`whoosh.store.Storage` object from
            which to load the index.
        :param indexname: A name for the index. This allows you to
            store multiple indexes in the same storage object.
        """

        thes = cls()
        index = storage.open_index(indexname=indexname)
        thes.searcher = index.searcher()
        return thes

    def to_storage(self, storage, indexname="THES"):
        """Creates am index in the given storage object from the
        synonyms loaded from a WordNet file.

        >>> from whoosh.filedb.filestore import FileStorage
        >>> fs = FileStorage("index")
        >>> t = Thesaurus.from_filename("wn_s.pl")
        >>> t.to_storage(fs)

        :param storage: A :class:`whoosh.store.Storage` object in
            which to save the index.
        :param indexname: A name for the index. This allows you to
            store multiple indexes in the same storage object.
        """

        if not self.w2n or not self.n2w:
            raise Exception("No synonyms loaded")
        make_index(storage, indexname, self.w2n, self.n2w)

    def synonyms(self, word):
        """Returns a list of synonyms for the given word.

        >>> thesaurus.synonyms("hail")
        ['acclaim', 'come', 'herald']
        """

        word = word.lower()
        if self.searcher:
            return self.searcher.document(word=word)["syns"]
        else:
            return synonyms(self.w2n, self.n2w, word)
