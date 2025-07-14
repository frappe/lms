from __future__ import print_function

import itertools
import operator
import sys
from bisect import bisect_left
from collections import defaultdict

from whoosh.compat import iteritems, next, text_type, unichr, xrange


unull = unichr(0)


# Marker constants

class Marker(object):
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return "<%s>" % self.name


EPSILON = Marker("EPSILON")
ANY = Marker("ANY")


# Base class

class FSA(object):
    def __init__(self, initial):
        self.initial = initial
        self.transitions = {}
        self.final_states = set()

    def __len__(self):
        return len(self.all_states())

    def __eq__(self, other):
        if self.initial != other.initial:
            return False
        if self.final_states != other.final_states:
            return False
        st = self.transitions
        ot = other.transitions
        if list(st) != list(ot):
            return False
        for key in st:
            if st[key] != ot[key]:
                return False
        return True

    def all_states(self):
        stateset = set(self.transitions)
        for src, trans in iteritems(self.transitions):
            stateset.update(trans.values())
        return stateset

    def all_labels(self):
        labels = set()
        for src, trans in iteritems(self.transitions):
            labels.update(trans)
        return labels

    def get_labels(self, src):
        return iter(self.transitions.get(src, []))

    def generate_all(self, state=None, sofar=""):
        state = self.start() if state is None else state
        if self.is_final(state):
            yield sofar
        for label in sorted(self.get_labels(state)):
            newstate = self.next_state(state, label)
            for string in self.generate_all(newstate, sofar + label):
                yield string

    def start(self):
        return self.initial

    def next_state(self, state, label):
        raise NotImplementedError

    def is_final(self, state):
        raise NotImplementedError

    def add_transition(self, src, label, dest):
        raise NotImplementedError

    def add_final_state(self, state):
        raise NotImplementedError

    def to_dfa(self):
        raise NotImplementedError

    def accept(self, string, debug=False):
        state = self.start()

        for label in string:
            if debug:
                print("  ", state, "->", label, "->")

            state = self.next_state(state, label)
            if not state:
                break

        return self.is_final(state)

    def append(self, fsa):
        self.transitions.update(fsa.transitions)
        for state in self.final_states:
            self.add_transition(state, EPSILON, fsa.initial)
        self.final_states = fsa.final_states


# Implementations

class NFA(FSA):
    def __init__(self, initial):
        self.transitions = {}
        self.final_states = set()
        self.initial = initial

    def dump(self, stream=sys.stdout):
        starts = self.start()
        for src in self.transitions:
            beg = "@" if src in starts else " "
            print(beg, src, file=stream)
            xs = self.transitions[src]
            for label in xs:
                dests = xs[label]
                end = "||" if self.is_final(dests) else ""

    def start(self):
        return frozenset(self._expand(set([self.initial])))

    def add_transition(self, src, label, dest):
        self.transitions.setdefault(src, {}).setdefault(label, set()).add(dest)

    def add_final_state(self, state):
        self.final_states.add(state)

    def triples(self):
        for src, trans in iteritems(self.transitions):
            for label, dests in iteritems(trans):
                for dest in dests:
                    yield src, label, dest

    def is_final(self, states):
        return bool(self.final_states.intersection(states))

    def _expand(self, states):
        transitions = self.transitions
        frontier = set(states)
        while frontier:
            state = frontier.pop()
            if state in transitions and EPSILON in transitions[state]:
                new_states = transitions[state][EPSILON].difference(states)
                frontier.update(new_states)
                states.update(new_states)
        return states

    def next_state(self, states, label):
        transitions = self.transitions
        dest_states = set()
        for state in states:
            if state in transitions:
                xs = transitions[state]
                if label in xs:
                    dest_states.update(xs[label])
                if ANY in xs:
                    dest_states.update(xs[ANY])
        return frozenset(self._expand(dest_states))

    def get_labels(self, states):
        transitions = self.transitions
        labels = set()
        for state in states:
            if state in transitions:
                labels.update(transitions[state])
        return labels

    def embed(self, other):
        # Copy all transitions from the other NFA into this one
        for s, othertrans in iteritems(other.transitions):
            trans = self.transitions.setdefault(s, {})
            for label, otherdests in iteritems(othertrans):
                dests = trans.setdefault(label, set())
                dests.update(otherdests)

    def insert(self, src, other, dest):
        self.embed(other)

        # Connect src to the other NFA's initial state, and the other
        # NFA's final states to dest
        self.add_transition(src, EPSILON, other.initial)
        for finalstate in other.final_states:
            self.add_transition(finalstate, EPSILON, dest)

    def to_dfa(self):
        dfa = DFA(self.start())
        frontier = [self.start()]
        seen = set()
        while frontier:
            current = frontier.pop()
            if self.is_final(current):
                dfa.add_final_state(current)
            labels = self.get_labels(current)
            for label in labels:
                if label is EPSILON:
                    continue
                new_state = self.next_state(current, label)
                if new_state not in seen:
                    frontier.append(new_state)
                    seen.add(new_state)
                    if self.is_final(new_state):
                        dfa.add_final_state(new_state)
                if label is ANY:
                    dfa.set_default_transition(current, new_state)
                else:
                    dfa.add_transition(current, label, new_state)
        return dfa


class DFA(FSA):
    def __init__(self, initial):
        self.initial = initial
        self.transitions = {}
        self.defaults = {}
        self.final_states = set()
        self.outlabels = {}

    def dump(self, stream=sys.stdout):
        for src in sorted(self.transitions):
            beg = "@" if src == self.initial else " "
            print(beg, src, file=stream)
            xs = self.transitions[src]
            for label in sorted(xs):
                dest = xs[label]
                end = "||" if self.is_final(dest) else ""

    def start(self):
        return self.initial

    def add_transition(self, src, label, dest):
        self.transitions.setdefault(src, {})[label] = dest

    def set_default_transition(self, src, dest):
        self.defaults[src] = dest

    def add_final_state(self, state):
        self.final_states.add(state)

    def is_final(self, state):
        return state in self.final_states

    def next_state(self, src, label):
        trans = self.transitions.get(src, {})
        return trans.get(label, self.defaults.get(src, None))

    def next_valid_string(self, string, asbytes=False):
        state = self.start()
        stack = []

        # Follow the DFA as far as possible
        i = 0
        for i, label in enumerate(string):
            stack.append((string[:i], state, label))
            state = self.next_state(state, label)
            if not state:
                break
        else:
            stack.append((string[:i + 1], state, None))

        if self.is_final(state):
            # Word is already valid
            return string

        # Perform a 'wall following' search for the lexicographically smallest
        # accepting state.
        while stack:
            path, state, label = stack.pop()
            label = self.find_next_edge(state, label, asbytes=asbytes)
            if label:
                path += label
                state = self.next_state(state, label)
                if self.is_final(state):
                    return path
                stack.append((path, state, None))
        return None

    def find_next_edge(self, s, label, asbytes):
        if label is None:
            label = b"\x00" if asbytes else u'\0'
        else:
            label = (label + 1) if asbytes else unichr(ord(label) + 1)
        trans = self.transitions.get(s, {})
        if label in trans or s in self.defaults:
            return label

        try:
            labels = self.outlabels[s]
        except KeyError:
            self.outlabels[s] = labels = sorted(trans)

        pos = bisect_left(labels, label)
        if pos < len(labels):
            return labels[pos]
        return None

    def reachable_from(self, src, inclusive=True):
        transitions = self.transitions

        reached = set()
        if inclusive:
            reached.add(src)

        stack = [src]
        seen = set()
        while stack:
            src = stack.pop()
            seen.add(src)
            for _, dest in iteritems(transitions[src]):
                reached.add(dest)
                if dest not in seen:
                    stack.append(dest)
        return reached

    def minimize(self):
        transitions = self.transitions
        initial = self.initial

        # Step 1: Delete unreachable states
        reachable = self.reachable_from(initial)
        for src in list(transitions):
            if src not in reachable:
                del transitions[src]
        final_states = self.final_states.intersection(reachable)
        labels = self.all_labels()

        # Step 2: Partition the states into equivalence sets
        changed = True
        parts = [final_states, reachable - final_states]
        while changed:
            changed = False
            for i in xrange(len(parts)):
                part = parts[i]
                changed_part = False
                for label in labels:
                    next_part = None
                    new_part = set()
                    for state in part:
                        dest = transitions[state].get(label)
                        if dest is not None:
                            if next_part is None:
                                for p in parts:
                                    if dest in p:
                                        next_part = p
                            elif dest not in next_part:
                                new_part.add(state)
                                changed = True
                                changed_part = True
                    if changed_part:
                        old_part = part - new_part
                        parts.pop(i)
                        parts.append(old_part)
                        parts.append(new_part)
                        break

        # Choose one state from each equivalence set and map all equivalent
        # states to it
        new_trans = {}

        # Create mapping
        mapping = {}
        new_initial = None
        for part in parts:
            representative = part.pop()
            if representative is initial:
                new_initial = representative
            mapping[representative] = representative
            new_trans[representative] = {}
            for state in part:
                if state is initial:
                    new_initial = representative
                mapping[state] = representative
        assert new_initial is not None

        # Apply mapping to existing transitions
        new_finals = set(mapping[s] for s in final_states)
        for state, d in iteritems(new_trans):
            trans = transitions[state]
            for label, dest in iteritems(trans):
                d[label] = mapping[dest]

        # Remove dead states - non-final states with no outgoing arcs except
        # to themselves
        non_final_srcs = [src for src in new_trans if src not in new_finals]
        removing = set()
        for src in non_final_srcs:
            dests = set(new_trans[src].values())
            dests.discard(src)
            if not dests:
                removing.add(src)
                del new_trans[src]
        # Delete transitions to removed dead states
        for t in new_trans.values():
            for label in list(t):
                if t[label] in removing:
                    del t[label]

        self.transitions = new_trans
        self.initial = new_initial
        self.final_states = new_finals

    def to_dfa(self):
        return self


# Useful functions

def renumber_dfa(dfa, base=0):
    c = itertools.count(base)
    mapping = {}

    def remap(state):
        if state in mapping:
            newnum = mapping[state]
        else:
            newnum = next(c)
            mapping[state] = newnum
        return newnum

    newdfa = DFA(remap(dfa.initial))
    for src, trans in iteritems(dfa.transitions):
        for label, dest in iteritems(trans):
            newdfa.add_transition(remap(src), label, remap(dest))
    for finalstate in dfa.final_states:
        newdfa.add_final_state(remap(finalstate))
    for src, dest in iteritems(dfa.defaults):
        newdfa.set_default_transition(remap(src), remap(dest))
    return newdfa


def u_to_utf8(dfa, base=0):
    c = itertools.count(base)
    transitions = dfa.transitions

    for src, trans in iteritems(transitions):
        trans = transitions[src]
        for label, dest in list(iteritems(trans)):
            if label is EPSILON:
                continue
            elif label is ANY:
                raise Exception
            else:
                assert isinstance(label, text_type)
                label8 = label.encode("utf8")
                for i, byte in enumerate(label8):
                    if i < len(label8) - 1:
                        st = next(c)
                        dfa.add_transition(src, byte, st)
                        src = st
                    else:
                        dfa.add_transition(src, byte, dest)
                del trans[label]


def find_all_matches(dfa, lookup_func, first=unull):
    """
    Uses lookup_func to find all words within levenshtein distance k of word.

    Args:
      word: The word to look up
      k: Maximum edit distance
      lookup_func: A single argument function that returns the first word in the
        database that is greater than or equal to the input argument.
    Yields:
      Every matching word within levenshtein distance k from the database.
    """

    match = dfa.next_valid_string(first)
    while match:
        key = lookup_func(match)
        if key is None:
            return
        if match == key:
            yield match
            key += unull
        match = dfa.next_valid_string(key)


# Construction functions

def reverse_nfa(n):
    s = object()
    nfa = NFA(s)
    for src, trans in iteritems(n.transitions):
        for label, destset in iteritems(trans):
            for dest in destset:
                nfa.add_transition(dest, label, src)
    for finalstate in n.final_states:
        nfa.add_transition(s, EPSILON, finalstate)
    nfa.add_final_state(n.initial)
    return nfa


def product(dfa1, op, dfa2):
    dfa1 = dfa1.to_dfa()
    dfa2 = dfa2.to_dfa()
    start = (dfa1.start(), dfa2.start())
    dfa = DFA(start)
    stack = [start]
    while stack:
        src = stack.pop()
        state1, state2 = src
        trans1 = set(dfa1.transitions[state1])
        trans2 = set(dfa2.transitions[state2])
        for label in trans1.intersection(trans2):
            state1 = dfa1.next_state(state1, label)
            state2 = dfa2.next_state(state2, label)
            if op(state1 is not None, state2 is not None):
                dest = (state1, state2)
                dfa.add_transition(src, label, dest)
                stack.append(dest)
                if op(dfa1.is_final(state1), dfa2.is_final(state2)):
                    dfa.add_final_state(dest)
    return dfa


def intersection(dfa1, dfa2):
    return product(dfa1, operator.and_, dfa2)


def union(dfa1, dfa2):
    return product(dfa1, operator.or_, dfa2)


def epsilon_nfa():
    return basic_nfa(EPSILON)


def dot_nfa():
    return basic_nfa(ANY)


def basic_nfa(label):
    s = object()
    e = object()
    nfa = NFA(s)
    nfa.add_transition(s, label, e)
    nfa.add_final_state(e)
    return nfa


def charset_nfa(labels):
    s = object()
    e = object()
    nfa = NFA(s)
    for label in labels:
        nfa.add_transition(s, label, e)
    nfa.add_final_state(e)
    return nfa


def string_nfa(string):
    s = object()
    e = object()
    nfa = NFA(s)
    for label in string:
        e = object()
        nfa.add_transition(s, label, e)
        s = e
    nfa.add_final_state(e)
    return nfa


def choice_nfa(n1, n2):
    s = object()
    e = object()
    nfa = NFA(s)
    #   -> nfa1 -
    #  /         \
    # s           e
    #  \         /
    #   -> nfa2 -
    nfa.insert(s, n1, e)
    nfa.insert(s, n2, e)
    nfa.add_final_state(e)
    return nfa


def concat_nfa(n1, n2):
    s = object()
    m = object()
    e = object()
    nfa = NFA(s)
    nfa.insert(s, n1, m)
    nfa.insert(m, n2, e)
    nfa.add_final_state(e)
    return nfa


def star_nfa(n):
    s = object()
    e = object()
    nfa = NFA(s)
    #   -----<-----
    #  /           \
    # s ---> n ---> e
    #  \           /
    #   ----->-----

    nfa.insert(s, n, e)
    nfa.add_transition(s, EPSILON, e)
    for finalstate in n.final_states:
        nfa.add_transition(finalstate, EPSILON, s)
    nfa.add_final_state(e)
    return nfa


def plus_nfa(n):
    return concat_nfa(n, star_nfa(n))


def optional_nfa(n):
    return choice_nfa(n, epsilon_nfa())


# Daciuk Mihov DFA construction algorithm

class DMNode(object):
    def __init__(self, n):
        self.n = n
        self.arcs = {}
        self.final = False

    def __repr__(self):
        return "<%s, %r>" % (self.n, self.tuple())

    def __hash__(self):
        return hash(self.tuple())

    def tuple(self):
        arcs = tuple(sorted(iteritems(self.arcs)))
        return arcs, self.final


def strings_dfa(strings):
    dfa = DFA(0)
    c = itertools.count(1)

    last = ""
    seen = {}
    nodes = [DMNode(0)]

    for string in strings:
        if string <= last:
            raise Exception("Strings must be in order")
        if not string:
            raise Exception("Can't add empty string")

        # Find the common prefix with the previous string
        i = 0
        while i < len(last) and i < len(string) and last[i] == string[i]:
            i += 1
        prefixlen = i

        # Freeze the transitions after the prefix, since they're not shared
        add_suffix(dfa, nodes, last, prefixlen + 1, seen)

        # Create new nodes for the substring after the prefix
        for label in string[prefixlen:]:
            node = DMNode(next(c))
            # Create an arc from the previous node to this node
            nodes[-1].arcs[label] = node.n
            nodes.append(node)
        # Mark the last node as an accept state
        nodes[-1].final = True

        last = string

    if len(nodes) > 1:
        add_suffix(dfa, nodes, last, 0, seen)
    return dfa


def add_suffix(dfa, nodes, last, downto, seen):
    while len(nodes) > downto:
        node = nodes.pop()
        tup = node.tuple()

        # If a node just like this one (final/nonfinal, same arcs to same
        # destinations) is already seen, replace with it
        try:
            this = seen[tup]
        except KeyError:
            this = node.n
            if node.final:
                dfa.add_final_state(this)
            seen[tup] = this
        else:
            # If we replaced the node with an already seen one, fix the parent
            # node's pointer to this
            parent = nodes[-1]
            inlabel = last[len(nodes) - 1]
            parent.arcs[inlabel] = this

        # Add the node's transitions to the DFA
        for label, dest in iteritems(node.arcs):
            dfa.add_transition(this, label, dest)




