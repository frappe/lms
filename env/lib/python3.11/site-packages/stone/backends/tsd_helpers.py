from stone.backend import Backend
from stone.backends.helpers import (
    fmt_camel,
)
from stone.ir import (
    Boolean,
    Bytes,
    Float32,
    Float64,
    Int32,
    Int64,
    List,
    String,
    Timestamp,
    UInt32,
    UInt64,
    Void,
    is_alias,
    is_list_type,
    is_struct_type,
    is_map_type,
    is_user_defined_type,
)
from stone.ir.api import ApiNamespace

_base_type_table = {
    Boolean: 'boolean',
    Bytes: 'string',
    Float32: 'number',
    Float64: 'number',
    Int32: 'number',
    Int64: 'number',
    List: 'Array',
    String: 'string',
    UInt32: 'number',
    UInt64: 'number',
    Timestamp: 'Timestamp',
    Void: 'void',
}


def fmt_error_type(data_type, inside_namespace=None, wrap_error_in=''):
    """
    Converts the error type into a TypeScript type.
    inside_namespace should be set to the namespace that the reference
    occurs in, or None if this parameter is not relevant.
    """
    return '{}<{}>'.format(
        (wrap_error_in if (wrap_error_in != '') else 'Error'),
        fmt_type(data_type, inside_namespace)
    )

def fmt_type_name(data_type, inside_namespace=None):
    """
    Produces a TypeScript type name for the given data type.
    inside_namespace should be set to the namespace that the reference
    occurs in, or None if this parameter is not relevant.
    """
    if is_user_defined_type(data_type) or is_alias(data_type):
        if data_type.namespace == inside_namespace:
            return data_type.name
        else:
            return '{}.{}'.format(data_type.namespace.name, data_type.name)
    else:
        fmted_type = _base_type_table.get(data_type.__class__, 'Object')
        if is_list_type(data_type):
            fmted_type += '<' + fmt_type(data_type.data_type, inside_namespace) + '>'
        elif is_map_type(data_type):
            key_data_type = _base_type_table.get(data_type.key_data_type, 'string')
            value_data_type = fmt_type_name(data_type.value_data_type, inside_namespace)
            fmted_type = '{{[key: {}]: {}}}'.format(key_data_type, value_data_type)
        return fmted_type

def fmt_polymorphic_type_reference(data_type, inside_namespace=None):
    """
    Produces a TypeScript type name for the meta-type that refers to the given
    struct, which belongs to an enumerated subtypes tree. This meta-type contains the
    .tag field that lets developers discriminate between subtypes.
    """
    # NOTE: These types are not properly namespaced, so there could be a conflict
    #       with other user-defined types. If this ever surfaces as a problem, we
    #       can defer emitting these types until the end, and emit them in a
    #       nested namespace (e.g., files.references.MetadataReference).
    return fmt_type_name(data_type, inside_namespace) + "Reference"

def fmt_type(data_type, inside_namespace=None):
    """
    Returns a TypeScript type annotation for a data type.
    May contain a union of enumerated subtypes.
    inside_namespace should be set to the namespace that the type reference
    occurs in, or None if this parameter is not relevant.
    """
    if is_struct_type(data_type) and data_type.has_enumerated_subtypes():
        possible_types = []
        possible_subtypes = data_type.get_all_subtypes_with_tags()
        for _, subtype in possible_subtypes:
            possible_types.append(fmt_polymorphic_type_reference(subtype, inside_namespace))
        if data_type.is_catch_all():
            possible_types.append(fmt_polymorphic_type_reference(data_type, inside_namespace))
        return fmt_union(possible_types)
    else:
        return fmt_type_name(data_type, inside_namespace)

def fmt_union(type_strings):
    """
    Returns a union type of the given types.
    """
    return '|'.join(type_strings) if len(type_strings) > 1 else type_strings[0]

def fmt_func(name, version):
    if version == 1:
        return fmt_camel(name)
    return fmt_camel(name) + 'V{}'.format(version)


def fmt_var(name):
    return fmt_camel(name)

def fmt_tag(cur_namespace, tag, val):
    """
    Processes a documentation reference.
    """
    if tag == 'type':
        fq_val = val
        if '.' not in val and cur_namespace is not None:
            fq_val = cur_namespace.name + '.' + fq_val
        return fq_val
    elif tag == 'route':
        if ':' in val:
            val, version = val.split(':', 1)
            version = int(version)
        else:
            version = 1
        return fmt_func(val, version) + "()"
    elif tag == 'link':
        anchor, link = val.rsplit(' ', 1)
        # There's no way to have links in TSDoc, so simply use JSDoc's formatting.
        # It's entirely possible some editors support this.
        return '[{}]{{@link {}}}'.format(anchor, link)
    elif tag == 'val':
        # Value types seem to match JavaScript (true, false, null)
        return val
    elif tag == 'field':
        return val
    else:
        raise RuntimeError('Unknown doc ref tag %r' % tag)


def check_route_name_conflict(namespace):
    """
    Check name conflicts among generated route definitions. Raise a runtime exception when a
    conflict is encountered.
    """

    route_by_name = {}
    for route in namespace.routes:
        route_name = fmt_func(route.name, route.version)
        if route_name in route_by_name:
            other_route = route_by_name[route_name]
            raise RuntimeError(
                'There is a name conflict between {!r} and {!r}'.format(other_route, route))
        route_by_name[route_name] = route


def generate_imports_for_referenced_namespaces(backend, namespace, module_name_prefix):
    # type: (Backend, ApiNamespace, str) -> None

    imported_namespaces = namespace.get_imported_namespaces()
    if not imported_namespaces:
        return

    for ns in imported_namespaces:
        backend.emit(
            "import * as {namespace_name} from '{module_name_prefix}{namespace_name}';".format(
                module_name_prefix=module_name_prefix,
                namespace_name=ns.name
            )
        )
    backend.emit()

def get_data_types_for_namespace(namespace):
    return namespace.data_types + namespace.aliases
