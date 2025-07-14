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

from whoosh.automata.fst import Arc


class Instruction(object):
    def __repr__(self):
        return "%s()" % (self.__class__.__name__, )


class Char(Instruction):
    """
    Matches a literal character.
    """

    def __init__(self, c):
        self.c = c

    def __repr__(self):
        return "Char(%r)" % self.c

class Lit(Instruction):
    """
    Matches a literal string.
    """

    def __init__(self, c):
        self.c = c

    def __repr__(self):
        return "Lit(%r)" % self.c


class Any(Instruction):
    """
    Matches any character.
    """


class Match(Instruction):
    """
    Stop this thread: the string matched.
    """

    def __repr__(self):
        return "Match()"


class Jmp(Instruction):
    """
    Jump to a specified instruction.
    """

    def __init__(self, x):
        self.x = x

    def __repr__(self):
        return "Jmp(%s)" % self.x


class Split(Instruction):
    """
    Split execution: continue at two separate specified instructions.
    """

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return "Split(%s, %s)" % (self.x, self.y)


class Label(Instruction):
    """
    Placeholder to act as a target for JMP instructions
    """

    def __hash__(self):
        return id(self)

    def __repr__(self):
        return "L(%s)" % hex(id(self))


def concat(e1, e2):
    return e1 + e2


def alt(e1, e2):
    L1, L2, L3 = Label(), Label(), Label()
    return [L1] + e1 + [Jmp(L3), L2] + e2 + [L3]


def zero_or_one(e):
    L1, L2 = Label(), Label()
    return [Split(L1, L2), L1] + e + [L2]


def zero_or_more(e):
    L1, L2, L3 = Label(), Label(), Label()
    return [L1, Split(L2, L3), L2] + e + [Jmp(L1), L3]


def one_or_more(e):
    L1, L2 = Label(), Label()
    return [L1] + e + [Split(L1, L2), L2]


def fixup(program):
    refs = {}
    i = 0
    while i < len(program):
        op = program[i]
        if isinstance(op, Label):
            refs[op] = i
            program.pop(i)
        else:
            i += 1

    if refs:
        for op in program:
            if isinstance(op, (Jmp, Split)):
                op.x = refs[op.x]
            if isinstance(op, Split):
                op.y = refs[op.y]

    return program + [Match]


class ThreadList(object):
    def __init__(self, program, max=1000):
        self.program = program
        self.max = max
        self.threads = []

    def __nonzero__(self):
        return bool(self.threads)

    def current(self):
        return self.threads.pop()

    def add(self, thread):
        op = self.program[thread.pc]
        optype = type(op)
        if optype is Jmp:
            self.add(thread.at(op.x))
        elif optype is Split:
            self.add(thread.copy_at(op.x))
            self.add(thread.at(op.y))
        else:
            self.threads.append(thread)


class Thread(object):
    def __init__(self, pc, address, sofar='', accept=False):
        self.pc = pc
        self.address = address
        self.sofar = sofar
        self.accept = accept

    def at(self, pc):
        self.pc = pc
        return self

    def copy_at(self, pc):
        return Thread(pc, self.address, self.sofar, self.accept)

    def __repr__(self):
        d = self.__dict__
        return "Thread(%s)" % ",".join("%s=%r" % (k, v) for k, v in d.items())


def advance(thread, arc, c):
    thread.pc += 1
    thread.address = arc.target
    thread.sofar += c
    thread.accept = arc.accept


def run(graph, program, address):
    threads = ThreadList(program)
    threads.add(Thread(0, address))
    arc = Arc()
    while threads:
        thread = threads.current()
        address = thread.address
        op = program[thread.pc]
        optype = type(op)

        if optype is Char:
            if address:
                arc = graph.find_arc(address, op.c, arc)
                if arc:
                    advance(thread, arc)
                    threads.add(thread)
        elif optype is Lit:
            if address:
                c = op.c
                arc = graph.find_path(c, arc, address)
                if arc:
                    advance(thread, arc, c)
                    threads.add(thread)
        elif optype is Any:
            if address:
                sofar = thread.sofar
                pc = thread.pc + 1
                for arc in graph.iter_arcs(address, arc):
                    t = Thread(pc, arc.target, sofar + arc.label, arc.accept)
                    threads.add(t)
        elif op is Match:
            if thread.accept:
                yield thread.sofar
        else:
            raise Exception("Don't know what to do with %r" % op)


LO = 0
HI = 1


def regex_limit(graph, mode, program, address):
    low = mode == LO
    output = []
    threads = ThreadList(program)
    threads.add(Thread(0, address))
    arc = Arc()
    while threads:
        thread = threads.current()
        address = thread.address
        op = program[thread.pc]
        optype = type(op)

        if optype is Char:
            if address:
                arc = graph.find_arc(address, op.c, arc)
                if arc:
                    if low and arc.accept:
                        return thread.sofar + thread.label
                    advance(thread, arc)
                    threads.add(thread)
        elif optype is Lit:
            if address:
                labels = op.c
                for label in labels:
                    arc = graph.find_arc(address, label)
                    if arc is None:
                        return thread.sofar
            elif thread.accept:
                return thread.sofar
        elif optype is Any:
            if address:
                if low:
                    arc = graph.arc_at(address, arc)
                else:
                    for arc in graph.iter_arcs(address):
                        pass
                advance(thread, arc, arc.label)
                threads.add(thread)
            elif thread.accept:
                return thread.sofar
        elif op is Match:
            return thread.sofar
        else:
            raise Exception("Don't know what to do with %r" % op)


# if __name__ == "__main__":
#     from whoosh import index, query
#     from whoosh.filedb.filestore import RamStorage
#     from whoosh.automata import fst
#     from whoosh.util.testing import timing
#
#     st = RamStorage()
#     gw = fst.GraphWriter(st.create_file("test"))
#     gw.start_field("test")
#     for key in ["aaaa", "aaab", "aabb", "abbb", "babb", "bbab", "bbba"]:
#         gw.insert(key)
#     gw.close()
#     gr = fst.GraphReader(st.open_file("test"))
#
#     program = one_or_more([Lit("a")])
#     print program
#     program = fixup(program)
#     print program
#     print list(run(gr, program, gr.root("test")))
#
#     ix = index.open_dir("e:/dev/src/houdini/help/index")
#     r = ix.reader()
#     gr = r._get_graph()
#
# #    program = fixup([Any(), Any(), Any(), Any(), Any()])
# #    program = fixup(concat(zero_or_more([Any()]), [Char("/")]))
# #    with timing():
# #        x = list(run(gr, program, gr.root("path")))
# #    print len(x)
#
#     q = query.Regex("path", "^.[abc].*/$")
#     with timing():
#         y = list(q._btexts(r))
#     print len(y)
#     print y[0], y[-1]
#
#     pr = [Any()] + alt([Lit("c")], alt([Lit("b")], [Lit("a")])) + zero_or_more([Any()]) + [Lit("/")]
#     program = fixup(pr)
# #    with timing():
# #        x = list(run(gr, program, gr.root("path")))
# #    print len(x), x
#
#     with timing():
#         print "lo=", regex_limit(gr, LO, program, gr.root("path"))
#         print "hi=", regex_limit(gr, HI, program, gr.root("path"))
#
#
#
# #int
# #backtrackingvm(Inst *prog, char *input)
# #{
# #    enum { MAXTHREAD = 1000 };
# #    Thread ready[MAXTHREAD];
# #    int nready;
# #    Inst *pc;
# #    char *sp;
# #
# #    /* queue initial thread */
# #    ready[0] = thread(prog, input);
# #    nready = 1;
# #
# #    /* run threads in stack order */
# #    while(nready > 0){
# #        --nready;  /* pop state for next thread to run */
# #        pc = ready[nready].pc;
# #        sp = ready[nready].sp;
# #        for(;;){
# #            switch(pc->opcode){
# #            case Char:
# #                if(*sp != pc->c)
# #                    goto Dead;
# #                pc++;
# #                sp++;
# #                continue;
# #            case Match:
# #                return 1;
# #            case Jmp:
# #                pc = pc->x;
# #                continue;
# #            case Split:
# #                if(nready >= MAXTHREAD){
# #                    fprintf(stderr, "regexp overflow");
# #                    return -1;
# #                }
# #                /* queue new thread */
# #                ready[nready++] = thread(pc->y, sp);
# #                pc = pc->x;  /* continue current thread */
# #                continue;
# #            }
# #        }
# #    Dead:;
# #    }
# #    return 0;
# #}
#
#
