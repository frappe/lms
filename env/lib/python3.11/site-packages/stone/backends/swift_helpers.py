import pprint

from stone.ir import (
    Boolean,
    Bytes,
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
    is_struct_type,
    is_boolean_type,
    is_list_type,
    is_map_type,
    is_numeric_type,
    is_string_type,
    is_tag_ref,
    is_user_defined_type,
    unwrap_nullable,
)
from .helpers import split_words

# This file defines *stylistic* choices for Swift
# (ie, that class names are UpperCamelCase and that variables are lowerCamelCase)


_type_table = {
    Boolean: 'Bool',
    Bytes: 'Data',
    Float32: 'Float',
    Float64: 'Double',
    Int32: 'Int32',
    Int64: 'Int64',
    List: 'Array',
    Map: 'Dictionary',
    String: 'String',
    Timestamp: 'Date',
    UInt32: 'UInt32',
    UInt64: 'UInt64',
    Void: 'Void',
}

_objc_type_table = {
    Boolean: 'NSNumber',
    Bytes: 'Data',
    Float32: 'NSNumber',
    Float64: 'NSNumber',
    Int32: 'NSNumber',
    Int64: 'NSNumber',
    List: 'Array',
    Map: 'Dictionary',
    String: 'String',
    Timestamp: 'Date',
    UInt32: 'NSNumber',
    UInt64: 'NSNumber',
    Void: '',
}

_reserved_words = {
    'description',
    'bool',
    'nsdata'
    'float',
    'double',
    'int32',
    'int64',
    'list',
    'string',
    'timestamp',
    'uint32',
    'uint64',
    'void',
    'associatedtype',
    'class',
    'deinit',
    'enum',
    'extension',
    'func',
    'import',
    'init',
    'inout',
    'internal',
    'let',
    'operator',
    'private',
    'protocol',
    'public',
    'static',
    'struct',
    'subscript',
    'typealias',
    'var',
    'default',
    'hash',
    'client',
}


def fmt_obj(o):
    assert not isinstance(o, dict), "Only use for base type literals"
    if o is True:
        return 'true'
    if o is False:
        return 'false'
    if o is None:
        return 'nil'
    if o == '':
        return '""'
    elif isinstance(o, str):
        return '"{}"'.format(o)

    return pprint.pformat(o, width=1)


def _format_camelcase(name, lower_first=True):
    words = [word.capitalize() for word in split_words(name)]
    if lower_first:
        words[0] = words[0].lower()
    ret = ''.join(words)
    if ret.lower() in _reserved_words:
        ret += '_'
    return ret


def fmt_class(name):
    return _format_camelcase(name, lower_first=False)


def fmt_func(name, version):
    if version > 1:
        name = '{}_v{}'.format(name, version)
    name = _format_camelcase(name)
    return name


def fmt_type(data_type):
    data_type, nullable = unwrap_nullable(data_type)

    if is_user_defined_type(data_type):
        result = '{}.{}'.format(fmt_class(data_type.namespace.name),
                                fmt_class(data_type.name))
    else:
        result = _type_table.get(data_type.__class__, fmt_class(data_type.name))

        if is_list_type(data_type):
            result = result + '<{}>'.format(fmt_type(data_type.data_type))
        if is_map_type(data_type):
            result = result + '<{}, {}>'.format(fmt_type(data_type.key_data_type),
            fmt_type(data_type.value_data_type))

    return result if not nullable else result + '?'

def fmt_objc_type(data_type, allow_nullable=True):
    data_type, nullable = unwrap_nullable(data_type)

    if is_user_defined_type(data_type):
        result = 'DBX{}{}'.format(fmt_class(data_type.namespace.name),
                                fmt_class(data_type.name))
    else:
        result = _objc_type_table.get(data_type.__class__, fmt_class(data_type.name))

        if is_list_type(data_type):
            result = result + '<{}>'.format(fmt_objc_type(data_type.data_type, False))
        elif is_map_type(data_type):
            result = result + '<String, {}>'.format(fmt_objc_type(data_type.value_data_type))

    return result if not nullable or not allow_nullable else result + '?'

def fmt_var(name):
    return _format_camelcase(name)


def fmt_default_value(field):
    if is_tag_ref(field.default):
        return '{}.{}Serializer().serialize(.{})'.format(
            fmt_class(field.default.union_data_type.namespace.name),
            fmt_class(field.default.union_data_type.name),
            fmt_var(field.default.tag_name))
    elif is_list_type(field.data_type):
        return '.array({})'.format(field.default)
    elif is_numeric_type(field.data_type):
        return '.number({})'.format(field.default)
    elif is_string_type(field.data_type):
        return '.str({})'.format(fmt_obj(field.default))
    elif is_boolean_type(field.data_type):
        if field.default:
            bool_str = '1'
        else:
            bool_str = '0'
        return '.number({})'.format(bool_str)
    else:
        raise TypeError('Can\'t handle default value type %r' %
                        type(field.data_type))

def fmt_route_name(route):
    if route.version == 1:
        return route.name
    else:
        return '{}_v{}'.format(route.name, route.version)

def fmt_route_name_namespace(route, namespace_name):
    return '{}/{}'.format(namespace_name, fmt_route_name(route))

def fmt_func_namespace(name, version, namespace_name):
    return '{}_{}'.format(namespace_name, fmt_func(name, version))

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

def mapped_list_info(data_type):
    list_data_type, list_nullable = unwrap_nullable(data_type.data_type)
    list_depth = 0

    while is_list_type(list_data_type):
        list_depth += 1
        list_data_type, list_nullable = unwrap_nullable(list_data_type.data_type)

    prefix = ''
    suffix = ''
    if list_depth > 0:
        i = 0
        while i < list_depth:
            i += 1
            prefix = '{}{{ $0.map '.format(prefix)
            suffix = '{} }}'.format(suffix)

    return (list_depth, prefix, suffix, list_data_type, list_nullable)

def field_is_user_defined(field):
    data_type, nullable = unwrap_nullable(field.data_type)
    return is_user_defined_type(data_type) and not nullable

def field_is_user_defined_optional(field):
    data_type, nullable = unwrap_nullable(field.data_type)
    return is_user_defined_type(data_type) and nullable

def field_is_user_defined_map(field):
    data_type, _ = unwrap_nullable(field.data_type)
    return is_map_type(data_type) and is_user_defined_type(data_type.value_data_type)

def field_is_user_defined_list(field):
    data_type, _ = unwrap_nullable(field.data_type)
    if is_list_type(data_type):
        list_data_type, _ = unwrap_nullable(data_type.data_type)
        return is_user_defined_type(list_data_type)
    else:
        return False

# List[typing.Tuple[let_name: str, swift_type: str, objc_type: str]]
def objc_datatype_value_type_tuples(data_type):
    ret = []

    # if list type get the data type of the item
    if is_list_type(data_type):
        data_type = data_type.data_type

    # if map type get the data type of the value
    if is_map_type(data_type):
        data_type = data_type.value_data_type

    # if data_type is a struct type and has subtypes, process them into labels and types
    if is_struct_type(data_type) and data_type.has_enumerated_subtypes():
        all_subtypes = data_type.get_all_subtypes_with_tags()

        for subtype in all_subtypes:
            # subtype[0] is the tag name and subtype[1] is the subtype struct itself
            struct = subtype[1]
            case_let_name = fmt_var(struct.name)
            swift_type = fmt_type(struct)
            objc_type = fmt_objc_type(struct)
            ret.append((case_let_name, swift_type, objc_type))
    return ret

def field_datatype_has_subtypes(field) -> bool:
    return datatype_has_subtypes(field.data_type)

def datatype_has_subtypes(data_type) -> bool:
    return len(objc_datatype_value_type_tuples(data_type)) > 0
