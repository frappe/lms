import json

from stone.backends.helpers import (
    fmt_camel,
    fmt_pascal,
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
    is_list_type,
    is_struct_type,
    is_user_defined_type,
)

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


def fmt_obj(o):
    if isinstance(o, str):
        # Prioritize single-quoted strings per JS style guides.
        return repr(o).lstrip('u')
    else:
        return json.dumps(o, indent=2)


def fmt_error_type(data_type, wrap_error_in=''):
    """
    Converts the error type into a JSDoc type.
    """
    return '{}.<{}>'.format(
        (wrap_error_in if (wrap_error_in != '') else 'Error'),
        fmt_type(data_type)
    )


def fmt_type_name(data_type):
    """
    Returns the JSDoc name for the given data type.
    (Does not attempt to enumerate subtypes.)
    """
    if is_user_defined_type(data_type):
        return fmt_pascal('{}{}'.format(data_type.namespace.name, data_type.name))
    else:
        fmted_type = _base_type_table.get(data_type.__class__, 'Object')
        if is_list_type(data_type):
            fmted_type += '.<' + fmt_type(data_type.data_type) + '>'
        return fmted_type


def fmt_type(data_type):
    """
    Returns a JSDoc annotation for a data type.
    May contain a union of enumerated subtypes.
    """
    if is_struct_type(data_type) and data_type.has_enumerated_subtypes():
        possible_types = []
        possible_subtypes = data_type.get_all_subtypes_with_tags()
        for _, subtype in possible_subtypes:
            possible_types.append(fmt_type_name(subtype))
        if data_type.is_catch_all():
            possible_types.append(fmt_type_name(data_type))
        return fmt_jsdoc_union(possible_types)
    else:
        return fmt_type_name(data_type)


def fmt_jsdoc_union(type_strings):
    """
    Returns a JSDoc union of the given type strings.
    """
    return '(' + '|'.join(type_strings) + ')' if len(type_strings) > 1 else type_strings[0]


def fmt_func(name, version):
    if version == 1:
        return fmt_camel(name)
    return fmt_camel(name) + 'V{}'.format(version)


def fmt_url(namespace_name, route_name, route_version):
    if route_version != 1:
        return '{}/{}_v{}'.format(namespace_name, route_name, route_version)
    else:
        return '{}/{}'.format(namespace_name, route_name)


def fmt_var(name):
    return fmt_camel(name)


def check_route_name_conflict(namespace):
    """
    Check name conflicts among generated route definitions. Raise a runtime exception when a
    conflict is encountered.
    """

    route_by_name = {}
    for route in namespace.routes:
        route_name = fmt_func(route.name, version=route.version)
        if route_name in route_by_name:
            other_route = route_by_name[route_name]
            raise RuntimeError(
                'There is a name conflict between {!r} and {!r}'.format(other_route, route))
        route_by_name[route_name] = route
