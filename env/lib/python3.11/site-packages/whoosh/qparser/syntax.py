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

import sys, weakref

from whoosh import query
from whoosh.qparser.common import get_single_text, QueryParserError, attach


class SyntaxNode(object):
    """Base class for nodes that make up the abstract syntax tree (AST) of a
    parsed user query string. The AST is an intermediate step, generated
    from the query string, then converted into a :class:`whoosh.query.Query`
    tree by calling the ``query()`` method on the nodes.

    Instances have the following required attributes:

    ``has_fieldname``
        True if this node has a ``fieldname`` attribute.
    ``has_text``
        True if this node has a ``text`` attribute
    ``has_boost``
        True if this node has a ``boost`` attribute.
    ``startchar``
        The character position in the original text at which this node started.
    ``endchar``
        The character position in the original text at which this node ended.
    """

    has_fieldname = False
    has_text = False
    has_boost = False
    _parent = None

    def __repr__(self):
        r = "<"
        if self.has_fieldname:
            r += "%r:" % self.fieldname
        r += self.r()
        if self.has_boost and self.boost != 1.0:
            r += " ^%s" % self.boost
        r += ">"
        return r

    def r(self):
        """Returns a basic representation of this node. The base class's
        ``__repr__`` method calls this, then does the extra busy work of adding
        fieldname and boost where appropriate.
        """

        return "%s %r" % (self.__class__.__name__, self.__dict__)

    def apply(self, fn):
        return self

    def accept(self, fn):
        def fn_wrapper(n):
            return fn(n.apply(fn_wrapper))

        return fn_wrapper(self)

    def query(self, parser):
        """Returns a :class:`whoosh.query.Query` instance corresponding to this
        syntax tree node.
        """

        raise NotImplementedError(self.__class__.__name__)

    def is_ws(self):
        """Returns True if this node is ignorable whitespace.
        """

        return False

    def is_text(self):
        return False

    def set_fieldname(self, name, override=False):
        """Sets the fieldname associated with this node. If ``override`` is
        False (the default), the fieldname will only be replaced if this node
        does not already have a fieldname set.

        For nodes that don't have a fieldname, this is a no-op.
        """

        if not self.has_fieldname:
            return

        if self.fieldname is None or override:
            self.fieldname = name
        return self

    def set_boost(self, boost):
        """Sets the boost associated with this node.

        For nodes that don't have a boost, this is a no-op.
        """

        if not self.has_boost:
            return
        self.boost = boost
        return self

    def set_range(self, startchar, endchar):
        """Sets the character range associated with this node.
        """

        self.startchar = startchar
        self.endchar = endchar
        return self

    # Navigation methods

    def parent(self):
        if self._parent:
            return self._parent()

    def next_sibling(self):
        p = self.parent()
        if p:
            return p.node_after(self)

    def prev_sibling(self):
        p = self.parent()
        if p:
            return p.node_before(self)

    def bake(self, parent):
        self._parent = weakref.ref(parent)


class MarkerNode(SyntaxNode):
    """Base class for nodes that only exist to mark places in the tree.
    """

    def r(self):
        return self.__class__.__name__


class Whitespace(MarkerNode):
    """Abstract syntax tree node for ignorable whitespace.
    """

    def r(self):
        return " "

    def is_ws(self):
        return True


class FieldnameNode(SyntaxNode):
    """Abstract syntax tree node for field name assignments.
    """

    has_fieldname = True

    def __init__(self, fieldname, original):
        self.fieldname = fieldname
        self.original = original

    def __repr__(self):
        return "<%r:>" % self.fieldname


class GroupNode(SyntaxNode):
    """Base class for abstract syntax tree node types that group together
    sub-nodes.

    Instances have the following attributes:

    ``merging``
        True if side-by-side instances of this group can be merged into a
        single group.
    ``qclass``
        If a subclass doesn't override ``query()``, the base class will simply
        wrap this class around the queries returned by the subnodes.

    This class implements a number of list methods for operating on the
    subnodes.
    """

    has_boost = True
    merging = True
    qclass = None

    def __init__(self, nodes=None, boost=1.0, **kwargs):
        self.nodes = nodes or []
        self.boost = boost
        self.kwargs = kwargs

    def r(self):
        return "%s %s" % (self.__class__.__name__,
                          ", ".join(repr(n) for n in self.nodes))

    @property
    def startchar(self):
        if not self.nodes:
            return None
        return self.nodes[0].startchar

    @property
    def endchar(self):
        if not self.nodes:
            return None
        return self.nodes[-1].endchar

    def apply(self, fn):
        return self.__class__(self.type, [fn(node) for node in self.nodes],
                              boost=self.boost, **self.kwargs)

    def query(self, parser):
        subs = []
        for node in self.nodes:
            subq = node.query(parser)
            if subq is not None:
                subs.append(subq)

        q = self.qclass(subs, boost=self.boost, **self.kwargs)
        return attach(q, self)

    def empty_copy(self):
        """Returns an empty copy of this group.

        This is used in the common pattern where a filter creates an new
        group and then adds nodes from the input group to it if they meet
        certain criteria, then returns the new group::

            def remove_whitespace(parser, group):
                newgroup = group.empty_copy()
                for node in group:
                    if not node.is_ws():
                        newgroup.append(node)
                return newgroup
        """

        c = self.__class__(**self.kwargs)
        if self.has_boost:
            c.boost = self.boost
        if self.has_fieldname:
            c.fieldname = self.fieldname
        if self.has_text:
            c.text = self.text
        return c

    def set_fieldname(self, name, override=False):
        SyntaxNode.set_fieldname(self, name, override=override)
        for node in self.nodes:
            node.set_fieldname(name, override=override)

    def set_range(self, startchar, endchar):
        for node in self.nodes:
            node.set_range(startchar, endchar)
        return self

    # List-like methods

    def __nonzero__(self):
        return bool(self.nodes)

    __bool__ = __nonzero__

    def __iter__(self):
        return iter(self.nodes)

    def __len__(self):
        return len(self.nodes)

    def __getitem__(self, n):
        return self.nodes.__getitem__(n)

    def __setitem__(self, n, v):
        self.nodes.__setitem__(n, v)

    def __delitem__(self, n):
        self.nodes.__delitem__(n)

    def insert(self, n, v):
        self.nodes.insert(n, v)

    def append(self, v):
        self.nodes.append(v)

    def extend(self, vs):
        self.nodes.extend(vs)

    def pop(self, *args, **kwargs):
        return self.nodes.pop(*args, **kwargs)

    def reverse(self):
        self.nodes.reverse()

    def index(self, v):
        return self.nodes.index(v)

    # Navigation methods

    def bake(self, parent):
        SyntaxNode.bake(self, parent)
        for node in self.nodes:
            node.bake(self)

    def node_before(self, n):
        try:
            i = self.nodes.index(n)
        except ValueError:
            return
        if i > 0:
            return self.nodes[i - 1]

    def node_after(self, n):
        try:
            i = self.nodes.index(n)
        except ValueError:
            return
        if i < len(self.nodes) - 2:
            return self.nodes[i + 1]


class BinaryGroup(GroupNode):
    """Intermediate base class for group nodes that have two subnodes and
    whose ``qclass`` initializer takes two arguments instead of a list.
    """

    merging = False
    has_boost = False

    def query(self, parser):
        assert len(self.nodes) == 2

        qa = self.nodes[0].query(parser)
        qb = self.nodes[1].query(parser)
        if qa is None and qb is None:
            q = query.NullQuery
        elif qa is None:
            q = qb
        elif qb is None:
            q = qa
        else:
            q = self.qclass(self.nodes[0].query(parser),
                            self.nodes[1].query(parser))

        return attach(q, self)


class Wrapper(GroupNode):
    """Intermediate base class for nodes that wrap a single sub-node.
    """

    merging = False

    def query(self, parser):
        q = self.nodes[0].query(parser)
        if q:
            return attach(self.qclass(q), self)


class ErrorNode(SyntaxNode):
    def __init__(self, message, node=None):
        self.message = message
        self.node = node

    def r(self):
        return "ERR %r %r" % (self.node, self.message)

    @property
    def startchar(self):
        return self.node.startchar

    @property
    def endchar(self):
        return self.node.endchar

    def query(self, parser):
        if self.node:
            q = self.node.query(parser)
        else:
            q = query.NullQuery

        return attach(query.error_query(self.message, q), self)


class AndGroup(GroupNode):
    qclass = query.And


class OrGroup(GroupNode):
    qclass = query.Or

    @classmethod
    def factory(cls, scale=1.0):
        class ScaledOrGroup(OrGroup):
            def __init__(self, nodes=None, **kwargs):
                if "scale" in kwargs:
                    del kwargs["scale"]
                super(ScaledOrGroup, self).__init__(nodes=nodes, scale=scale,
                                                    **kwargs)
        return ScaledOrGroup


class DisMaxGroup(GroupNode):
    qclass = query.DisjunctionMax


class OrderedGroup(GroupNode):
    qclass = query.Ordered


class AndNotGroup(BinaryGroup):
    qclass = query.AndNot


class AndMaybeGroup(BinaryGroup):
    qclass = query.AndMaybe


class RequireGroup(BinaryGroup):
    qclass = query.Require


class NotGroup(Wrapper):
    qclass = query.Not


class RangeNode(SyntaxNode):
    """Syntax node for range queries.
    """

    has_fieldname = True

    def __init__(self, start, end, startexcl, endexcl):
        self.start = start
        self.end = end
        self.startexcl = startexcl
        self.endexcl = endexcl
        self.boost = 1.0
        self.fieldname = None
        self.kwargs = {}

    def r(self):
        b1 = "{" if self.startexcl else "["
        b2 = "}" if self.endexcl else "]"
        return "%s%r %r%s" % (b1, self.start, self.end, b2)

    def query(self, parser):
        fieldname = self.fieldname or parser.fieldname
        start = self.start
        end = self.end

        if parser.schema and fieldname in parser.schema:
            field = parser.schema[fieldname]
            if field.self_parsing():
                try:
                    q = field.parse_range(fieldname, start, end,
                                          self.startexcl, self.endexcl,
                                          boost=self.boost)
                    if q is not None:
                        return attach(q, self)
                except QueryParserError:
                    e = sys.exc_info()[1]
                    return attach(query.error_query(e), self)

            if start:
                start = get_single_text(field, start, tokenize=False,
                                        removestops=False)
            if end:
                end = get_single_text(field, end, tokenize=False,
                                      removestops=False)

        q = query.TermRange(fieldname, start, end, self.startexcl,
                            self.endexcl, boost=self.boost)
        return attach(q, self)


class TextNode(SyntaxNode):
    """Intermediate base class for basic nodes that search for text, such as
    term queries, wildcards, prefixes, etc.

    Instances have the following attributes:

    ``qclass``
        If a subclass does not override ``query()``, the base class will use
        this class to construct the query.
    ``tokenize``
        If True and the subclass does not override ``query()``, the node's text
        will be tokenized before constructing the query
    ``removestops``
        If True and the subclass does not override ``query()``, and the field's
        analyzer has a stop word filter, stop words will be removed from the
        text before constructing the query.
    """

    has_fieldname = True
    has_text = True
    has_boost = True
    qclass = None
    tokenize = False
    removestops = False

    def __init__(self, text):
        self.fieldname = None
        self.text = text
        self.boost = 1.0

    def r(self):
        return "%s %r" % (self.__class__.__name__, self.text)

    def is_text(self):
        return True

    def query(self, parser):
        fieldname = self.fieldname or parser.fieldname
        termclass = self.qclass or parser.termclass
        q = parser.term_query(fieldname, self.text, termclass,
                              boost=self.boost, tokenize=self.tokenize,
                              removestops=self.removestops)
        return attach(q, self)


class WordNode(TextNode):
    """Syntax node for term queries.
    """

    tokenize = True
    removestops = True

    def r(self):
        return repr(self.text)


# Operators

class Operator(SyntaxNode):
    """Base class for PrefixOperator, PostfixOperator, and InfixOperator.

    Operators work by moving the nodes they apply to (e.g. for prefix operator,
    the previous node, for infix operator, the nodes on either side, etc.) into
    a group node. The group provides the code for what to do with the nodes.
    """

    def __init__(self, text, grouptype, leftassoc=True):
        """
        :param text: the text of the operator in the query string.
        :param grouptype: the type of group to create in place of the operator
            and the node(s) it operates on.
        :param leftassoc: for infix opeators, whether the operator is left
            associative. use ``leftassoc=False`` for right-associative infix
            operators.
        """

        self.text = text
        self.grouptype = grouptype
        self.leftassoc = leftassoc

    def r(self):
        return "OP %r" % self.text

    def replace_self(self, parser, group, position):
        """Called with the parser, a group, and the position at which the
        operator occurs in that group. Should return a group with the operator
        replaced by whatever effect the operator has (e.g. for an infix op,
        replace the op and the nodes on either side with a sub-group).
        """

        raise NotImplementedError


class PrefixOperator(Operator):
    def replace_self(self, parser, group, position):
        length = len(group)
        del group[position]
        if position < length - 1:
            group[position] = self.grouptype([group[position]])
        return position


class PostfixOperator(Operator):
    def replace_self(self, parser, group, position):
        del group[position]
        if position > 0:
            group[position - 1] = self.grouptype([group[position - 1]])
        return position


class InfixOperator(Operator):
    def replace_self(self, parser, group, position):
        la = self.leftassoc
        gtype = self.grouptype
        merging = gtype.merging

        if position > 0 and position < len(group) - 1:
            left = group[position - 1]
            right = group[position + 1]

            # The first two clauses check whether the "strong" side is already
            # a group of the type we are going to create. If it is, we just
            # append the "weak" side to the "strong" side instead of creating
            # a new group inside the existing one. This is necessary because
            # we can quickly run into Python's recursion limit otherwise.
            if merging and la and isinstance(left, gtype):
                left.append(right)
                del group[position:position + 2]
            elif merging and not la and isinstance(right, gtype):
                right.insert(0, left)
                del group[position - 1:position + 1]
                return position - 1
            else:
                # Replace the operator and the two surrounding objects
                group[position - 1:position + 2] = [gtype([left, right])]
        else:
            del group[position]

        return position


# Functions

def to_word(n):
    node = WordNode(n.original)
    node.startchar = n.startchar
    node.endchar = n.endchar
    return node
