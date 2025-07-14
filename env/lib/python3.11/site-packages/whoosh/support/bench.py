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

from __future__ import division
import os.path
from optparse import OptionParser
from shutil import rmtree

from whoosh import index, qparser, query, scoring
from whoosh.util import now, find_object

try:
    import xappy
except ImportError:
    pass
try:
    import xapian
except ImportError:
    pass
try:
    import pysolr
except ImportError:
    pass

try:
    from persistent import Persistent

    class ZDoc(Persistent):
        def __init__(self, d):
            self.__dict__.update(d)
except ImportError:
    pass


class Module(object):
    def __init__(self, bench, options, args):
        self.bench = bench
        self.options = options
        self.args = args

    def __repr__(self):
        return self.__class__.__name__

    def indexer(self, **kwargs):
        pass

    def index_document(self, d):
        raise NotImplementedError

    def finish(self, **kwargs):
        pass

    def _process_result(self, d):
        attrname = "process_result_%s" % self.options.lib
        if hasattr(self.bench.spec, attrname):
            method = getattr(self.bench.spec, attrname)
            self._process_result = method
            return method(d)
        else:
            self._process_result = lambda x: x
            return d

    def searcher(self):
        pass

    def query(self):
        raise NotImplementedError

    def find(self, q):
        raise NotImplementedError

    def findterms(self, terms):
        raise NotImplementedError

    def results(self, r):
        for hit in r:
            yield self._process_result(hit)


class Spec(object):
    headline_field = "title"
    main_field = "body"

    def __init__(self, options, args):
        self.options = options
        self.args = args

    def documents(self):
        raise NotImplementedError

    def setup(self):
        pass

    def print_results(self, ls):
        showbody = self.options.showbody
        snippets = self.options.snippets
        limit = self.options.limit
        for i, hit in enumerate(ls):
            if i >= limit:
                break

            print("%d. %s" % (i + 1, hit.get(self.headline_field)))
            if snippets:
                print(self.show_snippet(hit))
            if showbody:
                print(hit.get(self.main_field))


class WhooshModule(Module):
    def indexer(self, create=True):
        schema = self.bench.spec.whoosh_schema()
        path = os.path.join(self.options.dir, "%s_whoosh"
                            % self.options.indexname)

        if not os.path.exists(path):
            os.mkdir(path)
        if create:
            ix = index.create_in(path, schema)
        else:
            ix = index.open_dir(path)

        poolclass = None
        if self.options.pool:
            poolclass = find_object(self.options.pool)

        self.writer = ix.writer(limitmb=int(self.options.limitmb),
                                poolclass=poolclass,
                                dir=self.options.tempdir,
                                procs=int(self.options.procs),
                                batchsize=int(self.options.batch),
                                multisegment=self.options.xms)
        self._procdoc = None
        if hasattr(self.bench.spec, "process_document_whoosh"):
            self._procdoc = self.bench.spec.process_document_whoosh

    def index_document(self, d):
        _procdoc = self._procdoc
        if _procdoc:
            _procdoc(d)
        self.writer.add_document(**d)

    def finish(self, merge=True, optimize=False):
        self.writer.commit(merge=merge, optimize=optimize)

    def searcher(self):
        path = os.path.join(self.options.dir, "%s_whoosh"
                            % self.options.indexname)
        ix = index.open_dir(path)
        self.srch = ix.searcher(weighting=scoring.PL2())
        self.parser = qparser.QueryParser(self.bench.spec.main_field,
                                          schema=ix.schema)

    def query(self):
        qstring = " ".join(self.args).decode("utf-8")
        return self.parser.parse(qstring)

    def find(self, q):
        return self.srch.search(q, limit=int(self.options.limit),
                                optimize=self.options.optimize)

    def findterms(self, terms):
        limit = int(self.options.limit)
        s = self.srch
        q = query.Term(self.bench.spec.main_field, None)
        for term in terms:
            q.text = term
            yield s.search(q, limit=limit)


class XappyModule(Module):
    def indexer(self, **kwargs):
        path = os.path.join(self.options.dir, "%s_xappy"
                            % self.options.indexname)
        conn = self.bench.spec.xappy_connection(path)
        return conn

    def index_document(self, conn, d):
        if hasattr(self.bench, "process_document_xappy"):
            self.bench.process_document_xappy(d)
        doc = xappy.UnprocessedDocument()
        for key, values in d:
            if not isinstance(values, list):
                values = [values]
            for value in values:
                doc.fields.append(xappy.Field(key, value))
        conn.add(doc)

    def finish(self, conn):
        conn.flush()

    def searcher(self):
        path = os.path.join(self.options.dir, "%s_xappy"
                            % self.options.indexname)
        return xappy.SearchConnection(path)

    def query(self, conn):
        return conn.query_parse(" ".join(self.args))

    def find(self, conn, q):
        return conn.search(q, 0, int(self.options.limit))

    def findterms(self, conn, terms):
        limit = int(self.options.limit)
        for term in terms:
            q = conn.query_field(self.bench.spec.main_field, term)
            yield conn.search(q, 0, limit)

    def results(self, r):
        hf = self.bench.spec.headline_field
        mf = self.bench.spec.main_field
        for hit in r:
            yield self._process_result({hf: hit.data[hf], mf: hit.data[mf]})


class XapianModule(Module):
    def indexer(self, **kwargs):
        path = os.path.join(self.options.dir, "%s_xapian"
                            % self.options.indexname)
        self.database = xapian.WritableDatabase(path, xapian.DB_CREATE_OR_OPEN)
        self.ixer = xapian.TermGenerator()

    def index_document(self, d):
        if hasattr(self.bench, "process_document_xapian"):
            self.bench.process_document_xapian(d)
        doc = xapian.Document()
        doc.add_value(0, d.get(self.bench.spec.headline_field, "-"))
        doc.set_data(d[self.bench.spec.main_field])
        self.ixer.set_document(doc)
        self.ixer.index_text(d[self.bench.spec.main_field])
        self.database.add_document(doc)

    def finish(self, **kwargs):
        self.database.flush()

    def searcher(self):
        path = os.path.join(self.options.dir, "%s_xappy"
                            % self.options.indexname)
        self.db = xapian.Database(path)
        self.enq = xapian.Enquire(self.db)
        self.qp = xapian.QueryParser()
        self.qp.set_database(self.db)

    def query(self):
        return self.qp.parse_query(" ".join(self.args))

    def find(self, q):
        self.enq.set_query(q)
        return self.enq.get_mset(0, int(self.options.limit))

    def findterms(self, terms):
        limit = int(self.options.limit)
        for term in terms:
            q = self.qp.parse_query(term)
            self.enq.set_query(q)
            yield self.enq.get_mset(0, limit)

    def results(self, matches):
        hf = self.bench.spec.headline_field
        mf = self.bench.spec.main_field
        for m in matches:
            yield self._process_result({hf: m.document.get_value(0),
                                        mf: m.document.get_data()})


class SolrModule(Module):
    def indexer(self, **kwargs):
        self.solr_doclist = []
        self.conn = pysolr.Solr(self.options.url)
        self.conn.delete("*:*")
        self.conn.commit()

    def index_document(self, d):
        self.solr_doclist.append(d)
        if len(self.solr_doclist) >= int(self.options.batch):
            self.conn.add(self.solr_doclist, commit=False)
            self.solr_doclist = []

    def finish(self, **kwargs):
        if self.solr_doclist:
            self.conn.add(self.solr_doclist)
        del self.solr_doclist
        self.conn.optimize(block=True)

    def searcher(self):
        self.solr = pysolr.Solr(self.options.url)

    def query(self):
        return " ".join(self.args)

    def find(self, q):
        return self.solr.search(q, limit=int(self.options.limit))

    def findterms(self, terms):
        limit = int(self.options.limit)
        for term in terms:
            yield self.solr.search("body:" + term, limit=limit)


class ZcatalogModule(Module):
    def indexer(self, **kwargs):
        from ZODB.FileStorage import FileStorage  # @UnresolvedImport
        from ZODB.DB import DB  # @UnresolvedImport
        from zcatalog import catalog  # @UnresolvedImport
        from zcatalog import indexes  # @UnresolvedImport
        import transaction  # @UnresolvedImport

        dir = os.path.join(self.options.dir, "%s_zcatalog"
                           % self.options.indexname)
        if os.path.exists(dir):
            rmtree(dir)
        os.mkdir(dir)

        storage = FileStorage(os.path.join(dir, "index"))
        db = DB(storage)
        conn = db.open()

        self.cat = catalog.Catalog()
        self.bench.spec.zcatalog_setup(self.cat)
        conn.root()["cat"] = self.cat
        transaction.commit()

        self.zcatalog_count = 0

    def index_document(self, d):
        if hasattr(self.bench, "process_document_zcatalog"):
            self.bench.process_document_zcatalog(d)
        doc = ZDoc(d)
        self.cat.index_doc(doc)
        self.zcatalog_count += 1
        if self.zcatalog_count >= 100:
            import transaction  # @UnresolvedImport
            transaction.commit()
            self.zcatalog_count = 0

    def finish(self, **kwargs):
        import transaction  # @UnresolvedImport
        transaction.commit()
        del self.zcatalog_count

    def searcher(self):
        from ZODB.FileStorage import FileStorage  # @UnresolvedImport
        from ZODB.DB import DB  # @UnresolvedImport
        from zcatalog import catalog  # @UnresolvedImport
        from zcatalog import indexes  # @UnresolvedImport
        import transaction  # @UnresolvedImport

        path = os.path.join(self.options.dir, "%s_zcatalog"
                            % self.options.indexname, "index")
        storage = FileStorage(path)
        db = DB(storage)
        conn = db.open()

        self.cat = conn.root()["cat"]

    def query(self):
        return " ".join(self.args)

    def find(self, q):
        return self.cat.searchResults(body=q)

    def findterms(self, terms):
        for term in terms:
            yield self.cat.searchResults(body=term)

    def results(self, r):
        hf = self.bench.spec.headline_field
        mf = self.bench.spec.main_field
        for hit in r:
            # Have to access the attributes for them to be retrieved
            yield self._process_result({hf: getattr(hit, hf),
                                        mf: getattr(hit, mf)})


class NucularModule(Module):
    def indexer(self, create=True):
        import shutil
        from nucular import Nucular

        dir = os.path.join(self.options.dir, "%s_nucular"
                           % self.options.indexname)
        if create:
            if os.path.exists(dir):
                shutil.rmtree(dir)
            os.mkdir(dir)
        self.archive = Nucular.Nucular(dir)
        if create:
            self.archive.create()
        self.count = 0

    def index_document(self, d):
        try:
            self.archive.indexDictionary(str(self.count), d)
        except ValueError:
            print("d=", d)
            raise
        self.count += 1
        if not self.count % int(self.options.batch):
            t = now()
            self.archive.store(lazy=True)
            self.indexer(create=False)

    def finish(self, **kwargs):
        self.archive.store(lazy=False)
        self.archive.aggregateRecent(fast=False, verbose=True)
        self.archive.moveTransientToBase(verbose=True)
        self.archive.cleanUp()

    def searcher(self):
        from nucular import Nucular

        dir = os.path.join(self.options.dir, "%s_nucular"
                           % self.options.indexname)
        self.archive = Nucular.Nucular(dir)

    def query(self):
        return " ".join(self.args)

    def find(self, q):
        return self.archive.dictionaries(q)

    def findterms(self, terms):
        for term in terms:
            q = self.archive.Query()
            q.anyWord(term)
            yield q.resultDictionaries()


class Bench(object):
    libs = {"whoosh": WhooshModule, "xappy": XappyModule,
            "xapian": XapianModule, "solr": SolrModule,
            "zcatalog": ZcatalogModule, "nucular": NucularModule}

    def index(self, lib):
        print("Indexing with %s..." % lib)

        options = self.options
        every = None if options.every is None else int(options.every)
        merge = options.merge
        chunk = int(options.chunk)
        skip = int(options.skip)
        upto = int(options.upto)
        count = 0
        skipc = skip

        starttime = chunkstarttime = now()

        lib.indexer()

        for d in self.spec.documents():
            skipc -= 1
            if not skipc:
                lib.index_document(d)
                count += 1
                skipc = skip
                if chunk and not count % chunk:
                    t = now()
                    sofar = t - starttime
                    print("Done %d docs, %0.3f secs for %d, %0.3f total, %0.3f docs/s" % (count, t - chunkstarttime, chunk, sofar, count / sofar))
                    chunkstarttime = t
                if count > upto:
                    break
                if every and not count % every:
                    print("----Commit")
                    lib.finish(merge=merge)
                    lib.indexer(create=False)

        spooltime = now()
        print("Spool time:", spooltime - starttime)
        lib.finish(merge=merge)
        committime = now()
        print("Commit time:", committime - spooltime)
        totaltime = committime - starttime
        print("Total time to index %d documents: %0.3f secs (%0.3f minutes)" % (count, totaltime, totaltime / 60.0))
        print("Indexed %0.3f docs/s" % (count / totaltime))

    def search(self, lib):
        lib.searcher()

        t = now()
        q = lib.query()
        print("Query:", q)
        r = lib.find(q)
        print("Search time:", now() - t)

        t = now()
        self.spec.print_results(lib.results(r))
        print("Print time:", now() - t)

    def search_file(self, lib):
        f = open(self.options.termfile, "rb")
        terms = [line.strip() for line in f]
        f.close()

        print("Searching %d terms with %s" % (len(terms), lib))
        lib.searcher()
        starttime = now()
        for r in lib.findterms(terms):
            pass
        searchtime = now() - starttime
        print("Search time:", searchtime, "searches/s:", float(len(terms)) / searchtime)

    def _parser(self, name):
        p = OptionParser()
        p.add_option("-x", "--lib", dest="lib",
                     help="Name of the library to use to index/search.",
                     default="whoosh")
        p.add_option("-d", "--dir", dest="dir", metavar="DIRNAME",
                     help="Directory in which to store index.", default=".")
        p.add_option("-s", "--setup", dest="setup", action="store_true",
                     help="Set up any support files or caches.", default=False)
        p.add_option("-i", "--index", dest="index", action="store_true",
                     help="Index the documents.", default=False)
        p.add_option("-n", "--name", dest="indexname", metavar="PREFIX",
                     help="Index name prefix.", default="%s_index" % name)
        p.add_option("-U", "--url", dest="url", metavar="URL",
                     help="Solr URL", default="http://localhost:8983/solr")
        p.add_option("-m", "--mb", dest="limitmb",
                     help="Max. memory usage, in MB", default="128")
        p.add_option("-c", "--chunk", dest="chunk",
                     help="Number of documents to index between progress messages.",
                     default=1000)
        p.add_option("-B", "--batch", dest="batch",
                     help="Batch size for batch adding documents.",
                     default=1000)
        p.add_option("-k", "--skip", dest="skip", metavar="N",
                     help="Index every Nth document.", default=1)
        p.add_option("-e", "--commit-every", dest="every", metavar="NUM",
                      help="Commit every NUM documents", default=None)
        p.add_option("-M", "--no-merge", dest="merge", action="store_false",
                     help="Don't merge segments when doing multiple commits",
                     default=True)
        p.add_option("-u", "--upto", dest="upto", metavar="N",
                     help="Index up to this document number.", default=600000)
        p.add_option("-p", "--procs", dest="procs", metavar="NUMBER",
                     help="Number of processors to use.", default=0)
        p.add_option("-l", "--limit", dest="limit", metavar="N",
                     help="Maximum number of search results to retrieve.",
                     default=10)
        p.add_option("-b", "--body", dest="showbody", action="store_true",
                     help="Show the body text in search results.",
                     default=False)
        p.add_option("-g", "--gen", dest="generate", metavar="N",
                     help="Generate a list at most N terms present in all libraries.",
                     default=None)
        p.add_option("-f", "--file", dest="termfile", metavar="FILENAME",
                     help="Search using the list of terms in this file.",
                     default=None)
        p.add_option("-t", "--tempdir", dest="tempdir", metavar="DIRNAME",
                     help="Whoosh temp dir", default=None)
        p.add_option("-P", "--pool", dest="pool", metavar="CLASSNAME",
                     help="Whoosh pool class", default=None)
        p.add_option("-X", "--xms", dest="xms", action="store_true",
                     help="Experimental Whoosh feature", default=False)
        p.add_option("-Z", "--storebody", dest="storebody", action="store_true",
                     help="Store the body text in index", default=False)
        p.add_option("-q", "--snippets", dest="snippets", action="store_true",
                     help="Show highlighted snippets", default=False)
        p.add_option("-O", "--no-optimize", dest="optimize", action="store_false",
                     help="Turn off searcher optimization", default=True)

        return p

    def run(self, specclass):
        parser = self._parser(specclass.name)
        options, args = parser.parse_args()
        self.options = options
        self.args = args

        if options.lib not in self.libs:
            raise Exception("Unknown library: %r" % options.lib)
        lib = self.libs[options.lib](self, options, args)

        self.spec = specclass(options, args)

        if options.setup:
            self.spec.setup()

        action = self.search
        if options.index:
            action = self.index
        if options.termfile:
            action = self.search_file
        if options.generate:
            action = self.generate_search_file

        action(lib)
