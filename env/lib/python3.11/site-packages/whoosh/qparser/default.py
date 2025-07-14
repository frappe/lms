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

import sys

from whoosh import query
from whoosh.compat import text_type
from whoosh.qparser import syntax
from whoosh.qparser.common import print_debug, QueryParserError


# Query parser object

class QueryParser(object):
    """A hand-written query parser built on modular plug-ins. The default
    configuration implements a powerful fielded query language similar to
    Lucene's.

    You can use the ``plugins`` argument when creating the object to override
    the default list of plug-ins, and/or use ``add_plugin()`` and/or
    ``remove_plugin_class()`` to change the plug-ins included in the parser.

    >>> from whoosh import qparser
    >>> parser = qparser.QueryParser("content", schema)
    >>> parser.remove_plugin_class(qparser.WildcardPlugin)
    >>> parser.add_plugin(qparser.PrefixPlugin())
    >>> parser.parse(u"hello there")
    And([Term("content", u"hello"), Term("content", u"there")])
    """

    def __init__(self, fieldname, schema, plugins=None, termclass=query.Term,
                 phraseclass=query.Phrase, group=syntax.AndGroup):
        """
        :param fieldname: the default field -- the parser uses this as the
            field for any terms without an explicit field.
        :param schema: a :class:`whoosh.fields.Schema` object to use when
            parsing. The appropriate fields in the schema will be used to
            tokenize terms/phrases before they are turned into query objects.
            You can specify None for the schema to create a parser that does
            not analyze the text of the query, usually for testing purposes.
        :param plugins: a list of plugins to use. WhitespacePlugin is
            automatically included, do not put it in this list. This overrides
            the default list of plugins. Classes in the list will be
            automatically instantiated.
        :param termclass: the query class to use for individual search terms.
            The default is :class:`whoosh.query.Term`.
        :param phraseclass: the query class to use for phrases. The default
            is :class:`whoosh.query.Phrase`.
        :param group: the default grouping. ``AndGroup`` makes terms required
            by default. ``OrGroup`` makes terms optional by default.
        """

        self.fieldname = fieldname
        self.schema = schema
        self.termclass = termclass
        self.phraseclass = phraseclass
        self.group = group
        self.plugins = []

        if plugins is None:
            plugins = self.default_set()
        self._add_ws_plugin()
        self.add_plugins(plugins)

    def default_set(self):
        """Returns the default list of plugins to use.
        """

        from whoosh.qparser import plugins

        return [plugins.WhitespacePlugin(),
                plugins.SingleQuotePlugin(),
                plugins.FieldsPlugin(),
                plugins.WildcardPlugin(),
                plugins.PhrasePlugin(),
                plugins.RangePlugin(),
                plugins.GroupPlugin(),
                plugins.OperatorsPlugin(),
                plugins.BoostPlugin(),
                plugins.EveryPlugin(),
                ]

    def add_plugins(self, pins):
        """Adds the given list of plugins to the list of plugins in this
        parser.
        """

        for pin in pins:
            self.add_plugin(pin)

    def add_plugin(self, pin):
        """Adds the given plugin to the list of plugins in this parser.
        """

        if isinstance(pin, type):
            pin = pin()
        self.plugins.append(pin)

    def _add_ws_plugin(self):
        from whoosh.qparser.plugins import WhitespacePlugin
        self.add_plugin(WhitespacePlugin())

    def remove_plugin(self, pi):
        """Removes the given plugin object from the list of plugins in this
        parser.
        """

        self.plugins.remove(pi)

    def remove_plugin_class(self, cls):
        """Removes any plugins of the given class from this parser.
        """

        self.plugins = [pi for pi in self.plugins if not isinstance(pi, cls)]

    def replace_plugin(self, plugin):
        """Removes any plugins of the class of the given plugin and then adds
        it. This is a convenience method to keep from having to call
        ``remove_plugin_class`` followed by ``add_plugin`` each time you want
        to reconfigure a default plugin.

        >>> qp = qparser.QueryParser("content", schema)
        >>> qp.replace_plugin(qparser.NotPlugin("(^| )-"))
        """

        self.remove_plugin_class(plugin.__class__)
        self.add_plugin(plugin)

    def _priorized(self, methodname):
        # methodname is "taggers" or "filters". Returns a priorized list of
        # tagger objects or filter functions.
        items_and_priorities = []
        for plugin in self.plugins:
            # Call either .taggers() or .filters() on the plugin
            method = getattr(plugin, methodname)
            for item in method(self):
                items_and_priorities.append(item)
        # Sort the list by priority (lower priority runs first)
        items_and_priorities.sort(key=lambda x: x[1])
        # Return the sorted list without the priorities
        return [item for item, _ in items_and_priorities]

    def multitoken_query(self, spec, texts, fieldname, termclass, boost):
        """Returns a query for multiple texts. This method implements the
        intention specified in the field's ``multitoken_query`` attribute,
        which specifies what to do when strings that look like single terms
        to the parser turn out to yield multiple tokens when analyzed.

        :param spec: a string describing how to join the text strings into a
            query. This is usually the value of the field's
            ``multitoken_query`` attribute.
        :param texts: a list of token strings.
        :param fieldname: the name of the field.
        :param termclass: the query class to use for single terms.
        :param boost: the original term's boost in the query string, should be
            applied to the returned query object.
        """

        spec = spec.lower()
        if spec == "first":
            # Throw away all but the first token
            return termclass(fieldname, texts[0], boost=boost)
        elif spec == "phrase":
            # Turn the token into a phrase
            return self.phraseclass(fieldname, texts, boost=boost)
        else:
            if spec == "default":
                qclass = self.group.qclass
            elif spec == "and":
                qclass = query.And
            elif spec == "or":
                qclass = query.Or
            else:
                raise QueryParserError("Unknown multitoken_query value %r"
                                       % spec)
            return qclass([termclass(fieldname, t, boost=boost)
                           for t in texts])

    def term_query(self, fieldname, text, termclass, boost=1.0, tokenize=True,
                   removestops=True):
        """Returns the appropriate query object for a single term in the query
        string.
        """

        if self.schema and fieldname in self.schema:
            field = self.schema[fieldname]

            # If this field type wants to parse queries itself, let it do so
            # and return early
            if field.self_parsing():
                try:
                    q = field.parse_query(fieldname, text, boost=boost)
                    return q
                except:
                    e = sys.exc_info()[1]
                    return query.error_query(e)

            # Otherwise, ask the field to process the text into a list of
            # tokenized strings
            texts = list(field.process_text(text, mode="query",
                                            tokenize=tokenize,
                                            removestops=removestops))

            # If the analyzer returned more than one token, use the field's
            # multitoken_query attribute to decide what query class, if any, to
            # use to put the tokens together
            if len(texts) > 1:
                return self.multitoken_query(field.multitoken_query, texts,
                                             fieldname, termclass, boost)

            # It's possible field.process_text() will return an empty list (for
            # example, on a stop word)
            if not texts:
                return None
            text = texts[0]

        return termclass(fieldname, text, boost=boost)

    def taggers(self):
        """Returns a priorized list of tagger objects provided by the parser's
        currently configured plugins.
        """

        return self._priorized("taggers")

    def filters(self):
        """Returns a priorized list of filter functions provided by the
        parser's currently configured plugins.
        """

        return self._priorized("filters")

    def tag(self, text, pos=0, debug=False):
        """Returns a group of syntax nodes corresponding to the given text,
        created by matching the Taggers provided by the parser's plugins.

        :param text: the text to tag.
        :param pos: the position in the text to start tagging at.
        """

        # The list out output tags
        stack = []
        # End position of the previous match
        prev = pos
        # Priorized list of taggers provided by the parser's plugins
        taggers = self.taggers()
        if debug:
            print_debug(debug, "Taggers: %r" % taggers)

        # Define a function that will make a WordNode from the "interstitial"
        # text between matches
        def inter(startchar, endchar):
            n = syntax.WordNode(text[startchar:endchar])
            n.startchar = startchar
            n.endchar = endchar
            return n

        while pos < len(text):
            node = None
            # Try each tagger to see if it matches at the current position
            for tagger in taggers:
                node = tagger.match(self, text, pos)
                if node is not None:
                    if node.endchar <= pos:
                        raise Exception("Token %r did not move cursor forward."
                                        " (%r, %s)" % (tagger, text, pos))
                    if prev < pos:
                        tween = inter(prev, pos)
                        if debug:
                            print_debug(debug, "Tween: %r" % tween)
                        stack.append(tween)

                    if debug:
                        print_debug(debug, "Tagger: %r at %s: %r"
                                    % (tagger, pos, node))
                    stack.append(node)
                    prev = pos = node.endchar
                    break

            if not node:
                # No taggers matched, move forward
                pos += 1

        # If there's unmatched text left over on the end, put it in a WordNode
        if prev < len(text):
            stack.append(inter(prev, len(text)))

        # Wrap the list of nodes in a group node
        group = self.group(stack)
        if debug:
            print_debug(debug, "Tagged group: %r" % group)
        return group

    def filterize(self, nodes, debug=False):
        """Takes a group of nodes and runs the filters provided by the parser's
        plugins.
        """

        # Call each filter in the priorized list of plugin filters
        if debug:
            print_debug(debug, "Pre-filtered group: %r" % nodes)
        for f in self.filters():
            if debug:
                print_debug(debug, "..Applying: %r" % f)
            nodes = f(self, nodes)
            if debug:
                print_debug(debug, "..Result: %r" % nodes)
            if nodes is None:
                raise Exception("Filter %r did not return anything" % f)
        return nodes

    def process(self, text, pos=0, debug=False):
        """Returns a group of syntax nodes corresponding to the given text,
        tagged by the plugin Taggers and filtered by the plugin filters.

        :param text: the text to tag.
        :param pos: the position in the text to start tagging at.
        """

        nodes = self.tag(text, pos=pos, debug=debug)
        nodes = self.filterize(nodes, debug=debug)
        return nodes

    def parse(self, text, normalize=True, debug=False):
        """Parses the input string and returns a :class:`whoosh.query.Query`
        object/tree.

        :param text: the unicode string to parse.
        :param normalize: whether to call normalize() on the query object/tree
            before returning it. This should be left on unless you're trying to
            debug the parser output.
        :rtype: :class:`whoosh.query.Query`
        """

        if not isinstance(text, text_type):
            text = text.decode("latin1")

        nodes = self.process(text, debug=debug)
        if debug:
            print_debug(debug, "Syntax tree: %r" % nodes)

        q = nodes.query(self)
        if not q:
            q = query.NullQuery
        if debug:
            print_debug(debug, "Pre-normalized query: %r" % q)

        if normalize:
            q = q.normalize()
            if debug:
                print_debug(debug, "Normalized query: %r" % q)
        return q

    def parse_(self, text, normalize=True):
        pass


# Premade parser configurations

def MultifieldParser(fieldnames, schema, fieldboosts=None, **kwargs):
    """Returns a QueryParser configured to search in multiple fields.

    Instead of assigning unfielded clauses to a default field, this parser
    transforms them into an OR clause that searches a list of fields. For
    example, if the list of multi-fields is "f1", "f2" and the query string is
    "hello there", the class will parse "(f1:hello OR f2:hello) (f1:there OR
    f2:there)". This is very useful when you have two textual fields (e.g.
    "title" and "content") you want to search by default.

    :param fieldnames: a list of field names to search.
    :param fieldboosts: an optional dictionary mapping field names to boosts.
    """

    from whoosh.qparser.plugins import MultifieldPlugin

    p = QueryParser(None, schema, **kwargs)
    mfp = MultifieldPlugin(fieldnames, fieldboosts=fieldboosts)
    p.add_plugin(mfp)
    return p


def SimpleParser(fieldname, schema, **kwargs):
    """Returns a QueryParser configured to support only +, -, and phrase
    syntax.
    """

    from whoosh.qparser import plugins, syntax

    pins = [plugins.WhitespacePlugin,
            plugins.PlusMinusPlugin,
            plugins.PhrasePlugin]
    orgroup = syntax.OrGroup
    return QueryParser(fieldname, schema, plugins=pins, group=orgroup,
                       **kwargs)


def DisMaxParser(fieldboosts, schema, tiebreak=0.0, **kwargs):
    """Returns a QueryParser configured to support only +, -, and phrase
    syntax, and which converts individual terms into DisjunctionMax queries
    across a set of fields.

    :param fieldboosts: a dictionary mapping field names to boosts.
    """

    from whoosh.qparser import plugins, syntax

    mfp = plugins.MultifieldPlugin(list(fieldboosts.keys()),
                                   fieldboosts=fieldboosts,
                                   group=syntax.DisMaxGroup)
    pins = [plugins.WhitespacePlugin,
            plugins.PlusMinusPlugin,
            plugins.PhrasePlugin,
            mfp]
    orgroup = syntax.OrGroup
    return QueryParser(None, schema, plugins=pins, group=orgroup, **kwargs)
