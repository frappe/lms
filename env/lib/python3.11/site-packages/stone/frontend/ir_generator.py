import copy
import logging
from collections import defaultdict
from inspect import isclass

try:
    from inspect import getfullargspec as get_args
except ImportError:
    from inspect import getargspec as get_args  # type: ignore

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

import re

from ..ir import (
    Alias,
    AnnotationType,
    AnnotationTypeParam,
    Api,
    ApiNamespace,
    ApiRoute,
    ApiRoutesByVersion,
    Boolean,
    Bytes,
    CustomAnnotation,
    DataType,
    Deprecated,
    DeprecationInfo,
    Float32,
    Float64,
    Int32,
    Int64,
    is_alias,
    is_composite_type,
    is_field_type,
    is_list_type,
    is_map_type,
    is_nullable_type,
    is_primitive_type,
    is_struct_type,
    is_user_defined_type,
    is_union_type,
    is_void_type,
    List,
    Map,
    Nullable,
    Omitted,
    Preview,
    ParameterError,
    RedactedBlot,
    RedactedHash,
    String,
    Struct,
    StructField,
    TagRef,
    Timestamp,
    UInt32,
    UInt64,
    Union,
    UnionField,
    UserDefined,
    Void,
    unwrap_aliases,
    unwrap_nullable,
)

from .exception import InvalidSpec
from .ast import (
    AstAlias,
    AstAnnotationDef,
    AstAnnotationTypeDef,
    AstImport,
    AstNamespace,
    AstRouteDef,
    AstStructDef,
    AstStructPatch,
    AstTagRef,
    AstTypeDef,
    AstTypeRef,
    AstUnionDef,
    AstUnionPatch,
    AstVoidField,
)

def quote(s):
    assert s.replace('_', '').replace('.', '').replace('/', '').isalnum(), \
        'Only use quote() with names or IDs in Stone.'
    return "'%s'" % s

def parse_data_types_from_doc_ref(api, doc, namespace_context, ignore_missing_entries=False):
    """
    Given a documentation string, parse it and return all references to other
    data types. If there are references to routes, include also the data types of
    those routes.

    Args:
    - api: The API containing this doc ref.
    - doc: The documentation string to parse.
    - namespace_context: The namespace name relative to this documentation.
    - ignore_missing_entries: If set, this will skip references to nonexistent data types instead
                              of raising an exception.

    Returns:
    - a list of referenced data types
    """
    output = []
    data_types, routes_by_ns = parse_data_types_and_routes_from_doc_ref(
        api, doc, namespace_context, ignore_missing_entries=ignore_missing_entries)
    for d in data_types:
        output.append(d)
    for ns_name, routes in routes_by_ns.items():
        try:
            ns = api.namespaces[ns_name]
            for r in routes:
                for d in ns.get_route_io_data_types_for_route(r):
                    output.append(d)
        except KeyError:
            if not ignore_missing_entries:
                raise
    return output

def parse_route_name_and_version(route_repr):
    """
    Parse a route representation string and return the route name and version number.

    :param route_repr: Route representation string.

    :return: A tuple containing route name and version number.
    """
    if ':' in route_repr:
        route_name, version = route_repr.split(':', 1)
        try:
            version = int(version)
        except ValueError:
            raise ValueError('Invalid route representation: {}'.format(route_repr))
    else:
        route_name = route_repr
        version = 1
    return route_name, version

def parse_data_types_and_routes_from_doc_ref(
    api,
    doc,
    namespace_context,
    ignore_missing_entries=False
):
    """
    Given a documentation string, parse it and return all references to other
    data types and routes.

    Args:
    - api: The API containing this doc ref.
    - doc: The documentation string to parse.
    - namespace_context: The namespace name relative to this documentation.
    - ignore_missing_entries: If set, this will skip references to nonexistent data types instead
                              of raising an exception.

    Returns:
    - a tuple of referenced data types and routes
    """
    assert doc is not None
    data_types = set()
    routes = defaultdict(set)

    for match in doc_ref_re.finditer(doc):
        try:
            tag = match.group('tag')
            val = match.group('val')
            supplied_namespace = api.namespaces[namespace_context]
            if tag == 'field':
                if '.' in val:
                    type_name, __ = val.split('.', 1)
                    doc_type = supplied_namespace.data_type_by_name[type_name]
                    data_types.add(doc_type)
                else:
                    pass  # no action required, because we must be referencing the same object
            elif tag == 'route':
                if '.' in val:
                    namespace_name, val = val.split('.', 1)
                    namespace = api.namespaces[namespace_name]
                else:
                    namespace = supplied_namespace

                try:
                    route_name, version = parse_route_name_and_version(val)
                except ValueError as ex:
                    raise KeyError(str(ex))

                route = namespace.routes_by_name[route_name].at_version[version]
                routes[namespace.name].add(route)
            elif tag == 'type':
                if '.' in val:
                    namespace_name, val = val.split('.', 1)
                    doc_type = api.namespaces[namespace_name].data_type_by_name[val]
                    data_types.add(doc_type)
                else:
                    doc_type = supplied_namespace.data_type_by_name[val]
                    data_types.add(doc_type)
        except KeyError:
            if not ignore_missing_entries:
                raise
    return data_types, routes

# Patterns for references in documentation
doc_ref_re = re.compile(r':(?P<tag>[A-z]+):`(?P<val>.*?)`')
doc_ref_val_re = re.compile(
    r'^(null|true|false|-?\d+(\.\d*)?(e-?\d+)?|"[^\\"]*")$')

# Defined Annotations
BUILTIN_ANNOTATION_CLASS_BY_STRING = {
    'Deprecated': Deprecated,
    'Omitted': Omitted,
    'Preview': Preview,
    'RedactedBlot': RedactedBlot,
    'RedactedHash': RedactedHash,
}


class Environment(dict):
    # The default environment won't have a name set since it applies to all
    # namespaces. But, every time it's copied to represent the environment
    # of a specific namespace, a name should be set.
    namespace_name = None  # type: typing.Optional[typing.Text]


class IRGenerator:

    data_types = [
        Bytes,
        Boolean,
        Float32,
        Float64,
        Int32,
        Int64,
        List,
        Map,
        String,
        Timestamp,
        UInt32,
        UInt64,
        Void,
    ]

    default_env = Environment(
        **{data_type.__name__: data_type for data_type in data_types})

    # FIXME: Version should not have a default.
    def __init__(self, partial_asts, version, debug=False, route_whitelist_filter=None):
        """Creates a new tower of stone.

        :type specs: List[Tuple[path: str, text: str]]
        :param specs: `path` is never accessed and is only used to report the
            location of a bad spec to the user. `spec` is the text contents of
            a spec (.stone) file.
        """

        self._partial_asts = partial_asts
        self._debug = debug
        self._logger = logging.getLogger('stone.idl')

        self.api = Api(version=version)

        # Map of namespace name (str) -> environment (dict)
        self._env_by_namespace = {}
        # Used to check for circular references.
        self._resolution_in_progress = set()  # Set[DataType]

        self._item_by_canonical_name = {}

        self._patch_data_by_canonical_name = {}

        self._routes = route_whitelist_filter

    def generate_IR(self):
        """Parses the text of each spec and returns an API description. Returns
        None if an error was encountered during parsing."""

        raw_api = []
        for partial_ast in self._partial_asts:
            namespace_ast_node = self._extract_namespace_ast_node(partial_ast)
            namespace = self.api.ensure_namespace(namespace_ast_node.name)
            base_name = self._get_base_name(namespace.name, namespace.name)
            self._item_by_canonical_name[base_name] = namespace_ast_node
            if namespace_ast_node.doc is not None:
                namespace.add_doc(namespace_ast_node.doc)
            raw_api.append((namespace, partial_ast))
            self._add_data_types_and_routes_to_api(namespace, partial_ast)

        self._add_imports_to_env(raw_api)
        self._merge_patches()
        self._populate_type_attributes()
        self._populate_field_defaults()
        self._populate_enumerated_subtypes()
        self._populate_route_attributes()
        self._populate_recursive_custom_annotations()
        self._populate_examples()
        self._validate_doc_refs()
        self._validate_annotations()
        if self._routes is not None:
            self._filter_namespaces_by_route_whitelist()

        self.api.normalize()

        return self.api

    def _extract_namespace_ast_node(self, desc):
        """
        Checks that the namespace is declared first in the spec, and that only
        one namespace is declared.

        Args:
            desc (List[stone.stone.parser.ASTNode]): All AST nodes in a spec
                file in the order they were defined.

        Return:
            stone.frontend.ast.AstNamespace: The namespace AST node.
        """
        if len(desc) == 0 or not isinstance(desc[0], AstNamespace):
            if self._debug:
                self._logger.info('Description: %r', desc)
            raise InvalidSpec('First declaration in a stone must be '
                              'a namespace. Possibly caused by preceding '
                              'errors.', desc[0].lineno, desc[0].path)
        for item in desc[1:]:
            if isinstance(item, AstNamespace):
                raise InvalidSpec('Only one namespace declaration per file.',
                                  item[0].lineno, item[0].path)
        return desc.pop(0)

    def _add_data_types_and_routes_to_api(self, namespace, desc):
        """
        From the raw output of the parser, create forward references for each
        user-defined type (struct, union, route, and alias).

        Args:
            namespace (stone.api.Namespace): Namespace for definitions.
            desc (List[stone.stone.parser._Element]): All AST nodes in a spec
                file in the order they were defined. Should not include a
                namespace declaration.
        """

        env = self._get_or_create_env(namespace.name)

        for item in desc:
            if isinstance(item, AstTypeDef):
                api_type = self._create_type(env, item)
                namespace.add_data_type(api_type)
                self._check_canonical_name_available(item, namespace.name)
            elif isinstance(item, AstStructPatch) or isinstance(item, AstUnionPatch):
                # Handle patches later.
                base_name = self._get_base_name(item.name, namespace.name)
                self._patch_data_by_canonical_name[base_name] = (item, namespace)
            elif isinstance(item, AstRouteDef):
                route = self._create_route(env, item)
                namespace.add_route(route)
                self._check_canonical_name_available(item, namespace.name, allow_duplicate=True)
            elif isinstance(item, AstImport):
                # Handle imports later.
                pass
            elif isinstance(item, AstAlias):
                alias = self._create_alias(env, item)
                namespace.add_alias(alias)
                self._check_canonical_name_available(item, namespace.name)
            elif isinstance(item, AstAnnotationDef):
                annotation = self._create_annotation(env, item)
                namespace.add_annotation(annotation)
                self._check_canonical_name_available(item, namespace.name)
            elif isinstance(item, AstAnnotationTypeDef):
                annotation_type = self._create_annotation_type(env, item)
                namespace.add_annotation_type(annotation_type)
                self._check_canonical_name_available(item, namespace.name)
            else:
                raise AssertionError('Unknown AST node type %r' %
                                     item.__class__.__name__)

    # TODO(peichao): the name conflict checking can be merged to _create_* functions using env.
    def _check_canonical_name_available(self, item, namespace_name, allow_duplicate=False):
        base_name = self._get_base_name(item.name, namespace_name)

        if base_name not in self._item_by_canonical_name:
            self._item_by_canonical_name[base_name] = item
        else:
            stored_item = self._item_by_canonical_name[base_name]

            is_conflict_between_same_type = item.__class__ == stored_item.__class__

            # Allow name conflicts between items of the same type when allow_duplicate is True
            if not is_conflict_between_same_type or not allow_duplicate:
                msg = ("Name of %s '%s' conflicts with name of "
                       "%s '%s' (%s:%s).") % (
                    self._get_user_friendly_item_type_as_string(item),
                    item.name,
                    self._get_user_friendly_item_type_as_string(stored_item),
                    stored_item.name,
                    stored_item.path, stored_item.lineno)

                raise InvalidSpec(msg, item.lineno, item.path)

    @classmethod
    def _get_user_friendly_item_type_as_string(cls, item):
        if isinstance(item, AstTypeDef):
            return 'user-defined type'
        elif isinstance(item, AstRouteDef):
            return 'route'
        elif isinstance(item, AstAlias):
            return 'alias'
        elif isinstance(item, AstNamespace):
            return 'namespace'
        elif isinstance(item, AstAnnotationTypeDef):
            return 'annotation type'
        else:
            raise AssertionError('unhandled type %r' % item)

    def _get_base_name(self, input_str, namespace_name):
        return (input_str.replace('_', '').replace('/', '').lower() +
                namespace_name.replace('_', '').lower())

    def _add_imports_to_env(self, raw_api):
        """
        Scans raw parser output for import declarations. Checks if the imports
        are valid, and then creates a reference to the namespace in the
        environment.

        Args:
            raw_api (Tuple[Namespace, List[stone.stone.parser._Element]]):
                Namespace paired with raw parser output.
        """
        for namespace, desc in raw_api:
            for item in desc:
                if isinstance(item, AstImport):
                    if namespace.name == item.target:
                        raise InvalidSpec('Cannot import current namespace.',
                                          item.lineno, item.path)
                    if item.target not in self.api.namespaces:
                        raise InvalidSpec(
                            'Namespace %s is not defined in any spec.' %
                            quote(item.target),
                            item.lineno, item.path)
                    env = self._get_or_create_env(namespace.name)
                    imported_env = self._get_or_create_env(item.target)
                    if namespace.name in imported_env:
                        # Block circular imports. The Python backend can't
                        # easily generate code for circular references.
                        raise InvalidSpec(
                            'Circular import of namespaces %s and %s '
                            'detected.' %
                            (quote(namespace.name), quote(item.target)),
                            item.lineno, item.path)
                    env[item.target] = imported_env

    def _create_alias(self, env, item):
        # NOTE: I don't like supporting forward references for aliases
        # because it makes specs harder to read. But we have to so that if a
        # namespace is split across multiple files, the order they're specified
        # in the command line which affects alias ordering is irrelevant.
        if item.name in env:
            existing_dt = env[item.name]
            raise InvalidSpec(
                'Symbol %s already defined (%s:%d).' %
                (quote(item.name), existing_dt._ast_node.path,
                existing_dt._ast_node.lineno), item.lineno, item.path)

        namespace = self.api.ensure_namespace(env.namespace_name)
        alias = Alias(item.name, namespace, item)

        env[item.name] = alias
        return alias

    def _create_annotation(self, env, item):
        if item.name in env:
            existing_dt = env[item.name]
            raise InvalidSpec(
                'Symbol %s already defined (%s:%d).' %
                (quote(item.name), existing_dt._ast_node.path,
                existing_dt._ast_node.lineno), item.lineno, item.path)

        namespace = self.api.ensure_namespace(env.namespace_name)

        if item.args and item.kwargs:
            raise InvalidSpec(
                'Annotations accept either positional or keyword arguments, not both',
                item.lineno, item.path,
            )

        if ((item.annotation_type_ns is None)
                and (item.annotation_type in BUILTIN_ANNOTATION_CLASS_BY_STRING)):
            annotation_class = BUILTIN_ANNOTATION_CLASS_BY_STRING[item.annotation_type]
            annotation = annotation_class(item.name, namespace, item, *item.args, **item.kwargs)
        else:
            if item.annotation_type_ns is not None:
                namespace.add_imported_namespace(
                    self.api.ensure_namespace(item.annotation_type_ns),
                    imported_annotation_type=True)

            annotation = CustomAnnotation(item.name, namespace, item,
                item.annotation_type, item.annotation_type_ns, item.args,
                item.kwargs)

        env[item.name] = annotation
        return annotation

    def _create_annotation_type(self, env, item):
        if item.name in env:
            existing_dt = env[item.name]
            raise InvalidSpec(
                'Symbol %s already defined (%s:%d).' %
                (quote(item.name), existing_dt._ast_node.path,
                existing_dt._ast_node.lineno), item.lineno, item.path)

        namespace = self.api.ensure_namespace(env.namespace_name)

        if item.name in BUILTIN_ANNOTATION_CLASS_BY_STRING:
            raise InvalidSpec('Cannot redefine built-in annotation type %s.' %
                              (quote(item.name), ), item.lineno, item.path)

        params = []
        for param in item.params:
            if param.annotations:
                raise InvalidSpec(
                    'Annotations cannot be applied to parameters of annotation types',
                    param.lineno, param.path)
            param_type = self._resolve_type(env, param.type_ref, True)
            dt, nullable_dt = unwrap_nullable(param_type)

            if isinstance(dt, Void):
                raise InvalidSpec(
                    'Parameter {} cannot be Void.'.format(quote(param.name)),
                    param.lineno, param.path)
            if nullable_dt and param.has_default:
                raise InvalidSpec(
                    'Parameter {} cannot be a nullable type and have '
                    'a default specified.'.format(quote(param.name)),
                    param.lineno, param.path)
            if not is_primitive_type(dt):
                raise InvalidSpec(
                    'Parameter {} must have a primitive type (possibly '
                    'nullable).'.format(quote(param.name)),
                    param.lineno, param.path)

            params.append(AnnotationTypeParam(param.name, param_type, param.doc,
                param.has_default, param.default, param))

        annotation_type = AnnotationType(item.name, namespace, item.doc, params)

        env[item.name] = annotation_type
        return annotation_type

    def _create_type(self, env, item):
        """Create a forward reference for a union or struct."""
        if item.name in env:
            existing_dt = env[item.name]
            raise InvalidSpec(
                'Symbol %s already defined (%s:%d).' %
                (quote(item.name), existing_dt._ast_node.path,
                 existing_dt._ast_node.lineno), item.lineno, item.path)
        namespace = self.api.ensure_namespace(env.namespace_name)
        if isinstance(item, AstStructDef):
            try:
                api_type = Struct(name=item.name, namespace=namespace,
                                  ast_node=item)
            except ParameterError as e:
                raise InvalidSpec(
                    'Bad declaration of {}: {}'.format(quote(item.name), e.args[0]),
                    item.lineno, item.path)
        elif isinstance(item, AstUnionDef):
            api_type = Union(
                name=item.name, namespace=namespace, ast_node=item,
                closed=item.closed)
        else:
            raise AssertionError('Unknown type definition %r' % type(item))

        env[item.name] = api_type
        return api_type

    def _merge_patches(self):
        """Injects object patches into their original object definitions."""
        for patched_item, patched_namespace in self._patch_data_by_canonical_name.values():
            patched_item_base_name = self._get_base_name(patched_item.name, patched_namespace.name)
            if patched_item_base_name not in self._item_by_canonical_name:
                raise InvalidSpec('Patch {} must correspond to a pre-existing data_type.'.format(
                    quote(patched_item.name)), patched_item.lineno, patched_item.path)

            existing_item = self._item_by_canonical_name[patched_item_base_name]

            self._check_patch_type_mismatch(patched_item, existing_item)

            if isinstance(patched_item, (AstStructPatch, AstUnionPatch)):
                self._check_field_names_unique(existing_item, patched_item)
                existing_item.fields += patched_item.fields
                self._inject_patched_examples(existing_item, patched_item)
            else:
                raise AssertionError('Unknown Patch Object Type {}'.format(
                    patched_item.__class__.__name__))

    def _check_patch_type_mismatch(self, patched_item, existing_item):
        """Enforces that each patch has a corresponding, already-defined data type."""
        def raise_mismatch_error(patched_item, existing_item, data_type_name):
            error_msg = ('Type mismatch. Patch {} corresponds to pre-existing '
                'data_type {} ({}:{}) that has type other than {}.')
            raise InvalidSpec(error_msg.format(
                quote(patched_item.name),
                quote(existing_item.name),
                existing_item.path,
                existing_item.lineno,
                quote(data_type_name)), patched_item.lineno, patched_item.path)

        if isinstance(patched_item, AstStructPatch):
            if not isinstance(existing_item, AstStructDef):
                raise_mismatch_error(patched_item, existing_item, 'struct')
        elif isinstance(patched_item, AstUnionPatch):
            if not isinstance(existing_item, AstUnionDef):
                raise_mismatch_error(patched_item, existing_item, 'union')
            else:
                if existing_item.closed != patched_item.closed:
                    raise_mismatch_error(
                        patched_item, existing_item,
                        'union_closed' if existing_item.closed else 'union')
        else:
            raise AssertionError(
                'Unknown Patch Object Type {}'.format(patched_item.__class__.__name__))

    def _check_field_names_unique(self, existing_item, patched_item):
        """Enforces that patched fields don't already exist."""
        existing_fields_by_name = {f.name: f for f in existing_item.fields}
        for patched_field in patched_item.fields:
            if patched_field.name in existing_fields_by_name.keys():
                existing_field = existing_fields_by_name[patched_field.name]
                raise InvalidSpec('Patched field {} overrides pre-existing field in {} ({}:{}).'
                    .format(quote(patched_field.name),
                            quote(patched_item.name),
                            existing_field.path,
                            existing_field.lineno), patched_field.lineno, patched_field.path)

    def _inject_patched_examples(self, existing_item, patched_item):
        """Injects patched examples into original examples."""
        for key, _ in patched_item.examples.items():
            patched_example = patched_item.examples[key]
            existing_examples = existing_item.examples
            if key in existing_examples:
                existing_examples[key].fields.update(patched_example.fields)
            else:
                error_msg = 'Example defined in patch {} must correspond to a pre-existing example.'
                raise InvalidSpec(error_msg.format(
                    quote(patched_item.name)), patched_example.lineno, patched_example.path)

    def _populate_type_attributes(self):
        """
        Converts each struct, union, and route from a forward reference to a
        full definition.
        """
        for namespace in self.api.namespaces.values():
            env = self._get_or_create_env(namespace.name)

            # do annotations before everything else, since populating aliases
            # and datatypes involves setting annotations
            for annotation in namespace.annotations:
                if isinstance(annotation, CustomAnnotation):
                    loc = annotation._ast_node.lineno, annotation._ast_node.path
                    if annotation.annotation_type_ns:
                        if annotation.annotation_type_ns not in env:
                            raise InvalidSpec(
                                'Namespace %s is not imported' %
                                quote(annotation.annotation_type_ns), *loc)
                        annotation_type_env = env[annotation.annotation_type_ns]
                        if not isinstance(annotation_type_env, Environment):
                            raise InvalidSpec(
                                '%s is not a namespace.' %
                                quote(annotation.annotation_type_ns), *loc)
                    else:
                        annotation_type_env = env

                    if annotation.annotation_type_name not in annotation_type_env:
                        raise InvalidSpec(
                            'Annotation type %s does not exist' %
                            quote(annotation.annotation_type_name), *loc)

                    annotation_type = annotation_type_env[annotation.annotation_type_name]

                    if not isinstance(annotation_type, AnnotationType):
                        raise InvalidSpec(
                            '%s is not an annotation type' % quote(annotation.annotation_type_name),
                            *loc
                        )

                    annotation.set_attributes(annotation_type)

            for alias in namespace.aliases:
                data_type = self._resolve_type(env, alias._ast_node.type_ref)
                alias.set_attributes(alias._ast_node.doc, data_type)
                annotations = [self._resolve_annotation_type(env, annotation)
                               for annotation in alias._ast_node.annotations]
                alias.set_annotations(annotations)

            for data_type in namespace.data_types:
                if not data_type._is_forward_ref:
                    continue

                self._resolution_in_progress.add(data_type)
                if isinstance(data_type, Struct):
                    self._populate_struct_type_attributes(env, data_type)
                elif isinstance(data_type, Union):
                    self._populate_union_type_attributes(env, data_type)
                else:
                    raise AssertionError('Unhandled type: %r' %
                                         type(data_type))
                self._resolution_in_progress.remove(data_type)

        assert len(self._resolution_in_progress) == 0

    def _populate_struct_type_attributes(self, env, data_type):
        """
        Converts a forward reference of a struct into a complete definition.
        """
        parent_type = None
        extends = data_type._ast_node.extends
        if extends:
            # A parent type must be fully defined and not just a forward
            # reference.
            parent_type = self._resolve_type(env, extends, True)
            if isinstance(parent_type, Alias):
                # Restrict extending aliases because it's difficult to generate
                # code for it in Python. We put all type references at the end
                # to avoid out-of-order declaration issues, but using "extends"
                # in Python forces the reference to happen earlier.
                raise InvalidSpec(
                    'A struct cannot extend an alias. '
                    'Use the canonical name instead.',
                    data_type._ast_node.lineno, data_type._ast_node.path)
            if isinstance(parent_type, Nullable):
                raise InvalidSpec(
                    'A struct cannot extend a nullable type.',
                    data_type._ast_node.lineno, data_type._ast_node.path)
            if not isinstance(parent_type, Struct):
                raise InvalidSpec(
                    'A struct can only extend another struct: '
                    '%s is not a struct.' % quote(parent_type.name),
                    data_type._ast_node.lineno, data_type._ast_node.path)
        api_type_fields = []
        for stone_field in data_type._ast_node.fields:
            api_type_field = self._create_struct_field(env, stone_field)
            api_type_fields.append(api_type_field)
        data_type.set_attributes(
            data_type._ast_node.doc, api_type_fields, parent_type)

    def _populate_union_type_attributes(self, env, data_type):
        """
        Converts a forward reference of a union into a complete definition.
        """
        parent_type = None
        extends = data_type._ast_node.extends
        if extends:
            # A parent type must be fully defined and not just a forward
            # reference.
            parent_type = self._resolve_type(env, extends, True)
            if isinstance(parent_type, Alias):
                raise InvalidSpec(
                    'A union cannot extend an alias. '
                    'Use the canonical name instead.',
                    data_type._ast_node.lineno, data_type._ast_node.path)
            if isinstance(parent_type, Nullable):
                raise InvalidSpec(
                    'A union cannot extend a nullable type.',
                    data_type._ast_node.lineno, data_type._ast_node.path)
            if not isinstance(parent_type, Union):
                raise InvalidSpec(
                    'A union can only extend another union: '
                    '%s is not a union.' % quote(parent_type.name),
                    data_type._ast_node.lineno, data_type._ast_node.path)

        api_type_fields = []
        for stone_field in data_type._ast_node.fields:
            if stone_field.name == 'other':
                raise InvalidSpec(
                    "Union cannot define an 'other' field because it is "
                    "reserved as the catch-all field for open unions.",
                    stone_field.lineno, stone_field.path)
            api_type_fields.append(self._create_union_field(env, stone_field))

        catch_all_field = None
        if data_type.closed:
            if parent_type and not parent_type.closed:
                # Due to the reversed super type / child type relationship for
                # unions, a child type cannot be closed if its parent is open
                # because the parent now has an extra field that is not
                # recognized by the child if it were substituted in for it.
                raise InvalidSpec(
                    "Union cannot be closed since parent type '%s' is open." % (
                        parent_type.name),
                    data_type._ast_node.lineno, data_type._ast_node.path)
        else:
            if not parent_type or parent_type.closed:
                # Create a catch-all field
                catch_all_field = UnionField(
                    name='other', data_type=Void(), doc=None,
                    ast_node=data_type._ast_node, catch_all=True)
                api_type_fields.append(catch_all_field)

        data_type.set_attributes(
            data_type._ast_node.doc, api_type_fields, parent_type, catch_all_field)

    def _populate_recursive_custom_annotations(self):
        """
        Populates custom annotations applied to fields recursively. This is done in
        a separate pass because it requires all fields and routes to be defined so that
        recursive chains can be followed accurately.
        """
        data_types_seen = set()

        def recurse(data_type):
            # primitive types do not have annotations
            if not is_composite_type(data_type):
                return set()

            # if we have already analyzed data type, just return result
            if data_type.recursive_custom_annotations is not None:
                return data_type.recursive_custom_annotations

            # handle cycles safely (annotations will be found first time at top level)
            if data_type in data_types_seen:
                return set()
            data_types_seen.add(data_type)

            annotations = set()

            if is_struct_type(data_type) or is_union_type(data_type):
                # collect custom annotations from ancestor data types
                if data_type.parent_type:
                    annotations.update(recurse(data_type.parent_type))
                # collct custom annotations from nested data types
                for field in data_type.fields:
                    annotations.update(recurse(field.data_type))
                    # annotations can be defined directly on fields
                    annotations.update([(field, annotation)
                                        for annotation in field.custom_annotations])
            elif is_alias(data_type):
                annotations.update(recurse(data_type.data_type))
                # annotations can be defined directly on aliases
                annotations.update([(data_type, annotation)
                                    for annotation in data_type.custom_annotations])
            elif is_list_type(data_type):
                annotations.update(recurse(data_type.data_type))
            elif is_map_type(data_type):
                # only map values support annotations for now
                annotations.update(recurse(data_type.value_data_type))
            elif is_nullable_type(data_type):
                annotations.update(recurse(data_type.data_type))

            data_type.recursive_custom_annotations = annotations
            return annotations

        for namespace in self.api.namespaces.values():
            namespace_annotations = set()
            for data_type in namespace.data_types:
                namespace_annotations.update(recurse(data_type))

            for alias in namespace.aliases:
                namespace_annotations.update(recurse(alias))

            for route in namespace.routes:
                namespace_annotations.update(recurse(route.arg_data_type))
                namespace_annotations.update(recurse(route.result_data_type))
                namespace_annotations.update(recurse(route.error_data_type))

            # record annotation types as dependencies of the namespace. this allows for
            # an optimization when processing custom annotations to ignore annotation
            # types that are not applied to the data type, rather than recursing into it
            for _, annotation in namespace_annotations:
                if annotation.annotation_type.namespace.name != namespace.name:
                    namespace.add_imported_namespace(
                        annotation.annotation_type.namespace,
                        imported_annotation_type=True)

    def _populate_field_defaults(self):
        """
        Populate the defaults of each field. This is done in a separate pass
        because defaults that specify a union tag require the union to have
        been defined.
        """
        for namespace in self.api.namespaces.values():
            for data_type in namespace.data_types:
                # Only struct fields can have default
                if not isinstance(data_type, Struct):
                    continue

                for field in data_type.fields:
                    if not field._ast_node.has_default:
                        continue

                    if isinstance(field._ast_node.default, AstTagRef):
                        default_value = TagRef(
                            field.data_type, field._ast_node.default.tag)
                    else:
                        default_value = field._ast_node.default
                    if not (field._ast_node.type_ref.nullable and default_value is None):
                        # Verify that the type of the default value is correct for this field
                        try:
                            if field.data_type.name in ('Float32', 'Float64'):
                                # You can assign int to the default value of float type
                                # However float type should always have default value in float
                                default_value = float(default_value)
                            field.data_type.check(default_value)
                        except ValueError as e:
                            raise InvalidSpec(
                                'Field %s has an invalid default: %s' %
                                (quote(field._ast_node.name), e),
                                field._ast_node.lineno, field._ast_node.path)
                    field.set_default(default_value)

    def _populate_route_attributes(self):
        """
        Converts all routes from forward references to complete definitions.
        """
        route_schema = self._validate_stone_cfg()
        self.api.add_route_schema(route_schema)
        for namespace in self.api.namespaces.values():
            env = self._get_or_create_env(namespace.name)
            for route in namespace.routes:
                self._populate_route_attributes_helper(env, route, route_schema)

    def _populate_route_attributes_helper(self, env, route, schema):
        """
        Converts a single forward reference of a route into a complete definition.
        """
        arg_dt = self._resolve_type(env, route._ast_node.arg_type_ref)
        result_dt = self._resolve_type(env, route._ast_node.result_type_ref)
        error_dt = self._resolve_type(env, route._ast_node.error_type_ref)

        ast_deprecated = route._ast_node.deprecated
        if ast_deprecated:
            assert ast_deprecated[0]
            new_route_name = ast_deprecated[1]
            new_route_version = ast_deprecated[2]
            if new_route_name:
                assert new_route_version

                is_not_defined = False
                is_not_route = False
                if new_route_name in env:
                    if isinstance(env[new_route_name], ApiRoutesByVersion):
                        if new_route_version not in env[new_route_name].at_version:
                            is_not_defined = True
                    else:
                        is_not_route = True
                else:
                    is_not_defined = True

                if is_not_defined:
                    raise InvalidSpec(
                        'Undefined route %s at version %d.' % (
                            quote(new_route_name), new_route_version),
                        route._ast_node.lineno, route._ast_node.path)

                if is_not_route:
                    raise InvalidSpec(
                        '%s must be a route.' % quote(new_route_name),
                        route._ast_node.lineno, route._ast_node.path)

                new_route = env[new_route_name].at_version[new_route_version]
                deprecated = DeprecationInfo(new_route)
            else:
                deprecated = DeprecationInfo()
        else:
            deprecated = None

        attr_by_name = {}
        for attr in route._ast_node.attrs:
            attr_by_name[attr.name] = attr

        try:
            validated_attrs = schema.check_attr_repr(attr_by_name)
        except KeyError as e:
            raise InvalidSpec(
                "Route does not define attr key '%s'." % e.args[0],
                route._ast_node.lineno, route._ast_node.path)

        route.set_attributes(
            deprecated=deprecated,
            doc=route._ast_node.doc,
            arg_data_type=arg_dt,
            result_data_type=result_dt,
            error_data_type=error_dt,
            attrs=validated_attrs)

    def _create_struct_field(self, env, stone_field):
        """
        This function resolves symbols to objects that we've instantiated in
        the current environment. For example, a field with data type named
        "String" is pointed to a String() object.

        The caller needs to ensure that this stone_field is for a Struct and not
        for a Union.

        Returns:
            stone.data_type.StructField: A field of a struct.
        """
        if isinstance(stone_field, AstVoidField):
            raise InvalidSpec(
                'Struct field %s cannot have a Void type.' %
                quote(stone_field.name),
                stone_field.lineno, stone_field.path)

        data_type = self._resolve_type(env, stone_field.type_ref)
        annotations = [self._resolve_annotation_type(env, annotation)
                       for annotation in stone_field.annotations]

        if isinstance(data_type, Void):
            raise InvalidSpec(
                'Struct field %s cannot have a Void type.' %
                quote(stone_field.name),
                stone_field.lineno, stone_field.path)
        elif isinstance(data_type, Nullable) and stone_field.has_default:
            raise InvalidSpec('Field %s cannot be a nullable '
                              'type and have a default specified.' %
                              quote(stone_field.name),
                              stone_field.lineno, stone_field.path)
        api_type_field = StructField(
            name=stone_field.name,
            data_type=data_type,
            doc=stone_field.doc,
            ast_node=stone_field,
        )
        api_type_field.set_annotations(annotations)
        return api_type_field

    def _create_union_field(self, env, stone_field):
        """
        This function resolves symbols to objects that we've instantiated in
        the current environment. For example, a field with data type named
        "String" is pointed to a String() object.

        The caller needs to ensure that this stone_field is for a Union and not
        for a Struct.

        Returns:
            stone.data_type.UnionField: A field of a union.
        """
        annotations = [self._resolve_annotation_type(env, annotation)
                       for annotation in stone_field.annotations]

        if isinstance(stone_field, AstVoidField):
            api_type_field = UnionField(
                name=stone_field.name, data_type=Void(), doc=stone_field.doc,
                ast_node=stone_field)
        else:
            data_type = self._resolve_type(env, stone_field.type_ref)
            if isinstance(data_type, Void):
                raise InvalidSpec('Union member %s cannot have Void '
                                  'type explicit, omit Void instead.' %
                                  quote(stone_field.name),
                                  stone_field.lineno, stone_field.path)
            api_type_field = UnionField(
                name=stone_field.name, data_type=data_type,
                doc=stone_field.doc, ast_node=stone_field)
        api_type_field.set_annotations(annotations)
        return api_type_field

    def _instantiate_data_type(self, data_type_class, data_type_args, loc):
        """
        Responsible for instantiating a data type with additional attributes.
        This method ensures that the specified attributes are valid.

        Args:
            data_type_class (DataType): The class to instantiate.
            data_type_attrs (dict): A map from str -> values of attributes.
                These will be passed into the constructor of data_type_class
                as keyword arguments.

        Returns:
            stone.data_type.DataType: A parameterized instance.
        """
        assert issubclass(data_type_class, DataType), \
            'Expected stone.data_type.DataType, got %r' % data_type_class

        argspec = get_args(data_type_class.__init__)  # noqa: E501 # pylint: disable=deprecated-method,useless-suppression
        argspec.args.remove('self')
        num_args = len(argspec.args)
        # Unfortunately, argspec.defaults is None if there are no defaults
        num_defaults = len(argspec.defaults or ())

        pos_args, kw_args = data_type_args

        if (num_args - num_defaults) > len(pos_args):
            # Report if a positional argument is missing
            raise InvalidSpec(
                'Missing positional argument %s for %s type' %
                (quote(argspec.args[len(pos_args)]),
                 quote(data_type_class.__name__)),
                *loc)
        elif (num_args - num_defaults) < len(pos_args):
            # Report if there are too many positional arguments
            raise InvalidSpec(
                'Too many positional arguments for %s type' %
                quote(data_type_class.__name__),
                *loc)

        # Map from arg name to bool indicating whether the arg has a default
        args = {}
        for i, key in enumerate(argspec.args):
            args[key] = (i >= num_args - num_defaults)

        for key in kw_args:
            # Report any unknown keyword arguments
            if key not in args:
                raise InvalidSpec('Unknown argument %s to %s type.' %
                    (quote(key), quote(data_type_class.__name__)),
                    *loc)
            # Report any positional args that are defined as keywords args.
            if not args[key]:
                raise InvalidSpec(
                    'Positional argument %s cannot be specified as a '
                    'keyword argument.' % quote(key),
                    *loc)
            del args[key]

        try:
            return data_type_class(*pos_args, **kw_args)
        except ParameterError as e:
            # Each data type validates its own attributes, and will raise a
            # ParameterError if the type or value is bad.
            raise InvalidSpec('Bad argument to %s type: %s' %
                (quote(data_type_class.__name__), e.args[0]),
                *loc)

    def _resolve_type(self, env, type_ref, enforce_fully_defined=False):
        """
        Resolves the data type referenced by type_ref.

        If `enforce_fully_defined` is True, then the referenced type must be
        fully populated (fields, parent_type, ...), and not simply a forward
        reference.
        """
        loc = type_ref.lineno, type_ref.path
        orig_namespace_name = env.namespace_name
        if type_ref.ns:
            # TODO(kelkabany): If a spec file imports a namespace, it is
            # available to all spec files that are part of the same namespace.
            # Might want to introduce the concept of an environment specific
            # to a file.
            if type_ref.ns not in env:
                raise InvalidSpec(
                    'Namespace %s is not imported' % quote(type_ref.ns), *loc)
            env = env[type_ref.ns]
            if not isinstance(env, Environment):
                raise InvalidSpec(
                    '%s is not a namespace.' % quote(type_ref.ns), *loc)
        if type_ref.name not in env:
            raise InvalidSpec(
                'Symbol %s is undefined.' % quote(type_ref.name), *loc)

        obj = env[type_ref.name]
        if obj is Void and type_ref.nullable:
            raise InvalidSpec('Void cannot be marked nullable.',
                              *loc)
        elif isclass(obj):
            resolved_data_type_args = self._resolve_args(env, type_ref.args)
            data_type = self._instantiate_data_type(
                obj, resolved_data_type_args, (type_ref.lineno, type_ref.path))
        elif isinstance(obj, ApiRoutesByVersion):
            raise InvalidSpec('A route cannot be referenced here.',
                              *loc)
        elif type_ref.args[0] or type_ref.args[1]:
            # An instance of a type cannot have any additional
            # attributes specified.
            raise InvalidSpec('Attributes cannot be specified for '
                              'instantiated type %s.' %
                              quote(type_ref.name),
                              *loc)
        else:
            data_type = env[type_ref.name]

        if type_ref.ns:
            # Add the source namespace as an import.
            namespace = self.api.ensure_namespace(orig_namespace_name)
            if isinstance(data_type, UserDefined):
                namespace.add_imported_namespace(
                    self.api.ensure_namespace(type_ref.ns),
                    imported_data_type=True)
            elif isinstance(data_type, Alias):
                namespace.add_imported_namespace(
                    self.api.ensure_namespace(type_ref.ns),
                    imported_alias=True)

        if (enforce_fully_defined and isinstance(data_type, UserDefined) and
                data_type._is_forward_ref):
            if data_type in self._resolution_in_progress:
                raise InvalidSpec(
                    'Unresolvable circular reference for type %s.' %
                    quote(type_ref.name), *loc)
            self._resolution_in_progress.add(data_type)
            if isinstance(data_type, Struct):
                self._populate_struct_type_attributes(env, data_type)
            elif isinstance(data_type, Union):
                self._populate_union_type_attributes(env, data_type)
            self._resolution_in_progress.remove(data_type)

        if type_ref.nullable:
            unwrapped_dt, _ = unwrap_aliases(data_type)
            if isinstance(unwrapped_dt, Nullable):
                raise InvalidSpec(
                    'Cannot mark reference to nullable type as nullable.',
                    *loc)
            data_type = Nullable(data_type)

        return data_type

    def _resolve_annotation_type(self, env, annotation_ref):
        """
        Resolves the annotation type referenced by annotation_ref.
        """
        loc = annotation_ref.lineno, annotation_ref.path
        if annotation_ref.ns:
            if annotation_ref.ns not in env:
                raise InvalidSpec(
                    'Namespace %s is not imported' % quote(annotation_ref.ns), *loc)
            env = env[annotation_ref.ns]
            if not isinstance(env, Environment):
                raise InvalidSpec(
                    '%s is not a namespace.' % quote(annotation_ref.ns), *loc)

        if annotation_ref.annotation not in env:
            raise InvalidSpec(
                'Annotation %s does not exist.' % quote(annotation_ref.annotation), *loc)

        return env[annotation_ref.annotation]

    def _resolve_args(self, env, args):
        """
        Resolves type references in data type arguments to data types in
        the environment.
        """
        pos_args, kw_args = args

        def check_value(v):
            if isinstance(v, AstTypeRef):
                return self._resolve_type(env, v)
            else:
                return v

        new_pos_args = [check_value(pos_arg) for pos_arg in pos_args]
        new_kw_args = {k: check_value(v) for k, v in kw_args.items()}
        return new_pos_args, new_kw_args

    def _create_route(self, env, item):
        """
        Constructs a route and adds it to the environment.

        Args:
            env (dict): The environment of defined symbols. A new key is added
                corresponding to the name of this new route.
            item (AstRouteDef): Raw route definition from the parser.

        Returns:
            stone.api.ApiRoutesByVersion: A group of fully-defined routes indexed by versions.
        """
        if item.name in env:
            if isinstance(env[item.name], ApiRoutesByVersion):
                if item.version in env[item.name].at_version:
                    existing_dt = env[item.name].at_version[item.version]
                    raise InvalidSpec(
                        'Route %s at version %d already defined (%s:%d).' % (
                            quote(item.name), item.version, existing_dt._ast_node.path,
                            existing_dt._ast_node.lineno),
                        item.lineno, item.path)
            else:
                existing_dt = env[item.name]
                raise InvalidSpec(
                    'Symbol %s already defined (%s:%d).' % (
                        quote(item.name), existing_dt._ast_node.path,
                        existing_dt._ast_node.lineno),
                    item.lineno, item.path)
        else:
            env[item.name] = ApiRoutesByVersion()

        route = ApiRoute(
            name=item.name,
            version=item.version,
            ast_node=item,
        )
        env[route.name].at_version[route.version] = route
        return route

    def _get_or_create_env(self, namespace_name):
        # Because there might have already been a spec that was part of this
        # same namespace, the environment might already exist.
        if namespace_name in self._env_by_namespace:
            env = self._env_by_namespace[namespace_name]
        else:
            env = copy.copy(self.default_env)
            env.namespace_name = namespace_name
            self._env_by_namespace[namespace_name] = env
        return env

    def _populate_enumerated_subtypes(self):
        # Since enumerated subtypes require forward references, resolve them
        # now that all types are populated in the environment.
        for namespace in self.api.namespaces.values():
            env = self._get_or_create_env(namespace.name)
            for data_type in namespace.data_types:
                if not (isinstance(data_type, Struct) and
                        data_type._ast_node.subtypes):
                    continue

                subtype_fields = []
                for subtype_field in data_type._ast_node.subtypes[0]:
                    subtype_name = subtype_field.type_ref.name
                    lineno = subtype_field.type_ref.lineno
                    path = subtype_field.type_ref.path
                    if subtype_field.type_ref.name not in env:
                        raise InvalidSpec(
                            'Undefined type %s.' % quote(subtype_name),
                            lineno, path)
                    subtype = self._resolve_type(
                        env, subtype_field.type_ref, True)
                    if not isinstance(subtype, Struct):
                        raise InvalidSpec(
                            'Enumerated subtype %s must be a struct.' %
                            quote(subtype_name), lineno, path)
                    f = UnionField(
                        subtype_field.name, subtype, None, subtype_field)
                    subtype_fields.append(f)
                data_type.set_enumerated_subtypes(subtype_fields,
                                                  data_type._ast_node.subtypes[1])

            # In an enumerated subtypes tree, regular structs may only exist at
            # the leaves. In other words, no regular struct may inherit from a
            # regular struct.
            for data_type in namespace.data_types:
                if (not isinstance(data_type, Struct) or
                        not data_type.has_enumerated_subtypes()):
                    continue

                for subtype_field in data_type.get_enumerated_subtypes():
                    if (not subtype_field.data_type.has_enumerated_subtypes() and
                            len(subtype_field.data_type.subtypes) > 0):
                        raise InvalidSpec(
                            "Subtype '%s' cannot be extended." %
                            subtype_field.data_type.name,
                            subtype_field.data_type._ast_node.lineno,
                            subtype_field.data_type._ast_node.path)

    def _populate_examples(self):
        """Construct every possible example for every type.

        This is done in two passes. The first pass assigns examples to their
        associated types, but does not resolve references between examples for
        different types. This is because the referenced examples may not yet
        exist. The second pass resolves references.
        """
        for namespace in self.api.namespaces.values():
            for data_type in namespace.data_types:
                for example in data_type._ast_node.examples.values():
                    data_type._add_example(example)

        for namespace in self.api.namespaces.values():
            for data_type in namespace.data_types:
                data_type._compute_examples()

    def _validate_doc_refs(self):
        """
        Validates that all the documentation references across every docstring
        in every spec are formatted properly, have valid values, and make
        references to valid symbols.
        """
        for namespace in self.api.namespaces.values():
            env = self._get_or_create_env(namespace.name)
            # Validate the doc refs of each api entity that has a doc
            for data_type in namespace.data_types:
                if data_type.doc:
                    self._validate_doc_refs_helper(
                        env,
                        data_type.doc,
                        (data_type._ast_node.lineno + 1, data_type._ast_node.path),
                        data_type)
                for field in data_type.fields:
                    if field.doc:
                        self._validate_doc_refs_helper(
                            env,
                            field.doc,
                            (field._ast_node.lineno + 1, field._ast_node.path),
                            data_type)
            for route in namespace.routes:
                if route.doc:
                    self._validate_doc_refs_helper(
                        env,
                        route.doc,
                        (route._ast_node.lineno + 1, route._ast_node.path))

    def _validate_doc_refs_helper(self, env, doc, loc, type_context=None):
        """
        Validates that all the documentation references in a docstring are
        formatted properly, have valid values, and make references to valid
        symbols.

        Args:
            env (dict): The environment of defined symbols.
            doc (str): The docstring to validate.
            lineno (int): The line number the docstring begins on in the spec.
            type_context (stone.data_type.UserDefined): If the docstring
                belongs to a user-defined type (Struct or Union) or one of its
                fields, set this to the type. This is needed for "field" doc
                refs that don't name a type to be validated.
        """
        for match in doc_ref_re.finditer(doc):
            tag = match.group('tag')
            val = match.group('val')
            if tag == 'field':
                if '.' in val:
                    type_name, field_name = val.split('.', 1)
                    if type_name not in env:
                        raise InvalidSpec(
                            'Bad doc reference to field %s of '
                            'unknown type %s.' % (field_name, quote(type_name)),
                            *loc)
                    elif isinstance(env[type_name], ApiRoutesByVersion):
                        raise InvalidSpec(
                            'Bad doc reference to field %s of route %s.' %
                            (quote(field_name), quote(type_name)),
                            *loc)
                    if isinstance(env[type_name], Environment):
                        # Handle reference to field in imported namespace.
                        namespace_name, type_name, field_name = val.split('.', 2)
                        data_type_to_check = env[namespace_name][type_name]
                    elif isinstance(env[type_name], Alias):
                        data_type_to_check = env[type_name].data_type
                    else:
                        data_type_to_check = env[type_name]
                    if not any(field.name == field_name
                               for field in data_type_to_check.all_fields):
                        raise InvalidSpec(
                            'Bad doc reference to unknown field %s.' % quote(val),
                            *loc)
                else:
                    # Referring to a field that's a member of this type
                    assert type_context is not None
                    if not any(field.name == val
                               for field in type_context.all_fields):
                        raise InvalidSpec(
                            'Bad doc reference to unknown field %s.' %
                            quote(val),
                            *loc)
            elif tag == 'link':
                if not (1 < val.rfind(' ') < len(val) - 1):
                    # There must be a space somewhere in the middle of the
                    # string to separate the title from the uri.
                    raise InvalidSpec(
                        'Bad doc reference to link (need a title and '
                        'uri separated by a space): %s.' % quote(val),
                        *loc)
            elif tag == 'route':
                if '.' in val:
                    # Handle reference to route in imported namespace.
                    namespace_name, val = val.split('.', 1)
                    if namespace_name not in env:
                        raise InvalidSpec(
                            "Unknown doc reference to namespace '%s'." %
                            namespace_name, *loc)
                    env_to_check = env[namespace_name]
                else:
                    env_to_check = env

                route_name, version = parse_route_name_and_version(val)
                if route_name not in env_to_check:
                    raise InvalidSpec(
                        'Unknown doc reference to route {}.'.format(quote(route_name)), *loc)
                if not isinstance(env_to_check[route_name], ApiRoutesByVersion):
                    raise InvalidSpec(
                        'Doc reference to type {} is not a route.'.format(quote(route_name)), *loc)
                if version not in env_to_check[route_name].at_version:
                    raise InvalidSpec(
                        'Doc reference to route {} has undefined version {}.'.format(
                            quote(route_name), version),
                        *loc)
            elif tag == 'type':
                if '.' in val:
                    # Handle reference to type in imported namespace.
                    namespace_name, val = val.split('.', 1)
                    if namespace_name not in env:
                        raise InvalidSpec(
                            "Unknown doc reference to namespace '%s'." %
                            namespace_name, *loc)
                    env_to_check = env[namespace_name]
                else:
                    env_to_check = env
                if val not in env_to_check:
                    raise InvalidSpec(
                        "Unknown doc reference to type '%s'." % val,
                        *loc)
                elif not isinstance(env_to_check[val], (Struct, Union)):
                    raise InvalidSpec(
                        'Doc reference to type %s is not a struct or union.' %
                        quote(val), *loc)
            elif tag == 'val':
                if not doc_ref_val_re.match(val):
                    raise InvalidSpec(
                        'Bad doc reference value %s.' % quote(val),
                        *loc)
            else:
                raise InvalidSpec(
                    'Unknown doc reference tag %s.' % quote(tag),
                    *loc)

    def _validate_annotations(self):
        """
        Validates that all annotations are attached to proper types and that no field
        has conflicting inherited or direct annotations. We need to go through all reference
        chains to make sure we don't override a redactor set on a parent alias or type
        """
        for namespace in self.api.namespaces.values():
            for data_type in namespace.data_types:
                for field in data_type.fields:
                    if field.redactor:
                        self._validate_field_can_be_tagged_with_redactor(field)

            for alias in namespace.aliases:
                if alias.redactor:
                    self._validate_object_can_be_tagged_with_redactor(alias)

    def _validate_field_can_be_tagged_with_redactor(self, field):
        """
        Validates that the field type can be annotated and that alias does not have
        conflicting annotations.
        """
        if is_alias(field.data_type):
            raise InvalidSpec(
                "Redactors can only be applied to alias definitions, not "
                "to alias references.",
                field._ast_node.lineno, field._ast_node.path)

        self._validate_object_can_be_tagged_with_redactor(field)

    def _validate_object_can_be_tagged_with_redactor(self, annotated_object):
        """
        Validates that the object type can be annotated and object does not have
        conflicting annotations.
        """
        data_type = annotated_object.data_type
        name = annotated_object.name
        loc = annotated_object._ast_node.lineno, annotated_object._ast_node.path
        curr_data_type = data_type

        while isinstance(curr_data_type, Alias) or isinstance(curr_data_type, Nullable):
            # aliases have redactors assocaited with the type itself
            if hasattr(curr_data_type, 'redactor') and curr_data_type.redactor:
                raise InvalidSpec("A redactor has already been defined for '%s' by '%s'." %
                                  (str(name), str(curr_data_type.name)), *loc)

            curr_data_type = curr_data_type.data_type

        if hasattr(annotated_object, 'redactor') and annotated_object.redactor:
            if is_map_type(curr_data_type) or is_list_type(curr_data_type):
                while True:
                    if is_map_type(curr_data_type):
                        curr_data_type = curr_data_type.value_data_type
                    else:
                        curr_data_type = curr_data_type.data_type

                    should_continue = (is_map_type(curr_data_type) or is_list_type(curr_data_type)
                        or is_nullable_type(curr_data_type))

                    if should_continue is False:
                        break

            if is_user_defined_type(curr_data_type) or is_void_type(curr_data_type):
                raise InvalidSpec("Redactors can't be applied to user-defined or void types.", *loc)

    def _validate_stone_cfg(self):
        """
        Returns:
             Struct: A schema for route attributes.
        """
        def mk_route_schema():
            s = Struct('Route', ApiNamespace('stone_cfg'), None)
            s.set_attributes(None, [], None)
            return s

        try:
            stone_cfg = self.api.namespaces.pop('stone_cfg')
        except KeyError:
            return mk_route_schema()

        if stone_cfg.routes:
            route = stone_cfg.routes[0]
            raise InvalidSpec(
                'No routes can be defined in the stone_cfg namespace.',
                route._ast_node.lineno,
                route._ast_node.path,
            )

        if not stone_cfg.data_types:
            return mk_route_schema()

        for data_type in stone_cfg.data_types:
            if data_type.name != 'Route':
                raise InvalidSpec(
                    "Only a struct named 'Route' can be defined in the "
                    "stone_cfg namespace.",
                    data_type._ast_node.lineno,
                    data_type._ast_node.path,
                )

        # TODO: are we always guaranteed at least one data type?
        # pylint: disable=undefined-loop-variable
        return data_type

    def _filter_namespaces_by_route_whitelist(self):
        """
        Given a parsed API in IR form, filter the user-defined datatypes
        so that they include only the route datatypes and their direct dependencies.
        """
        assert self._routes is not None, "Missing route whitelist"
        assert 'route_whitelist' in self._routes
        assert 'datatype_whitelist' in self._routes

        # Get route whitelist in canonical form
        route_whitelist = {}
        for namespace_name, route_reprs in self._routes['route_whitelist'].items():
            new_route_reprs = []
            if route_reprs == ['*']:
                namespace = self.api.namespaces[namespace_name]
                new_route_reprs = [route.name_with_version() for route in namespace.routes]
            else:
                for route_repr in route_reprs:
                    route_name, version = parse_route_name_and_version(route_repr)
                    if version > 1:
                        new_route_reprs.append('{}:{}'.format(route_name, version))
                    else:
                        new_route_reprs.append(route_name)
            route_whitelist[namespace_name] = new_route_reprs

        # Parse the route whitelist and populate any starting data types
        route_data_types = []
        for namespace_name, route_reprs in route_whitelist.items():
            # Error out if user supplied nonexistent namespace
            if namespace_name not in self.api.namespaces:
                raise AssertionError('Namespace %s is not defined!' % namespace_name)
            namespace = self.api.namespaces[namespace_name]

            # Parse namespace doc refs and add them to the starting data types
            if namespace.doc is not None:
                route_data_types.extend(
                    parse_data_types_from_doc_ref(self.api, namespace.doc, namespace_name))

            # Parse user-specified routes and add them to the starting data types
            # Note that this may add duplicates, but that's okay, as the recursion
            # keeps track of visited data types.
            assert '*' not in route_reprs
            for routes_repr in route_reprs:
                route_name, version = parse_route_name_and_version(routes_repr)
                if route_name not in namespace.routes_by_name or \
                        version not in namespace.routes_by_name[route_name].at_version:
                    raise AssertionError('Route %s at version %d is not defined!' %
                                         (route_name, version))

                route = namespace.routes_by_name[route_name].at_version[version]
                route_data_types.extend(namespace.get_route_io_data_types_for_route(route))
                if route.doc is not None:
                    route_data_types.extend(
                        parse_data_types_from_doc_ref(self.api, route.doc, namespace_name))

        # Parse the datatype whitelist and populate any starting data types
        for namespace_name, datatype_names in self._routes['datatype_whitelist'].items():
            if namespace_name not in self.api.namespaces:
                raise AssertionError('Namespace %s is not defined!' % namespace_name)

            # Parse namespace doc refs and add them to the starting data types
            namespace = self.api.namespaces[namespace_name]
            if namespace.doc is not None:
                route_data_types.extend(
                    parse_data_types_from_doc_ref(self.api, namespace.doc, namespace_name))

            for datatype_name in datatype_names:
                if datatype_name not in self.api.namespaces[namespace_name].data_type_by_name:
                    raise AssertionError('Datatype %s is not defined!' % datatype_name)
                data_type = self.api.namespaces[namespace_name].data_type_by_name[datatype_name]
                route_data_types.append(data_type)

        # Recurse on dependencies
        output_types_by_ns, output_routes_by_ns = self._find_dependencies(route_data_types)

        # Update the IR representation. This involves editing the data types and
        # routes for each namespace.
        for namespace in self.api.namespaces.values():
            data_types = list(set(output_types_by_ns[namespace.name]))  # defaults to empty list
            namespace.data_types = data_types
            namespace.data_type_by_name = {d.name: d for d in data_types}

            output_route_reprs = [output_route.name_with_version()
                                  for output_route in output_routes_by_ns[namespace.name]]
            if namespace.name in route_whitelist:
                whitelisted_route_reprs = route_whitelist[namespace.name]
                route_reprs = list(set(whitelisted_route_reprs + output_route_reprs))
            else:
                route_reprs = output_route_reprs

            routes = []
            for route_repr in route_reprs:
                route_name, version = parse_route_name_and_version(route_repr)
                route = namespace.routes_by_name[route_name].at_version[version]
                routes.append(route)

            namespace.routes = []
            namespace.route_by_name = {}
            namespace.routes_by_name = {}

            for route in routes:
                namespace.add_route(route)

    def _find_dependencies(self, data_types):
        output_types = defaultdict(list)
        output_routes = defaultdict(set)
        seen = set()
        for t in data_types:
            self._find_dependencies_recursive(t, seen, output_types, output_routes)
        return output_types, output_routes

    def _find_dependencies_recursive(self, data_type, seen, output_types,
                                     output_routes, type_context=None):
        # Define a function that recursively traverses data types and populates
        # the data structures defined above.
        if data_type in seen:
            # if we've visited a data type already, no need to revisit
            return
        elif is_primitive_type(data_type):
            # primitive types represent leaf nodes in the tree
            return
        elif is_struct_type(data_type) or is_union_type(data_type):
            # recurse on fields and parent types for structs and unions
            # also recurse on enumerated subtypes for structs if present
            seen.add(data_type)
            output_types[data_type.namespace.name].append(data_type)
            for field in data_type.all_fields:
                self._find_dependencies_recursive(field, seen, output_types, output_routes,
                                                  type_context=data_type)
            if data_type.parent_type is not None:
                self._find_dependencies_recursive(data_type.parent_type, seen, output_types,
                                                  output_routes)
            if data_type.doc is not None:
                doc_types, routes_by_ns = parse_data_types_and_routes_from_doc_ref(
                    self.api, data_type.doc, data_type.namespace.name)
                for t in doc_types:
                    self._find_dependencies_recursive(t, seen, output_types, output_routes)
                for namespace_name, routes in routes_by_ns.items():
                    route_namespace = self.api.namespaces[namespace_name]
                    for route in routes:
                        output_routes[namespace_name].add(route)
                        route_types = route_namespace.get_route_io_data_types_for_route(route)
                        for route_type in route_types:
                            self._find_dependencies_recursive(route_type, seen, output_types,
                                                              output_routes)
            if is_struct_type(data_type) and data_type.has_enumerated_subtypes():
                for subtype in data_type.get_enumerated_subtypes():
                    self._find_dependencies_recursive(subtype, seen, output_types, output_routes,
                                                      type_context=data_type)
        elif is_alias(data_type) or is_field_type(data_type):
            assert (is_field_type(data_type)) == (type_context is not None)
            if is_alias(data_type):
                namespace_context = data_type.namespace.name
            else:
                namespace_context = type_context.namespace.name
            seen.add(data_type)
            self._find_dependencies_recursive(data_type.data_type, seen, output_types,
                                              output_routes)
            if data_type.doc is not None:
                doc_types, routes_by_ns = parse_data_types_and_routes_from_doc_ref(
                    self.api, data_type.doc, namespace_context)
                for t in doc_types:
                    self._find_dependencies_recursive(t, seen, output_types, output_routes)
                for namespace_name, routes in routes_by_ns.items():
                    route_namespace = self.api.namespaces[namespace_name]
                    for route in routes:
                        output_routes[namespace_name].add(route)
                        route_types = route_namespace.get_route_io_data_types_for_route(route)
                        for route_type in route_types:
                            self._find_dependencies_recursive(route_type, seen, output_types,
                                                              output_routes)
        elif is_list_type(data_type) or is_nullable_type(data_type):
            # recurse on underlying field for aliases, lists, nullables, and fields
            seen.add(data_type)
            self._find_dependencies_recursive(data_type.data_type, seen, output_types,
                                              output_routes)
        elif is_map_type(data_type):
            # recurse on key/value fields for maps
            seen.add(data_type)
            self._find_dependencies_recursive(data_type.key_data_type, seen, output_types,
                                              output_routes)
            self._find_dependencies_recursive(data_type.value_data_type, seen, output_types,
                                              output_routes)
        else:
            assert False, "Unexpected type in: %s" % data_type
