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

from ast import literal_eval

from whoosh.compat import b, bytes_type, text_type, integer_types, PY3
from whoosh.compat import iteritems, dumps, loads, xrange
from whoosh.codec import base
from whoosh.matching import ListMatcher
from whoosh.reading import TermInfo, TermNotFound

if not PY3:
    class memoryview:
        pass

_reprable = (bytes_type, text_type, integer_types, float)


# Mixin classes for producing and consuming the simple text format

class LineWriter(object):
    def _print_line(self, indent, command, **kwargs):
        self._dbfile.write(b("  ") * indent)
        self._dbfile.write(command.encode("latin1"))
        for k, v in iteritems(kwargs):
            if isinstance(v, memoryview):
                v = bytes(v)
            if v is not None and not isinstance(v, _reprable):
                raise TypeError(type(v))
            self._dbfile.write(("\t%s=%r" % (k, v)).encode("latin1"))
        self._dbfile.write(b("\n"))


class LineReader(object):
    def __init__(self, dbfile):
        self._dbfile = dbfile

    def _reset(self):
        self._dbfile.seek(0)

    def _find_line(self, indent, command, **kwargs):
        for largs in self._find_lines(indent, command, **kwargs):
            return largs

    def _find_lines(self, indent, command, **kwargs):
        while True:
            line = self._dbfile.readline()
            if not line:
                return

            c = self._parse_line(line)
            if c is None:
                return

            lindent, lcommand, largs = c
            if lindent == indent and lcommand == command:
                matched = True
                if kwargs:
                    for k in kwargs:
                        if kwargs[k] != largs.get(k):
                            matched = False
                            break

                if matched:
                    yield largs
            elif lindent < indent:
                return

    def _parse_line(self, line):
        line = line.decode("latin1")
        line = line.rstrip()
        l = len(line)
        line = line.lstrip()
        if not line or line.startswith("#"):
            return None

        indent = (l - len(line)) // 2

        parts = line.split("\t")
        command = parts[0]
        args = {}
        for i in xrange(1, len(parts)):
            n, v = parts[i].split("=")
            args[n] = literal_eval(v)
        return (indent, command, args)

    def _find_root(self, command):
        self._reset()
        c = self._find_line(0, command)
        if c is None:
            raise Exception("No root section %r" % (command,))


# Codec class

class PlainTextCodec(base.Codec):
    length_stats = False

    def per_document_writer(self, storage, segment):
        return PlainPerDocWriter(storage, segment)

    def field_writer(self, storage, segment):
        return PlainFieldWriter(storage, segment)

    def per_document_reader(self, storage, segment):
        return PlainPerDocReader(storage, segment)

    def terms_reader(self, storage, segment):
        return PlainTermsReader(storage, segment)

    def new_segment(self, storage, indexname):
        return PlainSegment(indexname)


class PlainPerDocWriter(base.PerDocumentWriter, LineWriter):
    def __init__(self, storage, segment):
        self._dbfile = storage.create_file(segment.make_filename(".dcs"))
        self._print_line(0, "DOCS")
        self.is_closed = False

    def start_doc(self, docnum):
        self._print_line(1, "DOC", dn=docnum)

    def add_field(self, fieldname, fieldobj, value, length):
        if value is not None:
            value = dumps(value, 2)
        self._print_line(2, "DOCFIELD", fn=fieldname, v=value, len=length)

    def add_column_value(self, fieldname, columnobj, value):
        self._print_line(2, "COLVAL", fn=fieldname, v=value)

    def add_vector_items(self, fieldname, fieldobj, items):
        self._print_line(2, "VECTOR", fn=fieldname)
        for text, weight, vbytes in items:
            self._print_line(3, "VPOST", t=text, w=weight, v=vbytes)

    def finish_doc(self):
        pass

    def close(self):
        self._dbfile.close()
        self.is_closed = True


class PlainPerDocReader(base.PerDocumentReader, LineReader):
    def __init__(self, storage, segment):
        self._dbfile = storage.open_file(segment.make_filename(".dcs"))
        self._segment = segment
        self.is_closed = False

    def doc_count(self):
        return self._segment.doc_count()

    def doc_count_all(self):
        return self._segment.doc_count()

    def has_deletions(self):
        return False

    def is_deleted(self, docnum):
        return False

    def deleted_docs(self):
        return frozenset()

    def _find_doc(self, docnum):
        self._find_root("DOCS")
        c = self._find_line(1, "DOC")
        while c is not None:
            dn = c["dn"]
            if dn == docnum:
                return True
            elif dn > docnum:
                return False
            c = self._find_line(1, "DOC")
        return False

    def _iter_docs(self):
        self._find_root("DOCS")
        c = self._find_line(1, "DOC")
        while c is not None:
            yield c["dn"]
            c = self._find_line(1, "DOC")

    def _iter_docfields(self, fieldname):
        for _ in self._iter_docs():
            for c in self._find_lines(2, "DOCFIELD", fn=fieldname):
                yield c

    def _iter_lengths(self, fieldname):
        return (c.get("len", 0) for c in self._iter_docfields(fieldname))

    def doc_field_length(self, docnum, fieldname, default=0):
        for dn in self._iter_docs():
            if dn == docnum:

                c = self._find_line(2, "DOCFIELD", fn=fieldname)
                if c is not None:
                    return c.get("len", default)
            elif dn > docnum:
                break

        return default

    def _column_values(self, fieldname):
        for i, docnum in enumerate(self._iter_docs()):
            if i != docnum:
                raise Exception("Missing column value for field %r doc %d?"
                                % (fieldname, i))

            c = self._find_line(2, "COLVAL", fn=fieldname)
            if c is None:
                raise Exception("Missing column value for field %r doc %d?"
                                % (fieldname, docnum))

            yield c.get("v")

    def has_column(self, fieldname):
        for _ in self._column_values(fieldname):
            return True
        return False

    def column_reader(self, fieldname, column):
        return list(self._column_values(fieldname))

    def field_length(self, fieldname):
        return sum(self._iter_lengths(fieldname))

    def min_field_length(self, fieldname):
        return min(self._iter_lengths(fieldname))

    def max_field_length(self, fieldname):
        return max(self._iter_lengths(fieldname))

    def has_vector(self, docnum, fieldname):
        if self._find_doc(docnum):
            if self._find_line(2, "VECTOR"):
                return True
        return False

    def vector(self, docnum, fieldname, format_):
        if not self._find_doc(docnum):
            raise Exception
        if not self._find_line(2, "VECTOR"):
            raise Exception

        ids = []
        weights = []
        values = []
        c = self._find_line(3, "VPOST")
        while c is not None:
            ids.append(c["t"])
            weights.append(c["w"])
            values.append(c["v"])
            c = self._find_line(3, "VPOST")

        return ListMatcher(ids, weights, values, format_,)

    def _read_stored_fields(self):
        sfs = {}
        c = self._find_line(2, "DOCFIELD")
        while c is not None:
            v = c.get("v")
            if v is not None:
                v = loads(v)
            sfs[c["fn"]] = v
            c = self._find_line(2, "DOCFIELD")
        return sfs

    def stored_fields(self, docnum):
        if not self._find_doc(docnum):
            raise Exception
        return self._read_stored_fields()

    def iter_docs(self):
        return enumerate(self.all_stored_fields())

    def all_stored_fields(self):
        for _ in self._iter_docs():
            yield self._read_stored_fields()

    def close(self):
        self._dbfile.close()
        self.is_closed = True


class PlainFieldWriter(base.FieldWriter, LineWriter):
    def __init__(self, storage, segment):
        self._dbfile = storage.create_file(segment.make_filename(".trm"))
        self._print_line(0, "TERMS")

    @property
    def is_closed(self):
        return self._dbfile.is_closed

    def start_field(self, fieldname, fieldobj):
        self._fieldobj = fieldobj
        self._print_line(1, "TERMFIELD", fn=fieldname)

    def start_term(self, btext):
        self._terminfo = TermInfo()
        self._print_line(2, "BTEXT", t=btext)

    def add(self, docnum, weight, vbytes, length):
        self._terminfo.add_posting(docnum, weight, length)
        self._print_line(3, "POST", dn=docnum, w=weight, v=vbytes)

    def finish_term(self):
        ti = self._terminfo
        self._print_line(3, "TERMINFO",
                         df=ti.doc_frequency(), weight=ti.weight(),
                         minlength=ti.min_length(), maxlength=ti.max_length(),
                         maxweight=ti.max_weight(),
                         minid=ti.min_id(), maxid=ti.max_id())

    def add_spell_word(self, fieldname, text):
        self._print_line(2, "SPELL", fn=fieldname, t=text)

    def close(self):
        self._dbfile.close()


class PlainTermsReader(base.TermsReader, LineReader):
    def __init__(self, storage, segment):
        self._dbfile = storage.open_file(segment.make_filename(".trm"))
        self._segment = segment
        self.is_closed = False

    def _find_field(self, fieldname):
        self._find_root("TERMS")
        if self._find_line(1, "TERMFIELD", fn=fieldname) is None:
            raise TermNotFound("No field %r" % fieldname)

    def _iter_fields(self):
        self._find_root()
        c = self._find_line(1, "TERMFIELD")
        while c is not None:
            yield c["fn"]
            c = self._find_line(1, "TERMFIELD")

    def _iter_btexts(self):
        c = self._find_line(2, "BTEXT")
        while c is not None:
            yield c["t"]
            c = self._find_line(2, "BTEXT")

    def _find_term(self, fieldname, btext):
        self._find_field(fieldname)
        for t in self._iter_btexts():
            if t == btext:
                return True
            elif t > btext:
                break
        return False

    def _find_terminfo(self):
        c = self._find_line(3, "TERMINFO")
        return TermInfo(**c)

    def __contains__(self, term):
        fieldname, btext = term
        return self._find_term(fieldname, btext)

    def indexed_field_names(self):
        return self._iter_fields()

    def terms(self):
        for fieldname in self._iter_fields():
            for btext in self._iter_btexts():
                yield (fieldname, btext)

    def terms_from(self, fieldname, prefix):
        self._find_field(fieldname)
        for btext in self._iter_btexts():
            if btext < prefix:
                continue
            yield (fieldname, btext)

    def items(self):
        for fieldname, btext in self.terms():
            yield (fieldname, btext), self._find_terminfo()

    def items_from(self, fieldname, prefix):
        for fieldname, btext in self.terms_from(fieldname, prefix):
            yield (fieldname, btext), self._find_terminfo()

    def term_info(self, fieldname, btext):
        if not self._find_term(fieldname, btext):
            raise TermNotFound((fieldname, btext))
        return self._find_terminfo()

    def matcher(self, fieldname, btext, format_, scorer=None):
        if not self._find_term(fieldname, btext):
            raise TermNotFound((fieldname, btext))

        ids = []
        weights = []
        values = []
        c = self._find_line(3, "POST")
        while c is not None:
            ids.append(c["dn"])
            weights.append(c["w"])
            values.append(c["v"])
            c = self._find_line(3, "POST")

        return ListMatcher(ids, weights, values, format_, scorer=scorer)

    def close(self):
        self._dbfile.close()
        self.is_closed = True


class PlainSegment(base.Segment):
    def __init__(self, indexname):
        base.Segment.__init__(self, indexname)
        self._doccount = 0

    def codec(self):
        return PlainTextCodec()

    def set_doc_count(self, doccount):
        self._doccount = doccount

    def doc_count(self):
        return self._doccount

    def should_assemble(self):
        return False
