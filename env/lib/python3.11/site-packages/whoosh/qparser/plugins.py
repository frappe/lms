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

import copy

from whoosh import query
from whoosh.compat import u
from whoosh.compat import iteritems, xrange
from whoosh.qparser import syntax
from whoosh.qparser.common import attach
from whoosh.qparser.taggers import RegexTagger, FnTagger
from whoosh.util.text import rcompile


class Plugin(object):
    """Base class for parser plugins.
    """

    def taggers(self, parser):
        """Should return a list of ``(Tagger, priority)`` tuples to add to the
        syntax the parser understands. Lower priorities run first.
        """

        return ()

    def filters(self, parser):
        """Should return a list of ``(filter_function, priority)`` tuples to
        add to parser. Lower priority numbers run first.

        Filter functions will be called with ``(parser, groupnode)`` and should
        return a group node.
        """

        return ()


class TaggingPlugin(RegexTagger):
    """A plugin that also acts as a Tagger, to avoid having an extra Tagger
    class for simple cases.

    A TaggingPlugin object should have a ``priority`` attribute and either a
    ``nodetype`` attribute or a ``create()`` method. If the subclass doesn't
    override ``create()``, the base class will call ``self.nodetype`` with the
    Match object's named groups as keyword arguments.
    """

    priority = 0

    def __init__(self, expr=None):
        self.expr = rcompile(expr or self.expr)

    def taggers(self, parser):
        return [(self, self.priority)]

    def filters(self, parser):
        return ()

    def create(self, parser, match):
        # Groupdict keys can be unicode sometimes apparently? Convert them to
        # str for use as keyword arguments. This should be Py3-safe.
        kwargs = dict((str(k), v) for k, v in iteritems(match.groupdict()))
        return self.nodetype(**kwargs)


class WhitespacePlugin(TaggingPlugin):
    """Tags whitespace and removes it at priority 500. Depending on whether
    your plugin's filter wants to see where whitespace was in the original
    query, it should run with priority lower than 500 (before removal of
    whitespace) or higher than 500 (after removal of whitespace).
    """

    nodetype = syntax.Whitespace
    priority = 100

    def __init__(self, expr=r"\s+"):
        TaggingPlugin.__init__(self, expr)

    def filters(self, parser):
        return [(self.remove_whitespace, 500)]

    def remove_whitespace(self, parser, group):
        newgroup = group.empty_copy()
        for node in group:
            if isinstance(node, syntax.GroupNode):
                newgroup.append(self.remove_whitespace(parser, node))
            elif not node.is_ws():
                newgroup.append(node)
        return newgroup


class SingleQuotePlugin(TaggingPlugin):
    """Adds the ability to specify single "terms" containing spaces by
    enclosing them in single quotes.
    """

    expr = r"(^|(?<=\W))'(?P<text>.*?)'(?=\s|\]|[)}]|$)"
    nodetype = syntax.WordNode


class PrefixPlugin(TaggingPlugin):
    """Adds the ability to specify prefix queries by ending a term with an
    asterisk.

    This plugin is useful if you want the user to be able to create prefix but
    not wildcard queries (for performance reasons). If you are including the
    wildcard plugin, you should not include this plugin as well.

    >>> qp = qparser.QueryParser("content", myschema)
    >>> qp.remove_plugin_class(qparser.WildcardPlugin)
    >>> qp.add_plugin(qparser.PrefixPlugin())
    >>> q = qp.parse("pre*")
    """

    class PrefixNode(syntax.TextNode):
        qclass = query.Prefix

        def r(self):
            return "%r*" % self.text

    expr = "(?P<text>[^ \t\r\n*]+)[*](?= |$|\\))"
    nodetype = PrefixNode


class WildcardPlugin(TaggingPlugin):
    # \u055E = Armenian question mark
    # \u061F = Arabic question mark
    # \u1367 = Ethiopic question mark
    qmarks = u("?\u055E\u061F\u1367")
    expr = "(?P<text>[*%s])" % qmarks

    def filters(self, parser):
        # Run early, but definitely before multifield plugin
        return [(self.do_wildcards, 50)]

    def do_wildcards(self, parser, group):
        i = 0
        while i < len(group):
            node = group[i]
            if isinstance(node, self.WildcardNode):
                if i < len(group) - 1 and group[i + 1].is_text():
                    nextnode = group.pop(i + 1)
                    node.text += nextnode.text
                if i > 0 and group[i - 1].is_text():
                    prevnode = group.pop(i - 1)
                    node.text = prevnode.text + node.text
                else:
                    i += 1
            else:
                if isinstance(node, syntax.GroupNode):
                    self.do_wildcards(parser, node)
                i += 1

        for i in xrange(len(group)):
            node = group[i]
            if isinstance(node, self.WildcardNode):
                text = node.text
                if len(text) > 1 and not any(qm in text for qm in self.qmarks):
                    if text.find("*") == len(text) - 1:
                        newnode = PrefixPlugin.PrefixNode(text[:-1])
                        newnode.startchar = node.startchar
                        newnode.endchar = node.endchar
                        group[i] = newnode
        return group

    class WildcardNode(syntax.TextNode):
        # Note that this node inherits tokenize = False from TextNode,
        # so the text in this node will not be analyzed... just passed
        # straight to the query

        qclass = query.Wildcard

        def r(self):
            return "Wild %r" % self.text

    nodetype = WildcardNode


class RegexPlugin(TaggingPlugin):
    """Adds the ability to specify regular expression term queries.

    The default syntax for a regular expression term is ``r"termexpr"``.

    >>> qp = qparser.QueryParser("content", myschema)
    >>> qp.add_plugin(qparser.RegexPlugin())
    >>> q = qp.parse('foo title:r"bar+"')
    """

    class RegexNode(syntax.TextNode):
        qclass = query.Regex

        def r(self):
            return "Regex %r" % self.text

    expr = 'r"(?P<text>[^"]*)"'
    nodetype = RegexNode


class BoostPlugin(TaggingPlugin):
    """Adds the ability to boost clauses of the query using the circumflex.

    >>> qp = qparser.QueryParser("content", myschema)
    >>> q = qp.parse("hello there^2")
    """

    expr = "\\^(?P<boost>[0-9]*(\\.[0-9]+)?)($|(?=[ \t\r\n)]))"

    class BoostNode(syntax.SyntaxNode):
        def __init__(self, original, boost):
            self.original = original
            self.boost = boost

        def r(self):
            return "^ %s" % self.boost

    def create(self, parser, match):
        # Override create so we can grab group 0
        original = match.group(0)
        try:
            boost = float(match.group("boost"))
        except ValueError:
            # The text after the ^ wasn't a valid number, so turn it into a
            # word
            node = syntax.WordNode(original)
        else:
            node = self.BoostNode(original, boost)

        return node

    def filters(self, parser):
        return [(self.clean_boost, 0), (self.do_boost, 510)]

    def clean_boost(self, parser, group):
        """This filter finds any BoostNodes in positions where they can't boost
        the previous node (e.g. at the very beginning, after whitespace, or
        after another BoostNode) and turns them into WordNodes.
        """

        bnode = self.BoostNode
        for i, node in enumerate(group):
            if isinstance(node, bnode):
                if (not i or not group[i - 1].has_boost):
                    group[i] = syntax.to_word(node)
        return group

    def do_boost(self, parser, group):
        """This filter finds BoostNodes and applies the boost to the previous
        node.
        """

        newgroup = group.empty_copy()
        for node in group:
            if isinstance(node, syntax.GroupNode):
                node = self.do_boost(parser, node)
            elif isinstance(node, self.BoostNode):
                if (newgroup and newgroup[-1].has_boost):
                    # Apply the BoostNode's boost to the previous node
                    newgroup[-1].set_boost(node.boost)
                    # Skip adding the BoostNode to the new group
                    continue
                else:
                    node = syntax.to_word(node)
            newgroup.append(node)
        return newgroup


class GroupPlugin(Plugin):
    """Adds the ability to group clauses using parentheses.
    """

    # Marker nodes for open and close bracket

    class OpenBracket(syntax.SyntaxNode):
        def r(self):
            return "("

    class CloseBracket(syntax.SyntaxNode):
        def r(self):
            return ")"

    def __init__(self, openexpr="[(]", closeexpr="[)]"):
        self.openexpr = openexpr
        self.closeexpr = closeexpr

    def taggers(self, parser):
        return [(FnTagger(self.openexpr, self.OpenBracket, "openB"), 0),
                (FnTagger(self.closeexpr, self.CloseBracket, "closeB"), 0)]

    def filters(self, parser):
        return [(self.do_groups, 0)]

    def do_groups(self, parser, group):
        """This filter finds open and close bracket markers in a flat group
        and uses them to organize the nodes into a hierarchy.
        """

        ob, cb = self.OpenBracket, self.CloseBracket
        # Group hierarchy stack
        stack = [parser.group()]
        for node in group:
            if isinstance(node, ob):
                # Open bracket: push a new level of hierarchy on the stack
                stack.append(parser.group())
            elif isinstance(node, cb):
                # Close bracket: pop the current level of hierarchy and append
                # it to the previous level
                if len(stack) > 1:
                    last = stack.pop()
                    stack[-1].append(last)
            else:
                # Anything else: add it to the current level of hierarchy
                stack[-1].append(node)

        top = stack[0]
        # If the parens were unbalanced (more opens than closes), just take
        # whatever levels of hierarchy were left on the stack and tack them on
        # the end of the top-level
        if len(stack) > 1:
            for ls in stack[1:]:
                top.extend(ls)

        if len(top) == 1 and isinstance(top[0], syntax.GroupNode):
            boost = top.boost
            top = top[0]
            top.boost = boost

        return top


class EveryPlugin(TaggingPlugin):
    expr = "[*]:[*]"
    priority = -1

    def create(self, parser, match):
        return self.EveryNode()

    class EveryNode(syntax.SyntaxNode):
        def r(self):
            return "*:*"

        def query(self, parser):
            return query.Every()


class FieldsPlugin(TaggingPlugin):
    """Adds the ability to specify the field of a clause.
    """

    class FieldnameTagger(RegexTagger):
        def create(self, parser, match):
            return syntax.FieldnameNode(match.group("text"), match.group(0))

    def __init__(self, expr=r"(?P<text>\w+|[*]):", remove_unknown=True):
        """
        :param expr: the regular expression to use for tagging fields.
        :param remove_unknown: if True, converts field specifications for
            fields that aren't in the schema into regular text.
        """

        self.expr = expr
        self.removeunknown = remove_unknown

    def taggers(self, parser):
        return [(self.FieldnameTagger(self.expr), 0)]

    def filters(self, parser):
        return [(self.do_fieldnames, 100)]

    def do_fieldnames(self, parser, group):
        """This filter finds FieldnameNodes in the tree and applies their
        fieldname to the next node.
        """

        fnclass = syntax.FieldnameNode

        if self.removeunknown and parser.schema:
            # Look for field nodes that aren't in the schema and convert them
            # to text
            schema = parser.schema
            newgroup = group.empty_copy()
            prev_field_node = None

            for node in group:
                if isinstance(node, fnclass) and node.fieldname not in schema:
                    prev_field_node = node
                    continue
                elif prev_field_node:
                    # If prev_field_node is not None, it contains a field node
                    # that appeared before this node but isn't in the schema,
                    # so we'll convert it to text here
                    if node.has_text:
                        node.text = prev_field_node.original + node.text
                    else:
                        newgroup.append(syntax.to_word(prev_field_node))
                    prev_field_node = None
                newgroup.append(node)
            if prev_field_node:
                newgroup.append(syntax.to_word(prev_field_node))
            group = newgroup

        newgroup = group.empty_copy()
        # Iterate backwards through the stream, looking for field-able objects
        # with field nodes in front of them
        i = len(group)
        while i > 0:
            i -= 1
            node = group[i]
            if isinstance(node, fnclass):
                # If we see a fieldname node, it must not have been in front
                # of something fieldable, since we would have already removed
                # it (since we're iterating backwards), so convert it to text
                node = syntax.to_word(node)
            elif isinstance(node, syntax.GroupNode):
                node = self.do_fieldnames(parser, node)

            if i > 0 and not node.is_ws() and isinstance(group[i - 1],
                                                         fnclass):
                node.set_fieldname(group[i - 1].fieldname, override=False)
                i -= 1

            newgroup.append(node)
        newgroup.reverse()
        return newgroup


class FuzzyTermPlugin(TaggingPlugin):
    """Adds syntax to the query parser to create "fuzzy" term queries, which
    match any term within a certain "edit distance" (number of inserted,
    deleted, or transposed characters) by appending a tilde (``~``) and an
    optional maximum edit distance to a term. If you don't specify an explicit
    maximum edit distance, the default is 1.

    >>> qp = qparser.QueryParser("content", myschema)
    >>> qp.add_plugin(qparser.FuzzyTermPlugin())
    >>> q = qp.parse("Stephen~2 Colbert")

    For example, the following query creates a :class:`whoosh.query.FuzzyTerm`
    query with a maximum edit distance of 1::

        bob~

    The following creates a fuzzy term query with a maximum edit distance of
    2::

        bob~2

    The maximum edit distance can only be a single digit. Note that edit
    distances greater than 2 can take an extremely long time and are generally
    not useful.

    You can specify a prefix length using ``~n/m``. For example, to allow a
    maximum edit distance of 2 and require a prefix match of 3 characters::

        johannson~2/3

    To specify a prefix with the default edit distance::

        johannson~/3
    """

    expr = rcompile("""
    (?<=\\S)                          # Only match right after non-space
    ~                                 # Initial tilde
    (?P<maxdist>[0-9])?               # Optional maxdist
    (/                                # Optional prefix slash
        (?P<prefix>[1-9][0-9]*)       # prefix
    )?                                # (end prefix group)
    """, verbose=True)

    class FuzzinessNode(syntax.SyntaxNode):
        def __init__(self, maxdist, prefixlength, original):
            self.maxdist = maxdist
            self.prefixlength = prefixlength
            self.original = original

        def __repr__(self):
            return "<~%d/%d>" % (self.maxdist, self.prefixlength)

    class FuzzyTermNode(syntax.TextNode):
        qclass = query.FuzzyTerm

        def __init__(self, wordnode, maxdist, prefixlength):
            self.fieldname = wordnode.fieldname
            self.text = wordnode.text
            self.boost = wordnode.boost
            self.startchar = wordnode.startchar
            self.endchar = wordnode.endchar
            self.maxdist = maxdist
            self.prefixlength = prefixlength

        def r(self):
            return "%r ~%d/%d" % (self.text, self.maxdist, self.prefixlength)

        def query(self, parser):
            # Use the superclass's query() method to create a FuzzyTerm query
            # (it looks at self.qclass), just because it takes care of some
            # extra checks and attributes
            q = syntax.TextNode.query(self, parser)
            # Set FuzzyTerm-specific attributes
            q.maxdist = self.maxdist
            q.prefixlength = self.prefixlength
            return q

    def create(self, parser, match):
        mdstr = match.group("maxdist")
        maxdist = int(mdstr) if mdstr else 1

        pstr = match.group("prefix")
        prefixlength = int(pstr) if pstr else 0

        return self.FuzzinessNode(maxdist, prefixlength, match.group(0))

    def filters(self, parser):
        return [(self.do_fuzzyterms, 0)]

    def do_fuzzyterms(self, parser, group):
        newgroup = group.empty_copy()
        i = 0
        while i < len(group):
            node = group[i]
            if i < len(group) - 1 and isinstance(node, syntax.WordNode):
                nextnode = group[i + 1]
                if isinstance(nextnode, self.FuzzinessNode):
                    node = self.FuzzyTermNode(node, nextnode.maxdist,
                                              nextnode.prefixlength)
                    i += 1
            if isinstance(node, self.FuzzinessNode):
                node = syntax.to_word(node)
            if isinstance(node, syntax.GroupNode):
                node = self.do_fuzzyterms(parser, node)

            newgroup.append(node)
            i += 1
        return newgroup


class FunctionPlugin(TaggingPlugin):
    """Adds an abitrary "function call" syntax to the query parser to allow
    advanced and extensible query functionality.

    This is unfinished and experimental.
    """

    expr = rcompile("""
    [#](?P<name>[A-Za-z_][A-Za-z0-9._]*)  # function name
    (                                     # optional args
        \\[                               # inside square brackets
        (?P<args>.*?)
        \\]
    )?
    """, verbose=True)

    class FunctionNode(syntax.SyntaxNode):
        has_fieldname = False
        has_boost = True
        merging = False

        def __init__(self, name, fn, args, kwargs):
            self.name = name
            self.fn = fn
            self.args = args
            self.kwargs = kwargs
            self.nodes = []
            self.boost = None

        def __repr__(self):
            return "#%s<%r>(%r)" % (self.name, self.args, self.nodes)

        def query(self, parser):
            qs = [n.query(parser) for n in self.nodes]
            kwargs = self.kwargs
            if "boost" not in kwargs and self.boost is not None:
                kwargs["boost"] = self.boost
            # TODO: If this call raises an exception, return an error query
            return self.fn(qs, *self.args, **self.kwargs)

    def __init__(self, fns):
        """
        :param fns: a dictionary mapping names to functions that return a
            query.
        """

        self.fns = fns

    def create(self, parser, match):
        name = match.group("name")
        if name in self.fns:
            fn = self.fns[name]
            argstring = match.group("args")
            if argstring:
                args, kwargs = self._parse_args(argstring)
            else:
                args = ()
                kwargs = {}
            return self.FunctionNode(name, fn, args, kwargs)

    def _parse_args(self, argstring):
        args = []
        kwargs = {}

        parts = argstring.split(",")
        for part in parts:
            if "=" in part:
                name, value = part.split("=", 1)
                # Wrap with str() because Python 2.5 can't handle unicode kws
                name = str(name.strip())
            else:
                name = None
                value = part

            value = value.strip()
            if value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            if name:
                kwargs[name] = value
            else:
                args.append(value)

        return args, kwargs

    def filters(self, parser):
        return [(self.do_functions, 600)]

    def do_functions(self, parser, group):
        newgroup = group.empty_copy()
        i = 0
        while i < len(group):
            node = group[i]
            if (isinstance(node, self.FunctionNode)
                and i < len(group) - 1
                and isinstance(group[i + 1], syntax.GroupNode)):
                nextnode = group[i + 1]
                node.nodes = list(self.do_functions(parser, nextnode))

                if nextnode.boost != 1:
                    node.set_boost(nextnode.boost)

                i += 1
            elif isinstance(node, syntax.GroupNode):
                node = self.do_functions(parser, node)

            newgroup.append(node)
            i += 1
        return newgroup


class PhrasePlugin(Plugin):
    """Adds the ability to specify phrase queries inside double quotes.
    """

    # Didn't use TaggingPlugin because I need to add slop parsing at some
    # point

    # Expression used to find words if a schema isn't available
    wordexpr = rcompile(r'\S+')

    class PhraseNode(syntax.TextNode):
        def __init__(self, text, textstartchar, slop=1):
            syntax.TextNode.__init__(self, text)
            self.textstartchar = textstartchar
            self.slop = slop

        def r(self):
            return "%s %r~%s" % (self.__class__.__name__, self.text, self.slop)

        def apply(self, fn):
            return self.__class__(self.type, [fn(node) for node in self.nodes],
                                  slop=self.slop, boost=self.boost)

        def query(self, parser):
            text = self.text
            fieldname = self.fieldname or parser.fieldname

            # We want to process the text of the phrase into "words" (tokens),
            # and also record the startchar and endchar of each word

            sc = self.textstartchar
            if parser.schema and fieldname in parser.schema:
                field = parser.schema[fieldname]
                if field.analyzer:
                    # We have a field with an analyzer, so use it to parse
                    # the phrase into tokens
                    tokens = field.tokenize(text, mode="query", chars=True)
                    words = []
                    char_ranges = []
                    for t in tokens:
                        words.append(t.text)
                        char_ranges.append((sc + t.startchar, sc + t.endchar))
                else:
                    # We have a field but it doesn't have a format object,
                    # for some reason (it's self-parsing?), so use process_text
                    # to get the texts (we won't know the start/end chars)
                    words = list(field.process_text(text, mode="query"))
                    char_ranges = [(None, None)] * len(words)
            else:
                # We're parsing without a schema, so just use the default
                # regular expression to break the text into words
                words = []
                char_ranges = []
                for match in PhrasePlugin.wordexpr.finditer(text):
                    words.append(match.group(0))
                    char_ranges.append((sc + match.start(), sc + match.end()))

            qclass = parser.phraseclass
            q = qclass(fieldname, words, slop=self.slop, boost=self.boost,
                       char_ranges=char_ranges)
            return attach(q, self)

    class PhraseTagger(RegexTagger):
        def create(self, parser, match):
            text = match.group("text")
            textstartchar = match.start("text")
            slopstr = match.group("slop")
            slop = int(slopstr) if slopstr else 1
            return PhrasePlugin.PhraseNode(text, textstartchar, slop)

    def __init__(self, expr='"(?P<text>.*?)"(~(?P<slop>[1-9][0-9]*))?'):
        self.expr = expr

    def taggers(self, parser):
        return [(self.PhraseTagger(self.expr), 0)]


class SequencePlugin(Plugin):
    """Adds the ability to group arbitrary queries inside double quotes to
    produce a query matching the individual sub-queries in sequence.

    To enable this plugin, first remove the default PhrasePlugin, then add
    this plugin::

        qp = qparser.QueryParser("field", my_schema)
        qp.remove_plugin_class(qparser.PhrasePlugin)
        qp.add_plugin(qparser.SequencePlugin())

    This enables parsing "phrases" such as::

        "(jon OR john OR jonathan~1) smith*"
    """

    def __init__(self, expr='["](~(?P<slop>[1-9][0-9]*))?'):
        """
        :param expr: a regular expression for the marker at the start and end
            of a phrase. The default is the double-quotes character.
        """

        self.expr = expr

    class SequenceNode(syntax.GroupNode):
        qclass = query.Sequence

    class QuoteNode(syntax.MarkerNode):
        def __init__(self, slop=None):
            self.slop = int(slop) if slop else 1

    def taggers(self, parser):
        return [(FnTagger(self.expr, self.QuoteNode, "quote"), 0)]

    def filters(self, parser):
        return [(self.do_quotes, 550)]

    def do_quotes(self, parser, group):
        # New group to copy nodes into
        newgroup = group.empty_copy()
        # Buffer for sequence nodes; when it's None, it means we're not in
        # a sequence
        seq = None

        # Start copying nodes from group to newgroup. When we find a quote
        # node, start copying nodes into the buffer instead. When we find
        # the next (end) quote, put the buffered nodes into a SequenceNode
        # and add it to newgroup.
        for node in group:
            if isinstance(node, syntax.GroupNode):
                # Recurse
                node = self.do_quotes(parser, node)

            if isinstance(node, self.QuoteNode):
                if seq is None:
                    # Start a new sequence
                    seq = []
                else:
                    # End the current sequence
                    sn = self.SequenceNode(seq, slop=node.slop)
                    newgroup.append(sn)
                    seq = None
            elif seq is None:
                # Not in a sequence, add directly
                newgroup.append(node)
            else:
                # In a sequence, add it to the buffer
                seq.append(node)

        # We can end up with buffered nodes if there was an unbalanced quote;
        # just add the buffered nodes directly to newgroup
        if seq is not None:
            newgroup.extend(seq)

        return newgroup


class RangePlugin(Plugin):
    """Adds the ability to specify term ranges.
    """

    expr = rcompile(r"""
    (?P<open>\{|\[)               # Open paren
    (?P<start>
        ('[^']*?'\s+)             # single-quoted
        |                         # or
        ([^\]}]+?(?=[Tt][Oo]))    # everything until "to"
    )?
    [Tt][Oo]                      # "to"
    (?P<end>
        (\s+'[^']*?')             # single-quoted
        |                         # or
        ([^\]}]+?)                # everything until "]" or "}"
    )?
    (?P<close>}|])                # Close paren
    """, verbose=True)

    class RangeTagger(RegexTagger):
        def __init__(self, expr, excl_start, excl_end):
            self.expr = expr
            self.excl_start = excl_start
            self.excl_end = excl_end

        def create(self, parser, match):
            start = match.group("start")
            end = match.group("end")
            if start:
                # Strip the space before the "to"
                start = start.rstrip()
                # Strip single quotes
                if start.startswith("'") and start.endswith("'"):
                    start = start[1:-1]
            if end:
                # Strip the space before the "to"
                end = end.lstrip()
                # Strip single quotes
                if end.startswith("'") and end.endswith("'"):
                    end = end[1:-1]
            # What kind of open and close brackets were used?
            startexcl = match.group("open") == self.excl_start
            endexcl = match.group("close") == self.excl_end

            rn = syntax.RangeNode(start, end, startexcl, endexcl)
            return rn

    def __init__(self, expr=None, excl_start="{", excl_end="}"):
        self.expr = expr or self.expr
        self.excl_start = excl_start
        self.excl_end = excl_end

    def taggers(self, parser):
        tagger = self.RangeTagger(self.expr, self.excl_start, self.excl_end)
        return [(tagger, 1)]


class OperatorsPlugin(Plugin):
    """By default, adds the AND, OR, ANDNOT, ANDMAYBE, and NOT operators to
    the parser syntax. This plugin scans the token stream for subclasses of
    :class:`Operator` and calls their :meth:`Operator.make_group` methods
    to allow them to manipulate the stream.

    There are two levels of configuration available.

    The first level is to change the regular expressions of the default
    operators, using the ``And``, ``Or``, ``AndNot``, ``AndMaybe``, and/or
    ``Not`` keyword arguments. The keyword value can be a pattern string or
    a compiled expression, or None to remove the operator::

        qp = qparser.QueryParser("content", schema)
        cp = qparser.OperatorsPlugin(And="&", Or="\\|", AndNot="&!",
                                     AndMaybe="&~", Not=None)
        qp.replace_plugin(cp)

    You can also specify a list of ``(OpTagger, priority)`` pairs as the first
    argument to the initializer to use custom operators. See :ref:`custom-op`
    for more information on this.
    """

    class OpTagger(RegexTagger):
        def __init__(self, expr, grouptype, optype=syntax.InfixOperator,
                     leftassoc=True, memo=""):
            RegexTagger.__init__(self, expr)
            self.grouptype = grouptype
            self.optype = optype
            self.leftassoc = leftassoc
            self.memo = memo

        def __repr__(self):
            return "<%s %r (%s)>" % (self.__class__.__name__,
                                     self.expr.pattern, self.memo)

        def create(self, parser, match):
            return self.optype(match.group(0), self.grouptype, self.leftassoc)

    def __init__(self, ops=None, clean=False,
                 And=r"(?<=\s)AND(?=\s)",
                 Or=r"(?<=\s)OR(?=\s)",
                 AndNot=r"(?<=\s)ANDNOT(?=\s)",
                 AndMaybe=r"(?<=\s)ANDMAYBE(?=\s)",
                 Not=r"(^|(?<=(\s|[()])))NOT(?=\s)",
                 Require=r"(^|(?<=\s))REQUIRE(?=\s)"):
        if ops:
            ops = list(ops)
        else:
            ops = []

        if not clean:
            ot = self.OpTagger
            if Not:
                ops.append((ot(Not, syntax.NotGroup, syntax.PrefixOperator,
                               memo="not"), 0))
            if And:
                ops.append((ot(And, syntax.AndGroup, memo="and"), 0))
            if Or:
                ops.append((ot(Or, syntax.OrGroup, memo="or"), 0))
            if AndNot:
                ops.append((ot(AndNot, syntax.AndNotGroup,
                               memo="anot"), -5))
            if AndMaybe:
                ops.append((ot(AndMaybe, syntax.AndMaybeGroup,
                               memo="amaybe"), -5))
            if Require:
                ops.append((ot(Require, syntax.RequireGroup,
                               memo="req"), 0))

        self.ops = ops

    def taggers(self, parser):
        return self.ops

    def filters(self, parser):
        return [(self.do_operators, 600)]

    def do_operators(self, parser, group):
        """This filter finds PrefixOperator, PostfixOperator, and InfixOperator
        nodes in the tree and calls their logic to rearrange the nodes.
        """

        for tagger, _ in self.ops:
            # Get the operators created by the configured taggers
            optype = tagger.optype
            gtype = tagger.grouptype

            # Left-associative infix operators are replaced left-to-right, and
            # right-associative infix operators are replaced right-to-left.
            # Most of the work is done in the different implementations of
            # Operator.replace_self().
            if tagger.leftassoc:
                i = 0
                while i < len(group):
                    t = group[i]
                    if isinstance(t, optype) and t.grouptype is gtype:
                        i = t.replace_self(parser, group, i)
                    else:
                        i += 1
            else:
                i = len(group) - 1
                while i >= 0:
                    t = group[i]
                    if isinstance(t, optype):
                        i = t.replace_self(parser, group, i)
                    i -= 1

        # Descend into the groups and recursively call do_operators
        for i, t in enumerate(group):
            if isinstance(t, syntax.GroupNode):
                group[i] = self.do_operators(parser, t)

        return group


#

class PlusMinusPlugin(Plugin):
    """Adds the ability to use + and - in a flat OR query to specify required
    and prohibited terms.

    This is the basis for the parser configuration returned by
    ``SimpleParser()``.
    """

    # Marker nodes for + and -

    class Plus(syntax.MarkerNode):
        pass

    class Minus(syntax.MarkerNode):
        pass

    def __init__(self, plusexpr="\\+", minusexpr="-"):
        self.plusexpr = plusexpr
        self.minusexpr = minusexpr

    def taggers(self, parser):
        return [(FnTagger(self.plusexpr, self.Plus, "plus"), 0),
                (FnTagger(self.minusexpr, self.Minus, "minus"), 0)]

    def filters(self, parser):
        return [(self.do_plusminus, 510)]

    def do_plusminus(self, parser, group):
        """This filter sorts nodes in a flat group into "required", "optional",
        and "banned" subgroups based on the presence of plus and minus nodes.
        """

        required = syntax.AndGroup()
        optional = syntax.OrGroup()
        banned = syntax.OrGroup()

        # If the top-level group is an AndGroup we make everything "required" by default
        if isinstance(group, syntax.AndGroup):
            optional = syntax.AndGroup()

        # Which group to put the next node we see into
        next = optional
        for node in group:
            if isinstance(node, self.Plus):
                # +: put the next node in the required group
                next = required
            elif isinstance(node, self.Minus):
                # -: put the next node in the banned group
                next = banned
            else:
                # Anything else: put it in the appropriate group
                next.append(node)
                # Reset to putting things in the optional group by default
                next = optional

        group = optional
        if required:
            group = syntax.AndMaybeGroup([required, group])
        if banned:
            group = syntax.AndNotGroup([group, banned])
        return group


class GtLtPlugin(TaggingPlugin):
    """Allows the user to use greater than/less than symbols to create range
    queries::

        a:>100 b:<=z c:>=-1.4 d:<mz

    This is the equivalent of::

        a:{100 to] b:[to z] c:[-1.4 to] d:[to mz}

    The plugin recognizes ``>``, ``<``, ``>=``, ``<=``, ``=>``, and ``=<``
    after a field specifier. The field specifier is required. You cannot do the
    following::

        >100

    This plugin requires the FieldsPlugin and RangePlugin to work.
    """

    class GtLtNode(syntax.SyntaxNode):
        def __init__(self, rel):
            self.rel = rel

        def __repr__(self):
            return "(%s)" % self.rel

    expr = r"(?P<rel>(<=|>=|<|>|=<|=>))"
    nodetype = GtLtNode

    def filters(self, parser):
        # Run before the fields filter removes FilenameNodes at priority 100.
        return [(self.do_gtlt, 99)]

    def do_gtlt(self, parser, group):
        """This filter translate FieldnameNode/GtLtNode pairs into RangeNodes.
        """

        fname = syntax.FieldnameNode
        newgroup = group.empty_copy()
        i = 0
        lasti = len(group) - 1
        while i < len(group):
            node = group[i]
            # If this is a GtLtNode...
            if isinstance(node, self.GtLtNode):
                # If it's not the last node in the group...
                if i < lasti:
                    prevnode = newgroup[-1]
                    nextnode = group[i + 1]
                    # If previous was a fieldname and next node has text
                    if isinstance(prevnode, fname) and nextnode.has_text:
                        # Make the next node into a range based on the symbol
                        newgroup.append(self.make_range(nextnode, node.rel))
                        # Skip the next node
                        i += 1
            else:
                # If it's not a GtLtNode, add it to the filtered group
                newgroup.append(node)
            i += 1

        return newgroup

    def make_range(self, node, rel):
        text = node.text
        if rel == "<":
            n = syntax.RangeNode(None, text, False, True)
        elif rel == ">":
            n = syntax.RangeNode(text, None, True, False)
        elif rel == "<=" or rel == "=<":
            n = syntax.RangeNode(None, text, False, False)
        elif rel == ">=" or rel == "=>":
            n = syntax.RangeNode(text, None, False, False)
        return n.set_range(node.startchar, node.endchar)


class MultifieldPlugin(Plugin):
    """Converts any unfielded terms into OR clauses that search for the
    term in a specified list of fields.

    >>> qp = qparser.QueryParser(None, myschema)
    >>> qp.add_plugin(qparser.MultifieldPlugin(["a", "b"])
    >>> qp.parse("alfa c:bravo")
    And([Or([Term("a", "alfa"), Term("b", "alfa")]), Term("c", "bravo")])

    This plugin is the basis for the ``MultifieldParser``.
    """

    def __init__(self, fieldnames, fieldboosts=None, group=syntax.OrGroup):
        """
        :param fieldnames: a list of fields to search.
        :param fieldboosts: an optional dictionary mapping field names to
            a boost to use for that field.
        :param group: the group to use to relate the fielded terms to each
            other.
        """

        self.fieldnames = fieldnames
        self.boosts = fieldboosts or {}
        self.group = group

    def filters(self, parser):
        # Run after the fields filter applies explicit fieldnames (at priority
        # 100)
        return [(self.do_multifield, 110)]

    def do_multifield(self, parser, group):
        for i, node in enumerate(group):
            if isinstance(node, syntax.GroupNode):
                # Recurse inside groups
                group[i] = self.do_multifield(parser, node)
            elif node.has_fieldname and node.fieldname is None:
                # For an unfielded node, create a new group containing fielded
                # versions of the node for each configured "multi" field.
                newnodes = []
                for fname in self.fieldnames:
                    newnode = copy.copy(node)
                    newnode.set_fieldname(fname)
                    newnode.set_boost(self.boosts.get(fname, 1.0))
                    newnodes.append(newnode)
                group[i] = self.group(newnodes)
        return group


class FieldAliasPlugin(Plugin):
    """Adds the ability to use "aliases" of fields in the query string.

    This plugin is useful for allowing users of languages that can't be
    represented in ASCII to use field names in their own language, and
    translate them into the "real" field names, which must be valid Python
    identifiers.

    >>> # Allow users to use 'body' or 'text' to refer to the 'content' field
    >>> parser.add_plugin(FieldAliasPlugin({"content": ["body", "text"]}))
    >>> parser.parse("text:hello")
    Term("content", "hello")
    """

    def __init__(self, fieldmap):
        self.fieldmap = fieldmap
        self.reverse = {}
        for key, values in iteritems(fieldmap):
            for value in values:
                self.reverse[value] = key

    def filters(self, parser):
        # Run before fields plugin at 100
        return [(self.do_aliases, 90)]

    def do_aliases(self, parser, group):
        for i, node in enumerate(group):
            if isinstance(node, syntax.GroupNode):
                group[i] = self.do_aliases(parser, node)
            elif node.has_fieldname and node.fieldname is not None:
                fname = node.fieldname
                if fname in self.reverse:
                    node.set_fieldname(self.reverse[fname], override=True)
        return group


class CopyFieldPlugin(Plugin):
    """Looks for basic syntax nodes (terms, prefixes, wildcards, phrases, etc.)
    occurring in a certain field and replaces it with a group (by default OR)
    containing the original token and the token copied to a new field.

    For example, the query::

        hello name:matt

    could be automatically converted by ``CopyFieldPlugin({"name", "author"})``
    to::

        hello (name:matt OR author:matt)

    This is useful where one field was indexed with a differently-analyzed copy
    of another, and you want the query to search both fields.

    You can specify a different group type with the ``group`` keyword. You can
    also specify ``group=None``, in which case the copied node is inserted
    "inline" next to the original, instead of in a new group::

        hello name:matt author:matt
    """

    def __init__(self, map, group=syntax.OrGroup, mirror=False):
        """
        :param map: a dictionary mapping names of fields to copy to the
            names of the destination fields.
        :param group: the type of group to create in place of the original
            token. You can specify ``group=None`` to put the copied node
            "inline" next to the original node instead of in a new group.
        :param two_way: if True, the plugin copies both ways, so if the user
            specifies a query in the 'toname' field, it will be copied to
            the 'fromname' field.
        """

        self.map = map
        self.group = group
        if mirror:
            # Add in reversed mappings
            map.update(dict((v, k) for k, v in iteritems(map)))

    def filters(self, parser):
        # Run after the fieldname filter (100) but before multifield (110)
        return [(self.do_copyfield, 109)]

    def do_copyfield(self, parser, group):
        map = self.map
        newgroup = group.empty_copy()
        for node in group:
            if isinstance(node, syntax.GroupNode):
                # Recurse into groups
                node = self.do_copyfield(parser, node)
            elif node.has_fieldname:
                fname = node.fieldname or parser.fieldname
                if fname in map:
                    newnode = copy.copy(node)
                    newnode.set_fieldname(map[fname], override=True)
                    if self.group is None:
                        newgroup.append(node)
                        newgroup.append(newnode)
                    else:
                        newgroup.append(self.group([node, newnode]))
                    continue
            newgroup.append(node)
        return newgroup


class PseudoFieldPlugin(Plugin):
    """This is an advanced plugin that lets you define "pseudo-fields" the user
    can use in their queries. When the parser encounters one of these fields,
    it runs a given function on the following node in the abstract syntax tree.

    Unfortunately writing the transform function(s) requires knowledge of the
    parser's abstract syntax tree classes. A transform function takes a
    :class:`whoosh.qparser.SyntaxNode` and returns a
    :class:`~whoosh.qparser.SyntaxNode` (or None if the node should be removed
    instead of transformed).

    Some things you can do in the transform function::

        from whoosh import qparser

        def my_xform_fn(node):
            # Is this a text node?
            if node.has_text:
                # Change the node's text
                node.text = node.text + "foo"

                # Change the node into a prefix query
                node = qparser.PrefixPlugin.PrefixNode(node.text)

                # Set the field the node should search in
                node.set_fieldname("title")

                return node
            else:
                # If the pseudo-field wasn't applied to a text node (e.g.
                # it preceded a group, as in ``pfield:(a OR b)`` ), remove the
                # node. Alternatively you could just ``return node`` here to
                # leave the non-text node intact.
                return None

    In the following example, if the user types ``regex:foo.bar``, the function
    transforms the text in the pseudo-field "regex" into a regular expression
    query in the "content" field::

        from whoosh import qparser

        def regex_maker(node):
            if node.has_text:
                node = qparser.RegexPlugin.RegexNode(node.text)
                node.set_fieldname("content")
                return node

        qp = qparser.QueryParser("content", myindex.schema)
        qp.add_plugin(qparser.PseudoFieldPlugin({"regex": regex_maker}))
        q = qp.parse("alfa regex:br.vo")

    The name of the "pseudo" field can be the same as an actual field. Imagine
    the schema has a field named ``reverse``, and you want the user to be able
    to type ``reverse:foo`` and transform it to ``reverse:(foo OR oof)``::

        def rev_text(node):
            if node.has_text:
                # Create a word node for the reversed text
                revtext = node.text[::-1]  # Reverse the text
                rnode = qparser.WordNode(revtext)

                # Put the original node and the reversed node in an OrGroup
                group = qparser.OrGroup([node, rnode])

                # Need to set the fieldname here because the PseudoFieldPlugin
                # removes the field name syntax
                group.set_fieldname("reverse")

                return group

        qp = qparser.QueryParser("content", myindex.schema)
        qp.add_plugin(qparser.PseudoFieldPlugin({"reverse": rev_text}))
        q = qp.parse("alfa reverse:bravo")

    Note that transforming the query like this can potentially really confuse
    the spell checker!

    This plugin works as a filter, so it can only operate on the query after it
    has been parsed into an abstract syntax tree. For parsing control (i.e. to
    give a pseudo-field its own special syntax), you would need to write your
    own parsing plugin.
    """

    def __init__(self, xform_map):
        """
        :param xform_map: a dictionary mapping psuedo-field names to transform
            functions. The function should take a
            :class:`whoosh.qparser.SyntaxNode` as an argument, and return a
            :class:`~whoosh.qparser.SyntaxNode`. If the function returns None,
            the node will be removed from the query.
        """

        self.xform_map = xform_map

    def filters(self, parser):
        # Run before the fieldname filter (100)
        return [(self.do_pseudofield, 99)]

    def do_pseudofield(self, parser, group):
        xform_map = self.xform_map

        newgroup = group.empty_copy()
        xform_next = None
        for node in group:
            if isinstance(node, syntax.GroupNode):
                node = self.do_pseudofield(parser, node)
            elif (isinstance(node, syntax.FieldnameNode)
                  and node.fieldname in xform_map):
                xform_next = xform_map[node.fieldname]
                continue

            if xform_next:
                newnode = xform_next(node)
                xform_next = None
                if newnode is None:
                    continue
                else:
                    newnode.set_range(node.startchar, node.endchar)
                    node = newnode

            newgroup.append(node)

        return newgroup
