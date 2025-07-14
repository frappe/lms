import logging
from collections import OrderedDict

import ply.yacc as yacc

from .ast import (
    AstAlias,
    AstAnnotationDef,
    AstAnnotationRef,
    AstAnnotationTypeDef,
    AstAttrField,
    AstExample,
    AstExampleField,
    AstExampleRef,
    AstField,
    AstNamespace,
    AstImport,
    AstRouteDef,
    AstStructDef,
    AstStructPatch,
    AstSubtypeField,
    AstTagRef,
    AstTypeRef,
    AstUnionDef,
    AstUnionPatch,
    AstVoidField,
)
from .lexer import (
    Lexer,
    NullToken,
)

logger = logging.getLogger('stone.frontend.parser')


class ParserFactory:
    """
    After instantiating a ParserFactory, call get_parser() to get an object
    with a parse() method. It so happens that the object is also a
    ParserFactory. The purpose of get_parser() is to reset the internal state
    of the fatory. The details for why these aren't cleanly separated have to
    do with the inability to separate out the yacc.yacc BNF definition parser
    from the class methods that implement the parser handling logic.

    Due to how ply.yacc works, the docstring of each parser method is a BNF
    rule. Comments that would normally be docstrings for each parser rule
    method are kept before the method definition.
    """

    # Ply parser requiment: Tokens must be re-specified in parser
    tokens = Lexer.tokens

    # Ply feature: Starting grammar rule
    start = 'spec'  # PLY wants a 'str' instance; this makes it work in Python 2 and 3

    def __init__(self, debug=False):
        self.debug = debug
        self.yacc = yacc.yacc(module=self, debug=self.debug, write_tables=self.debug)
        self.lexer = Lexer()
        # [(token type, token value, line number), ...]
        self.errors = []
        # Path to file being parsed. This is added to each token for its
        # utility in error reporting. But the path is never accessed, so this
        # is optional.
        self.path = None
        self.anony_defs = []
        self.exhausted = True

    def get_parser(self):
        """
        Returns a ParserFactory with the state reset so it can be used to
        parse again.

        :return: ParserFactory
        """
        self.path = None
        self.anony_defs = []
        self.exhausted = False
        return self

    def parse(self, data, path=None):
        """
        Args:
            data (str): Raw specification text.
            path (Optional[str]): Path to specification on filesystem. Only
                used to tag tokens with the file they originated from.
        """
        assert not self.exhausted, 'Must call get_parser() to reset state.'
        self.path = path
        parsed_data = self.yacc.parse(data, lexer=self.lexer, debug=self.debug)
        # It generally makes sense for lexer errors to come first, because
        # those can be the root of parser errors. Also, since we only show one
        # error max right now, it's best to show the lexing one.
        for err_msg, lineno in self.lexer.errors[::-1]:
            self.errors.insert(0, (err_msg, lineno, self.path))
        parsed_data.extend(self.anony_defs)
        self.exhausted = True
        return parsed_data

    def test_lexing(self, data):
        self.lexer.test(data)

    def got_errors_parsing(self):
        """Whether the lexer or parser had errors."""
        return self.errors

    def get_errors(self):
        """
        If got_errors_parsing() returns True, call this to get the errors.

        Returns:
            list[tuple[msg: str, lineno: int, path: str]]
        """
        return self.errors[:]

    # --------------------------------------------------------------
    # Spec := Namespace Import* Definition*

    def p_spec_init(self, p):
        """spec : NL
                | empty"""
        p[0] = []

    def p_spec_init_decl(self, p):
        """spec : namespace
                | import
                | definition"""
        p[0] = [p[1]]

    def p_spec_iter(self, p):
        """spec : spec namespace
                | spec import
                | spec definition"""
        p[0] = p[1]
        p[0].append(p[2])

    # This covers the case where we have garbage characters in a file that
    # splits a NL token into two separate tokens.
    def p_spec_ignore_newline(self, p):
        'spec : spec NL'
        p[0] = p[1]

    def p_definition(self, p):
        """definition : alias
                      | annotation
                      | annotation_type
                      | struct
                      | struct_patch
                      | union
                      | union_patch
                      | route"""
        p[0] = p[1]

    def p_namespace(self, p):
        """namespace : KEYWORD ID NL
                     | KEYWORD ID NL INDENT docsection DEDENT"""
        if p[1] == 'namespace':
            doc = None
            if len(p) > 4:
                doc = p[5]
            p[0] = AstNamespace(
                self.path, p.lineno(1), p.lexpos(1), p[2], doc)
        else:
            raise ValueError('Expected namespace keyword')

    def p_import(self, p):
        'import : IMPORT ID NL'
        p[0] = AstImport(self.path, p.lineno(1), p.lexpos(1), p[2])

    def p_alias(self, p):
        """alias : KEYWORD ID EQ type_ref NL
                 | KEYWORD ID EQ type_ref NL INDENT annotation_ref_list docsection DEDENT"""
        if p[1] == 'alias':
            has_annotations = len(p) > 6 and p[7] is not None
            doc = p[8] if len(p) > 6 else None
            p[0] = AstAlias(
                self.path, p.lineno(1), p.lexpos(1), p[2], p[4], doc)
            if has_annotations:
                p[0].set_annotations(p[7])
        else:
            raise ValueError('Expected alias keyword')

    def p_nl(self, p):
        'NL : NEWLINE'
        p[0] = p[1]

    # Sometimes we'll have multiple consecutive newlines that the lexer has
    # trouble combining, so we do it in the parser.
    def p_nl_combine(self, p):
        'NL : NL NEWLINE'
        p[0] = p[1]

    # --------------------------------------------------------------
    # Primitive Types

    def p_primitive(self, p):
        """primitive : BOOLEAN
                     | FLOAT
                     | INTEGER
                     | NULL
                     | STRING"""
        p[0] = p[1]

    # --------------------------------------------------------------
    # References to Types
    #
    # There are several places references to types are made:
    # 1. Alias sources
    #    alias x = TypeRef
    # 2. Field data types
    #    struct S
    #        f TypeRef
    # 3. In arguments to type references
    #    struct S
    #        f TypeRef(key=TypeRef)
    #
    # A type reference can have positional and keyword arguments:
    #     TypeRef(value1, ..., kwarg1=kwvalue1)
    # If it has no arguments, the parentheses can be omitted.
    #
    # If a type reference has a '?' suffix, it is a nullable type.

    def p_pos_arg(self, p):
        """pos_arg : primitive
                   | type_ref"""
        p[0] = p[1]

    def p_pos_args_list_create(self, p):
        """pos_args_list : pos_arg"""
        p[0] = [p[1]]

    def p_pos_args_list_extend(self, p):
        """pos_args_list : pos_args_list COMMA pos_arg"""
        p[0] = p[1]
        p[0].append(p[3])

    def p_kw_arg(self, p):
        """kw_arg : ID EQ primitive
                  | ID EQ type_ref"""
        p[0] = {p[1]: p[3]}

    def p_kw_args(self, p):
        """kw_args : kw_arg"""
        p[0] = p[1]

    def p_kw_args_update(self, p):
        """kw_args : kw_args COMMA kw_arg"""
        p[0] = p[1]
        for key in p[3]:
            if key in p[1]:
                msg = "Keyword argument '%s' defined more than once." % key
                self.errors.append((msg, p.lineno(2), self.path))
        p[0].update(p[3])

    def p_args(self, p):
        """args : LPAR pos_args_list COMMA kw_args RPAR
                | LPAR pos_args_list RPAR
                | LPAR kw_args RPAR
                | LPAR RPAR
                | empty"""
        if len(p) > 3:
            if p[3] == ',':
                p[0] = (p[2], p[4])
            elif isinstance(p[2], dict):
                p[0] = ([], p[2])
            else:
                p[0] = (p[2], {})
        else:
            p[0] = ([], {})

    def p_field_nullable(self, p):
        """nullable : Q
                    | empty"""
        p[0] = p[1] == '?'

    def p_type_ref(self, p):
        'type_ref : ID args nullable'
        p[0] = AstTypeRef(
            path=self.path,
            lineno=p.lineno(1),
            lexpos=p.lexpos(1),
            name=p[1],
            args=p[2],
            nullable=p[3],
            ns=None,
        )

    # A reference to a type in another namespace.
    def p_foreign_type_ref(self, p):
        'type_ref : ID DOT ID args nullable'
        p[0] = AstTypeRef(
            path=self.path,
            lineno=p.lineno(1),
            lexpos=p.lexpos(1),
            name=p[3],
            args=p[4],
            nullable=p[5],
            ns=p[1],
        )

    # --------------------------------------------------------------
    # Annotation types
    #
    # An example annotation type:
    #
    # annotation_type Sensitive
    #     "This is a docstring for the annotation type"
    #
    #     sensitivity Int32
    #
    #     reason String?
    #         "This is a docstring for the field"
    #

    def p_annotation_type(self, p):
        """annotation_type : ANNOTATION_TYPE ID NL \
                              INDENT docsection field_list DEDENT"""
        p[0] = AstAnnotationTypeDef(
            path=self.path,
            lineno=p.lineno(1),
            lexpos=p.lexpos(1),
            name=p[2],
            doc=p[5],
            params=p[6])

    # --------------------------------------------------------------
    # Structs
    #
    # An example struct looks as follows:
    #
    # struct S extends P
    #     "This is a docstring for the struct"
    #
    #     typed_field String
    #         "This is a docstring for the field"
    #
    # An example struct that enumerates subtypes looks as follows:
    #
    # struct P
    #     union
    #         t1 S1
    #         t2 S2
    #     field String
    #
    # struct S1 extends P
    #     ...
    #
    # struct S2 extends P
    #     ...
    #

    def p_enumerated_subtypes(self, p):
        """enumerated_subtypes : uniont NL INDENT subtypes_list DEDENT
                               | empty"""
        if len(p) > 2:
            p[0] = (p[4], p[1][0] == 'union')

    def p_struct(self, p):
        """struct : STRUCT ID inheritance NL \
                     INDENT docsection enumerated_subtypes field_list examples DEDENT"""
        self.make_struct(p)

    def p_anony_struct(self, p):
        """anony_def : STRUCT empty inheritance NL \
                INDENT docsection enumerated_subtypes field_list examples DEDENT"""
        self.make_struct(p)

    def make_struct(self, p):
        p[0] = AstStructDef(
            path=self.path,
            lineno=p.lineno(1),
            lexpos=p.lexpos(1),
            name=p[2],
            extends=p[3],
            doc=p[6],
            subtypes=p[7],
            fields=p[8],
            examples=p[9])

    def p_struct_patch(self, p):
        """struct_patch : PATCH STRUCT ID NL INDENT field_list examples DEDENT"""
        p[0] = AstStructPatch(
            path=self.path,
            lineno=p.lineno(1),
            lexpos=p.lexpos(1),
            name=p[3],
            fields=p[6],
            examples=p[7])

    def p_inheritance(self, p):
        """inheritance : EXTENDS type_ref
                       | empty"""
        if p[1]:
            if p[2].nullable:
                msg = 'Reference cannot be nullable.'
                self.errors.append((msg, p.lineno(1), self.path))
            else:
                p[0] = p[2]

    def p_enumerated_subtypes_list_create(self, p):
        """subtypes_list : subtype_field
                         | empty"""
        if p[1] is not None:
            p[0] = [p[1]]

    def p_enumerated_subtypes_list_extend(self, p):
        'subtypes_list : subtypes_list subtype_field'
        p[0] = p[1]
        p[0].append(p[2])

    def p_enumerated_subtype_field(self, p):
        'subtype_field : ID type_ref NL'
        p[0] = AstSubtypeField(
            self.path, p.lineno(1), p.lexpos(1), p[1], p[2])

    # --------------------------------------------------------------
    # Fields
    #
    # Each struct has zero or more fields. A field has a name, type,
    # and docstring.
    #
    # TODO(kelkabany): Split fields into struct fields and union fields
    # since they differ in capabilities rather significantly now.

    def p_field_list_create(self, p):
        """field_list : field
                      | empty"""
        if p[1] is None:
            p[0] = []
        else:
            p[0] = [p[1]]

    def p_field_list_extend(self, p):
        'field_list : field_list field'
        p[0] = p[1]
        p[0].append(p[2])

    def p_default_option(self, p):
        """default_option : EQ primitive
                          | EQ tag_ref
                          | empty"""
        if p[1]:
            if isinstance(p[2], AstTagRef):
                p[0] = p[2]
            else:
                p[0] = p[2]

    def p_field(self, p):
        """field : ID type_ref default_option NL \
                    INDENT annotation_ref_list docsection anony_def_option DEDENT
                 | ID type_ref default_option NL"""
        has_annotations = len(p) > 5 and p[6] is not None
        has_docstring = len(p) > 5 and p[7] is not None
        has_anony_def = len(p) > 5 and p[8] is not None
        p[0] = AstField(
            self.path, p.lineno(1), p.lexpos(1), p[1], p[2])
        if p[3] is not None:
            if p[3] is NullToken:
                p[0].set_default(None)
            else:
                p[0].set_default(p[3])
        if has_annotations:
            p[0].set_annotations(p[6])
        if has_docstring:
            p[0].set_doc(p[7])
        if has_anony_def:
            p[8].name = p[2].name
            self.anony_defs.append(p[8])

    def p_anony_def_option(self, p):
        """anony_def_option : anony_def
                            | empty"""
        p[0] = p[1]

    def p_tag_ref(self, p):
        'tag_ref : ID'
        p[0] = AstTagRef(self.path, p.lineno(1), p.lexpos(1), p[1])

    def p_annotation(self, p):
        """annotation : ANNOTATION ID EQ ID args NL
                      | ANNOTATION ID EQ ID DOT ID args NL"""
        if len(p) < 8:
            args, kwargs = p[5]
            p[0] = AstAnnotationDef(
                self.path, p.lineno(1), p.lexpos(1), p[2], p[4], None, args, kwargs)
        else:
            args, kwargs = p[7]
            p[0] = AstAnnotationDef(
                self.path, p.lineno(1), p.lexpos(1), p[2], p[6], p[4], args, kwargs)

    def p_annotation_ref_list_create(self, p):
        """annotation_ref_list : annotation_ref
                               | empty"""
        if p[1] is not None:
            p[0] = [p[1]]
        else:
            p[0] = None

    def p_annotation_ref_list_extend(self, p):
        """annotation_ref_list : annotation_ref_list annotation_ref"""
        p[0] = p[1]
        p[0].append(p[2])

    def p_annotation_ref(self, p):
        """annotation_ref : AT ID NL
                          | AT ID DOT ID NL"""
        if len(p) < 5:
            p[0] = AstAnnotationRef(self.path, p.lineno(1), p.lexpos(1), p[2], None)
        else:
            p[0] = AstAnnotationRef(self.path, p.lineno(1), p.lexpos(1), p[4], p[2])

    # --------------------------------------------------------------
    # Unions
    #
    # An example union looks as follows:
    #
    # union U
    #     "This is a docstring for the union"
    #
    #     void_field*
    #         "Docstring for field with type Void"
    #     typed_field String
    #
    # void_field demonstrates the notation for a catch all variant.

    def p_union(self, p):
        """union : uniont ID inheritance NL \
                        INDENT docsection field_list examples DEDENT"""
        self.make_union(p)

    def p_anony_union(self, p):
        """anony_def : uniont empty inheritance NL \
                        INDENT docsection field_list examples DEDENT"""
        self.make_union(p)

    def make_union(self, p):
        p[0] = AstUnionDef(
            path=self.path,
            lineno=p[1][1],
            lexpos=p[1][2],
            name=p[2],
            extends=p[3],
            doc=p[6],
            fields=p[7],
            examples=p[8],
            closed=p[1][0] == 'union_closed')

    def p_union_patch(self, p):
        """union_patch : PATCH uniont ID NL INDENT field_list examples DEDENT"""
        p[0] = AstUnionPatch(
            path=self.path,
            lineno=p[2][1],
            lexpos=p[2][2],
            name=p[3],
            fields=p[6],
            examples=p[7],
            closed=p[2][0] == 'union_closed')

    def p_uniont(self, p):
        """uniont : UNION
                  | UNION_CLOSED"""
        p[0] = (p[1], p.lineno(1), p.lexpos(1))

    def p_field_void(self, p):
        """field : ID NL
                 | ID NL INDENT annotation_ref_list docsection DEDENT"""
        p[0] = AstVoidField(self.path, p.lineno(1), p.lexpos(1), p[1])
        if len(p) > 3:
            if p[4] is not None:
                p[0].set_annotations(p[4])

            if p[5] is not None:
                p[0].set_doc(p[5])

    # --------------------------------------------------------------
    # Routes
    #
    # An example route looks as follows:
    #
    # route sample-route/sub-path:2 (arg, result, error)
    #     "This is a docstring for the route"
    #
    #     attrs
    #         key="value"
    #
    # The error type is optional.

    def p_route(self, p):
        """route : ROUTE route_name route_version route_io route_deprecation NL \
                        INDENT docsection attrssection DEDENT
                 | ROUTE route_name route_version route_io route_deprecation NL"""
        p[0] = AstRouteDef(self.path, p.lineno(1), p.lexpos(1), p[2], p[3], p[5], *p[4])
        if len(p) > 7:
            p[0].set_doc(p[8])
            if p[9]:
                keys = set()
                for attr in p[9]:
                    if attr.name in keys:
                        msg = "Attribute '%s' defined more than once." % attr.name
                        self.errors.append((msg, attr.lineno, attr.path))
                    keys.add(attr.name)
                p[0].set_attrs(p[9])

    def p_route_name(self, p):
        'route_name : ID route_path'
        if p[2]:
            p[0] = p[1] + p[2]
        else:
            p[0] = p[1]

    def p_route_path_suffix(self, p):
        """route_path : PATH
                      | empty"""
        p[0] = p[1]

    def p_route_version(self, p):
        """route_version : COLON INTEGER
                         | empty"""
        if len(p) > 2:
            if p[2] <= 0:
                msg = "Version number should be a positive integer."
                self.errors.append((msg, p.lineno(2), self.path))
            p[0] = p[2]
        else:
            p[0] = 1

    def p_route_io(self, p):
        """route_io : LPAR type_ref COMMA type_ref RPAR
                    | LPAR type_ref COMMA type_ref COMMA type_ref RPAR"""
        if len(p) > 6:
            p[0] = (p[2], p[4], p[6])
        else:
            p[0] = (p[2], p[4], None)

    def p_route_deprecation(self, p):
        """route_deprecation : DEPRECATED
                             | DEPRECATED BY route_name route_version
                             | empty"""
        if len(p) == 5:
            p[0] = (True, p[3], p[4])
        elif p[1]:
            p[0] = (True, None, None)

    def p_attrs_section(self, p):
        """attrssection : ATTRS NL INDENT attr_fields DEDENT
                        | empty"""
        if p[1]:
            p[0] = p[4]

    def p_attr_fields_create(self, p):
        'attr_fields : attr_field'
        p[0] = [p[1]]

    def p_attr_fields_add(self, p):
        'attr_fields : attr_fields attr_field'
        p[0] = p[1]
        p[0].append(p[2])

    def p_attr_field(self, p):
        """attr_field : ID EQ primitive NL
                      | ID EQ tag_ref NL"""
        if p[3] is NullToken:
            p[0] = AstAttrField(
                self.path, p.lineno(1), p.lexpos(1), p[1], None)
        else:
            p[0] = AstAttrField(
                self.path, p.lineno(1), p.lexpos(1), p[1], p[3])

    # --------------------------------------------------------------
    # Doc sections
    #
    # Doc sections appear after struct, union, and route signatures;
    # also after field declarations.
    #
    # They're represented by text (multi-line supported) enclosed by
    # quotations.
    #
    # struct S
    #     "This is a docstring
    #     for struct S"
    #
    #     number Int64
    #         "This is a docstring for this field"

    def p_docsection(self, p):
        """docsection : docstring NL
                      | empty"""
        if p[1] is not None:
            p[0] = p[1]

    def p_docstring_string(self, p):
        'docstring : STRING'
        # Remove trailing whitespace on every line.
        p[0] = '\n'.join([line.rstrip() for line in p[1].split('\n')])

    # --------------------------------------------------------------
    # Examples
    #
    # Examples appear at the bottom of struct definitions to give
    # illustrative examples of what struct values may look like.
    #
    # struct S
    #     number Int64
    #
    #     example default "This is a label"
    #         number=42

    def p_examples_create(self, p):
        """examples : example
                    | empty"""
        p[0] = OrderedDict()
        if p[1] is not None:
            p[0][p[1].label] = p[1]

    def p_examples_add(self, p):
        'examples : examples example'
        p[0] = p[1]
        if p[2].label in p[0]:
            existing_ex = p[0][p[2].label]
            self.errors.append(
                ("Example with label '%s' already defined on line %d." %
                 (existing_ex.label, existing_ex.lineno),
                 p[2].lineno, p[2].path))
        p[0][p[2].label] = p[2]

    # It's possible for no example fields to be specified.
    def p_example(self, p):
        """example : KEYWORD ID NL INDENT docsection example_fields DEDENT
                   | KEYWORD ID NL"""
        if len(p) > 4:
            seen_fields = set()
            for example_field in p[6]:
                if example_field.name in seen_fields:
                    self.errors.append(
                        ("Example with label '%s' defines field '%s' more "
                        "than once." % (p[2], example_field.name),
                        p.lineno(1), self.path))
                seen_fields.add(example_field.name)
            p[0] = AstExample(
                self.path, p.lineno(1), p.lexpos(1), p[2], p[5],
                OrderedDict((f.name, f) for f in p[6]))
        else:
            p[0] = AstExample(
                self.path, p.lineno(1), p.lexpos(1), p[2], None, OrderedDict())

    def p_example_fields_create(self, p):
        'example_fields : example_field'
        p[0] = [p[1]]

    def p_example_fields_add(self, p):
        'example_fields : example_fields example_field'
        p[0] = p[1]
        p[0].append(p[2])

    def p_example_field(self, p):
        """example_field : ID EQ primitive NL
                         | ID EQ ex_list NL
                         | ID EQ ex_map NL"""
        if p[3] is NullToken:
            p[0] = AstExampleField(
                self.path, p.lineno(1), p.lexpos(1), p[1], None)
        else:
            p[0] = AstExampleField(
                self.path, p.lineno(1), p.lexpos(1), p[1], p[3])

    def p_example_multiline(self, p):
        """example_field : ID EQ NL INDENT ex_map NL DEDENT"""
        p[0] = AstExampleField(
            self.path, p.lineno(1), p.lexpos(1), p[1], p[5])

    def p_example_field_ref(self, p):
        'example_field : ID EQ ID NL'
        p[0] = AstExampleField(self.path, p.lineno(1), p.lexpos(1),
            p[1], AstExampleRef(self.path, p.lineno(3), p.lexpos(3), p[3]))

    # --------------------------------------------------------------
    # Example of list

    def p_ex_list(self, p):
        """ex_list : LBRACKET ex_list_items RBRACKET
                   | LBRACKET empty RBRACKET"""
        if p[2] is None:
            p[0] = []
        else:
            p[0] = p[2]

    def p_ex_list_item_primitive(self, p):
        'ex_list_item : primitive'
        if p[1] is NullToken:
            p[0] = None
        else:
            p[0] = p[1]

    def p_ex_list_item_id(self, p):
        'ex_list_item : ID'
        p[0] = AstExampleRef(self.path, p.lineno(1), p.lexpos(1), p[1])

    def p_ex_list_item_list(self, p):
        'ex_list_item : ex_list'
        p[0] = p[1]

    def p_ex_list_items_create(self, p):
        """ex_list_items : ex_list_item"""
        p[0] = [p[1]]

    def p_ex_list_items_extend(self, p):
        """ex_list_items : ex_list_items COMMA ex_list_item"""
        p[0] = p[1]
        p[0].append(p[3])

    # --------------------------------------------------------------
    # Maps
    #

    def p_ex_map(self, p):
        """ex_map : LBRACE ex_map_pairs RBRACE
                  | LBRACE empty RBRACE"""
        p[0] = p[2] or {}

    def p_ex_map_multiline(self, p):
        """ex_map : LBRACE NL INDENT ex_map_pairs NL DEDENT RBRACE"""
        p[0] = p[4] or {}

    def p_ex_map_elem_primitive(self, p):
        """ex_map_elem : primitive"""
        p[0] = None if p[1] == NullToken else p[1]

    def p_ex_map_elem_composit(self, p):
        """ex_map_elem : ex_map
                       | ex_list"""
        p[0] = p[1]

    def p_ex_map_elem_id(self, p):
        """ex_map_elem : ID"""
        p[0] = AstExampleRef(self.path, p.lineno(1), p.lexpos(1), p[1])

    def p_ex_map_pair(self, p):
        """ex_map_pair : ex_map_elem COLON ex_map_elem"""
        try:
            p[0] = {p[1]: p[3]}
        except TypeError:
            msg = "%s is an invalid hash key because it cannot be hashed." % repr(p[1])
            self.errors.append((msg, p.lineno(2), self.path))
            p[0] = {}

    def p_ex_map_pairs_create(self, p):
        """ex_map_pairs : ex_map_pair """
        p[0] = p[1]

    def p_ex_map_pairs_extend(self, p):
        """ex_map_pairs : ex_map_pairs COMMA ex_map_pair"""
        p[0] = p[1]
        p[0].update(p[3])

    def p_ex_map_pairs_multiline(self, p):
        """ex_map_pairs : ex_map_pairs COMMA NL ex_map_pair"""
        p[0] = p[1]
        p[0].update(p[4])

    # --------------------------------------------------------------

    # In ply, this is how you define an empty rule. This is used when we want
    # the parser to treat a rule as optional.
    def p_empty(self, p):
        'empty :'

    # Called by the parser whenever a token doesn't match any rule.
    def p_error(self, token):
        assert token is not None, "Unknown error, please report this."
        logger.debug('Unexpected %s(%r) at line %d',
                     token.type,
                     token.value,
                     token.lineno)
        self.errors.append(
            ("Unexpected %s with value %s." %
             (token.type, repr(token.value).lstrip('u')),
             token.lineno, self.path))
