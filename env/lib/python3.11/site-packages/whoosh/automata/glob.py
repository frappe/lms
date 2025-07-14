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

from whoosh.automata.fsa import ANY, EPSILON, NFA


# Constants for glob
_LIT = 0
_STAR = 1
_PLUS = 2
_QUEST = 3
_RANGE = 4


def parse_glob(pattern, _glob_multi="*", _glob_single="?",
               _glob_range1="[", _glob_range2="]"):
    pos = 0
    last = None
    while pos < len(pattern):
        char = pattern[pos]
        pos += 1
        if char == _glob_multi:  # *
            # (Ignore more than one star in a row)
            if last is not _STAR:
                yield _STAR, None
                last = _STAR
        elif char == _glob_single:  # ?
            # (Ignore ? after a star)
            if last is not _STAR:
                yield _QUEST, None
                last = _QUEST
        elif char == _glob_range1:  # [
            chars = set()
            negate = False
            # Take the char range specification until the ]
            while pos < len(pattern):
                char = pattern[pos]
                pos += 1
                if char == _glob_range2:
                    break
                chars.add(char)
            if chars:
                yield _RANGE, (chars, negate)
                last = _RANGE
        else:
            yield _LIT, char
            last = _LIT


def glob_automaton(pattern):
    nfa = NFA(0)
    i = -1
    for i, (op, arg) in enumerate(parse_glob(pattern)):
        if op is _LIT:
            nfa.add_transition(i, arg, i + 1)
        elif op is _STAR:
            nfa.add_transition(i, ANY, i + 1)
            nfa.add_transition(i, EPSILON, i + 1)
            nfa.add_transition(i + 1, EPSILON, i)
        elif op is _QUEST:
            nfa.add_transition(i, ANY, i + 1)
        elif op is _RANGE:
            for char in arg[0]:
                nfa.add_transition(i, char, i + 1)
    nfa.add_final_state(i + 1)
    return nfa
