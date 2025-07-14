from collections import OrderedDict


class ASTNode:

    def __init__(self, path, lineno, lexpos):
        """
        Args:
            lineno (int): The line number where the start of this element
                occurs.
            lexpos (int): The character offset into the file where this element
                occurs.
        """
        self.path = path
        self.lineno = lineno
        self.lexpos = lexpos


class AstNamespace(ASTNode):

    def __init__(self, path, lineno, lexpos, name, doc):
        """
        Args:
            name (str): The namespace of the spec.
            doc (Optional[str]): The docstring for this namespace.
        """
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.doc = doc

    def __str__(self):
        return self.__repr__()

    def __repr__(self):
        return 'AstNamespace({!r})'.format(self.name)


class AstImport(ASTNode):

    def __init__(self, path, lineno, lexpos, target):
        """
        Args:
            target (str): The name of the namespace to import.
        """
        super().__init__(path, lineno, lexpos)
        self.target = target

    def __str__(self):
        return self.__repr__()

    def __repr__(self):
        return 'AstImport({!r})'.format(self.target)

class AstAlias(ASTNode):

    def __init__(self, path, lineno, lexpos, name, type_ref, doc):
        """
        Args:
            name (str): The name of the alias.
            type_ref (AstTypeRef): The data type of the field.
            doc (Optional[str]): Documentation string for the alias.
        """
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.type_ref = type_ref
        self.doc = doc
        self.annotations = []

    def set_annotations(self, annotations):
        self.annotations = annotations

    def __repr__(self):
        return 'AstAlias({!r}, {!r})'.format(self.name, self.type_ref)

class AstTypeDef(ASTNode):

    def __init__(self, path, lineno, lexpos, name, extends, doc, fields,
                 examples):
        """
        Args:
            name (str): Name assigned to the type.
            extends (Optional[str]); Name of the type this inherits from.
            doc (Optional[str]): Docstring for the type.
            fields (List[AstField]): Fields of a type, not including
                inherited ones.
            examples (Optional[OrderedDict[str, AstExample]]): Map from label
                to example.
        """
        super().__init__(path, lineno, lexpos)

        self.name = name
        assert isinstance(extends, (AstTypeRef, type(None))), type(extends)
        self.extends = extends
        assert isinstance(doc, (str, type(None)))
        self.doc = doc
        assert isinstance(fields, list)
        self.fields = fields
        assert isinstance(examples, (OrderedDict, type(None))), type(examples)
        self.examples = examples

    def __str__(self):
        return self.__repr__()

    def __repr__(self):
        return 'AstTypeDef({!r}, {!r}, {!r})'.format(
            self.name,
            self.extends,
            self.fields,
        )

class AstStructDef(AstTypeDef):

    def __init__(self, path, lineno, lexpos, name, extends, doc, fields,
                 examples, subtypes=None):
        """
        Args:
            subtypes (Tuple[List[AstSubtypeField], bool]): Inner list
                enumerates subtypes. The bool indicates whether this struct
                is a catch-all.

        See AstTypeDef for other constructor args.
        """

        super().__init__(
            path, lineno, lexpos, name, extends, doc, fields, examples)
        assert isinstance(subtypes, (tuple, type(None))), type(subtypes)
        self.subtypes = subtypes

    def __repr__(self):
        return 'AstStructDef({!r}, {!r}, {!r})'.format(
            self.name,
            self.extends,
            self.fields,
        )

class AstStructPatch(ASTNode):

    def __init__(self, path, lineno, lexpos, name, fields, examples):
        super().__init__(path, lineno, lexpos)
        self.name = name
        assert isinstance(fields, list)
        self.fields = fields

        assert isinstance(examples, (OrderedDict, type(None))), type(examples)
        self.examples = examples

    def __repr__(self):
        return 'AstStructPatch({!r}, {!r})'.format(
            self.name,
            self.fields,
        )

class AstUnionDef(AstTypeDef):

    def __init__(self, path, lineno, lexpos, name, extends, doc, fields,
                 examples, closed=False):
        """
        Args:
            closed (bool): Set if this is a closed union.

        See AstTypeDef for other constructor args.
        """
        super().__init__(
            path, lineno, lexpos, name, extends, doc, fields, examples)
        self.closed = closed

    def __repr__(self):
        return 'AstUnionDef({!r}, {!r}, {!r}, {!r})'.format(
            self.name,
            self.extends,
            self.fields,
            self.closed,
        )

class AstUnionPatch(ASTNode):

    def __init__(self, path, lineno, lexpos, name, fields, examples, closed):
        super().__init__(path, lineno, lexpos)
        self.name = name
        assert isinstance(fields, list)
        self.fields = fields

        assert isinstance(examples, (OrderedDict, type(None))), type(examples)
        self.examples = examples
        self.closed = closed

    def __repr__(self):
        return 'AstUnionPatch({!r}, {!r}, {!r})'.format(
            self.name,
            self.fields,
            self.closed,
        )

class AstTypeRef(ASTNode):

    def __init__(self, path, lineno, lexpos, name, args, nullable, ns):
        """
        Args:
            name (str): Name of the referenced type.
            args (tuple[list, dict]): Arguments to type.
            nullable (bool): Whether the type is nullable (can be null)
            ns (Optional[str]): Namespace that referred type is a member of.
                If none, then refers to the current namespace.
        """
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.args = args
        self.nullable = nullable
        self.ns = ns

    def __repr__(self):
        return 'AstTypeRef({!r}, {!r}, {!r}, {!r})'.format(
            self.name,
            self.args,
            self.nullable,
            self.ns,
        )

class AstTagRef(ASTNode):

    def __init__(self, path, lineno, lexpos, tag):
        """
        Args:
            tag (str): Name of the referenced type.
        """
        super().__init__(path, lineno, lexpos)
        self.tag = tag

    def __repr__(self):
        return 'AstTagRef({!r})'.format(
            self.tag,
        )

class AstAnnotationRef(ASTNode):

    def __init__(self, path, lineno, lexpos, annotation, ns):
        """
        Args:
            annotation (str): Name of the referenced annotation.
        """
        super().__init__(path, lineno, lexpos)
        self.annotation = annotation
        self.ns = ns

    def __repr__(self):
        return 'AstAnnotationRef({!r}, {!r})'.format(
            self.annotation, self.ns
        )

class AstAnnotationDef(ASTNode):

    def __init__(self, path, lineno, lexpos, name, annotation_type,
                 annotation_type_ns, args, kwargs):
        """
        Args:
            name (str): Name of the defined annotation.
            annotation_type (str): Type of annotation to define.
            annotation_type_ns (Optional[str]): Namespace where the annotation
              type was defined. If None, current namespace or builtin.
            args (str): Arguments to define annotation.
            kwargs (str): Keyword Arguments to define annotation.
        """
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.annotation_type = annotation_type
        self.annotation_type_ns = annotation_type_ns
        self.args = args
        self.kwargs = kwargs

    def __repr__(self):
        return 'AstAnnotationDef({!r}, {!r}, {!r}, {!r}, {!r})'.format(
            self.name,
            self.annotation_type,
            self.annotation_type_ns,
            self.args,
            self.kwargs,
        )

class AstAnnotationTypeDef(ASTNode):

    def __init__(self, path, lineno, lexpos, name, doc, params):
        """
        Args:
            name (str): Name of the defined annotation type.
            doc (str): Docstring for the defined annotation type.
            params (List[AstField]): Parameters that can be passed to the
                annotation type.
        """
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.doc = doc
        self.params = params

    def __repr__(self):
        return 'AstAnnotationTypeDef({!r}, {!r}, {!r})'.format(
            self.name,
            self.doc,
            self.params,
        )

class AstField(ASTNode):
    """
    Represents both a field of a struct and a field of a union.
    TODO(kelkabany): Split this into two different classes.
    """

    def __init__(self, path, lineno, lexpos, name, type_ref):
        """
        Args:
            name (str): The name of the field.
            type_ref (AstTypeRef): The data type of the field.
        """
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.type_ref = type_ref
        self.doc = None
        self.has_default = False
        self.default = None
        self.annotations = []

    def set_doc(self, docstring):
        self.doc = docstring

    def set_default(self, default):
        self.has_default = True
        self.default = default

    def set_annotations(self, annotations):
        self.annotations = annotations

    def __repr__(self):
        return 'AstField({!r}, {!r}, {!r})'.format(
            self.name,
            self.type_ref,
            self.annotations,
        )

class AstVoidField(ASTNode):

    def __init__(self, path, lineno, lexpos, name):
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.doc = None
        self.annotations = []

    def set_doc(self, docstring):
        self.doc = docstring

    def set_annotations(self, annotations):
        self.annotations = annotations

    def __str__(self):
        return self.__repr__()

    def __repr__(self):
        return 'AstVoidField({!r}, {!r})'.format(
            self.name,
            self.annotations,
        )

class AstSubtypeField(ASTNode):

    def __init__(self, path, lineno, lexpos, name, type_ref):
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.type_ref = type_ref

    def __repr__(self):
        return 'AstSubtypeField({!r}, {!r})'.format(
            self.name,
            self.type_ref,
        )

class AstRouteDef(ASTNode):

    def __init__(self, path, lineno, lexpos, name, version, deprecated,
                 arg_type_ref, result_type_ref, error_type_ref=None):
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.version = version
        self.deprecated = deprecated
        self.arg_type_ref = arg_type_ref
        self.result_type_ref = result_type_ref
        self.error_type_ref = error_type_ref
        self.doc = None
        self.attrs = {}

    def set_doc(self, docstring):
        self.doc = docstring

    def set_attrs(self, attrs):
        self.attrs = attrs

class AstAttrField(ASTNode):

    def __init__(self, path, lineno, lexpos, name, value):
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.value = value

    def __repr__(self):
        return 'AstAttrField({!r}, {!r})'.format(
            self.name,
            self.value,
        )

class AstExample(ASTNode):

    def __init__(self, path, lineno, lexpos, label, text, fields):
        super().__init__(path, lineno, lexpos)
        self.label = label
        self.text = text
        self.fields = fields

    def __repr__(self):
        return 'AstExample({!r}, {!r}, {!r})'.format(
            self.label,
            self.text,
            self.fields,
        )

class AstExampleField(ASTNode):

    def __init__(self, path, lineno, lexpos, name, value):
        super().__init__(path, lineno, lexpos)
        self.name = name
        self.value = value

    def __repr__(self):
        return 'AstExampleField({!r}, {!r})'.format(
            self.name,
            self.value,
        )

class AstExampleRef(ASTNode):

    def __init__(self, path, lineno, lexpos, label):
        super().__init__(path, lineno, lexpos)
        self.label = label

    def __repr__(self):
        return 'AstExampleRef({!r})'.format(self.label)
