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

from __future__ import with_statement
import os
from multiprocessing import Process, Queue, cpu_count

from whoosh.compat import queue, xrange, iteritems, pickle
from whoosh.codec import base
from whoosh.writing import PostingPool, SegmentWriter
from whoosh.externalsort import imerge
from whoosh.util import random_name


def finish_subsegment(writer, k=64):
    # Tell the pool to finish up the current file
    writer.pool.save()
    # Tell the pool to merge any and all runs in the pool until there
    # is only one run remaining. "k" is an optional parameter passed
    # from the parent which sets the maximum number of files to open
    # while reducing.
    writer.pool.reduce_to(1, k)

    # The filename of the single remaining run
    runname = writer.pool.runs[0]
    # The indexed field names
    fieldnames = writer.pool.fieldnames
    # The segment object (parent can use this to re-open the files created
    # by the sub-writer)
    segment = writer._partial_segment()

    return runname, fieldnames, segment


# Multiprocessing Writer

class SubWriterTask(Process):
    # This is a Process object that takes "jobs" off a job Queue, processes
    # them, and when it's done, puts a summary of its work on a results Queue

    def __init__(self, storage, indexname, jobqueue, resultqueue, kwargs,
                 multisegment):
        Process.__init__(self)
        self.storage = storage
        self.indexname = indexname
        self.jobqueue = jobqueue
        self.resultqueue = resultqueue
        self.kwargs = kwargs
        self.multisegment = multisegment
        self.running = True

    def run(self):
        # This is the main loop of the process. OK, so the way this works is
        # kind of brittle and stupid, but I had to figure out how to use the
        # multiprocessing module, work around bugs, and address performance
        # issues, so there is at least some reasoning behind some of this

        # The "parent" task farms individual documents out to the subtasks for
        # indexing. You could pickle the actual documents and put them in the
        # queue, but that is not very performant. Instead, we assume the tasks
        # share a filesystem and use that to pass the information around. The
        # parent task writes a certain number of documents to a file, then puts
        # the filename on the "job queue". A subtask gets the filename off the
        # queue and reads through the file processing the documents.

        jobqueue = self.jobqueue
        resultqueue = self.resultqueue
        multisegment = self.multisegment

        # Open a placeholder object representing the index
        ix = self.storage.open_index(self.indexname)
        # Open a writer for the index. The _lk=False parameter means to not try
        # to lock the index (the parent object that started me takes care of
        # locking the index)
        writer = self.writer = SegmentWriter(ix, _lk=False, **self.kwargs)

        # If the parent task calls cancel() on me, it will set self.running to
        # False, so I'll notice the next time through the loop
        while self.running:
            # Take an object off the job queue
            jobinfo = jobqueue.get()
            # If the object is None, it means the parent task wants me to
            # finish up
            if jobinfo is None:
                break
            # The object from the queue is a tuple of (filename,
            # number_of_docs_in_file). Pass those two pieces of information as
            # arguments to _process_file().
            self._process_file(*jobinfo)
            # jobqueue.task_done()

        if not self.running:
            # I was cancelled, so I'll cancel my underlying writer
            writer.cancel()
        else:
            if multisegment:
                # Actually finish the segment and return it with no run
                runname = None
                fieldnames = writer.pool.fieldnames
                segment = writer._finalize_segment()
            else:
                # Merge all runs in the writer's pool into one run, close the
                # segment, and return the run name and the segment
                k = self.kwargs.get("k", 64)
                runname, fieldnames, segment = finish_subsegment(writer, k)

            # Put the results (the run filename and the segment object) on the
            # result queue
            resultqueue.put((runname, fieldnames, segment), timeout=5)

    def _process_file(self, filename, doc_count):
        # This method processes a "job file" written out by the parent task. A
        # job file is a series of pickled (code, arguments) tuples. Currently
        # the only command codes is 0=add_document

        writer = self.writer
        tempstorage = writer.temp_storage()

        load = pickle.load
        with tempstorage.open_file(filename).raw_file() as f:
            for _ in xrange(doc_count):
                # Load the next pickled tuple from the file
                code, args = load(f)
                assert code == 0
                writer.add_document(**args)
        # Remove the job file
        tempstorage.delete_file(filename)

    def cancel(self):
        self.running = False


class MpWriter(SegmentWriter):
    def __init__(self, ix, procs=None, batchsize=100, subargs=None,
                 multisegment=False, **kwargs):
        # This is the "main" writer that will aggregate the results created by
        # the sub-tasks
        SegmentWriter.__init__(self, ix, **kwargs)

        self.procs = procs or cpu_count()
        # The maximum number of documents in each job file submitted to the
        # sub-tasks
        self.batchsize = batchsize
        # You can use keyword arguments or the "subargs" argument to pass
        # keyword arguments to the sub-writers
        self.subargs = subargs if subargs else kwargs
        # If multisegment is True, don't merge the segments created by the
        # sub-writers, just add them directly to the TOC
        self.multisegment = multisegment

        # A list to hold the sub-task Process objects
        self.tasks = []
        # A queue to pass the filenames of job files to the sub-tasks
        self.jobqueue = Queue(self.procs * 4)
        # A queue to get back the final results of the sub-tasks
        self.resultqueue = Queue()
        # A buffer for documents before they are flushed to a job file
        self.docbuffer = []

        self._grouping = 0
        self._added_sub = False

    def _new_task(self):
        task = SubWriterTask(self.storage, self.indexname,
                             self.jobqueue, self.resultqueue, self.subargs,
                             self.multisegment)
        self.tasks.append(task)
        task.start()
        return task

    def _enqueue(self):
        # Flush the documents stored in self.docbuffer to a file and put the
        # filename on the job queue
        docbuffer = self.docbuffer
        dump = pickle.dump
        length = len(docbuffer)

        filename = "%s.doclist" % random_name()
        with self.temp_storage().create_file(filename).raw_file() as f:
            for item in docbuffer:
                dump(item, f, 2)

        if len(self.tasks) < self.procs:
            self._new_task()
        jobinfo = (filename, length)
        self.jobqueue.put(jobinfo)
        self.docbuffer = []

    def cancel(self):
        try:
            for task in self.tasks:
                task.cancel()
        finally:
            SegmentWriter.cancel(self)

    def start_group(self):
        self._grouping += 1

    def end_group(self):
        if not self._grouping:
            raise Exception("Unbalanced end_group")
        self._grouping -= 1

    def add_document(self, **fields):
        # Add the document to the docbuffer
        self.docbuffer.append((0, fields))
        # If the buffer is full, flush it to the job queue
        if not self._grouping and len(self.docbuffer) >= self.batchsize:
            self._enqueue()
        self._added_sub = True

    def _read_and_renumber_run(self, path, offset):
        # Note that SortingPool._read_run() automatically deletes the run file
        # when it's finished

        gen = self.pool._read_run(path)
        # If offset is 0, just return the items unchanged
        if not offset:
            return gen
        else:
            # Otherwise, add the offset to each docnum
            return ((fname, text, docnum + offset, weight, value)
                    for fname, text, docnum, weight, value in gen)

    def commit(self, mergetype=None, optimize=None, merge=None):
        if self._added_sub:
            # If documents have been added to sub-writers, use the parallel
            # merge commit code
            self._commit(mergetype, optimize, merge)
        else:
            # Otherwise, just do a regular-old commit
            SegmentWriter.commit(self, mergetype=mergetype, optimize=optimize,
                                 merge=merge)

    def _commit(self, mergetype, optimize, merge):
        # Index the remaining documents in the doc buffer
        if self.docbuffer:
            self._enqueue()
        # Tell the tasks to finish
        for task in self.tasks:
            self.jobqueue.put(None)

        # Merge existing segments
        finalsegments = self._merge_segments(mergetype, optimize, merge)

        # Wait for the subtasks to finish
        for task in self.tasks:
            task.join()

        # Pull a (run_file_name, fieldnames, segment) tuple off the result
        # queue for each sub-task, representing the final results of the task
        results = []
        for _ in self.tasks:
            try:
                results.append(self.resultqueue.get(timeout=1))
            except queue.Empty:
                pass

        if self.multisegment:
            # If we're not merging the segments, we don't care about the runname
            # and fieldnames in the results... just pull out the segments and
            # add them to the list of final segments
            finalsegments += [s for _, _, s in results]
            if self._added:
                finalsegments.append(self._finalize_segment())
            else:
                self._close_segment()
            assert self.perdocwriter.is_closed
        else:
            # Merge the posting sources from the sub-writers and my
            # postings into this writer
            self._merge_subsegments(results, mergetype)
            self._close_segment()
            self._assemble_segment()
            finalsegments.append(self.get_segment())
            assert self.perdocwriter.is_closed

        self._commit_toc(finalsegments)
        self._finish()

    def _merge_subsegments(self, results, mergetype):
        schema = self.schema
        schemanames = set(schema.names())
        storage = self.storage
        codec = self.codec
        sources = []

        # If information was added to this writer the conventional (e.g.
        # through add_reader or merging segments), add it as an extra source
        if self._added:
            sources.append(self.pool.iter_postings())

        pdrs = []
        for runname, fieldnames, segment in results:
            fieldnames = set(fieldnames) | schemanames
            pdr = codec.per_document_reader(storage, segment)
            pdrs.append(pdr)
            basedoc = self.docnum
            docmap = self.write_per_doc(fieldnames, pdr)
            assert docmap is None

            items = self._read_and_renumber_run(runname, basedoc)
            sources.append(items)

        # Create a MultiLengths object combining the length files from the
        # subtask segments
        self.perdocwriter.close()
        pdrs.insert(0, self.per_document_reader())
        mpdr = base.MultiPerDocumentReader(pdrs)

        try:
            # Merge the iterators into the field writer
            self.fieldwriter.add_postings(schema, mpdr, imerge(sources))
        finally:
            mpdr.close()
        self._added = True


class SerialMpWriter(MpWriter):
    # A non-parallel version of the MpWriter for testing purposes

    def __init__(self, ix, procs=None, batchsize=100, subargs=None, **kwargs):
        SegmentWriter.__init__(self, ix, **kwargs)

        self.procs = procs or cpu_count()
        self.batchsize = batchsize
        self.subargs = subargs if subargs else kwargs
        self.tasks = [SegmentWriter(ix, _lk=False, **self.subargs)
                      for _ in xrange(self.procs)]
        self.pointer = 0
        self._added_sub = False

    def add_document(self, **fields):
        self.tasks[self.pointer].add_document(**fields)
        self.pointer = (self.pointer + 1) % len(self.tasks)
        self._added_sub = True

    def _commit(self, mergetype, optimize, merge):
        # Pull a (run_file_name, segment) tuple off the result queue for each
        # sub-task, representing the final results of the task

        # Merge existing segments
        finalsegments = self._merge_segments(mergetype, optimize, merge)
        results = []
        for writer in self.tasks:
            results.append(finish_subsegment(writer))

        self._merge_subsegments(results, mergetype)
        self._close_segment()
        self._assemble_segment()
        finalsegments.append(self.get_segment())

        self._commit_toc(finalsegments)
        self._finish()


# For compatibility with old multiproc module
class MultiSegmentWriter(MpWriter):
    def __init__(self, *args, **kwargs):
        MpWriter.__init__(self, *args, **kwargs)
        self.multisegment = True
