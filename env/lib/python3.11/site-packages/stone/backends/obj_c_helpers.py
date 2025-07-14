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
    is_boolean_type,
    is_list_type,
    is_map_type,
    is_numeric_type,
    is_string_type,
    is_tag_ref,
    is_user_defined_type,
    is_void_type,
    unwrap_nullable, )
from .helpers import split_words

# This file defines *stylistic* choices for Swift
# (ie, that class names are UpperCamelCase and that variables are lowerCamelCase)

_primitive_table = {
    Boolean: 'NSNumber *',
    Bytes: 'NSString *',
    Float32: 'NSNumber *',
    Float64: 'NSNumber *',
    Int32: 'NSNumber *',
    Int64: 'NSNumber *',
    List: 'NSArray',
    Map: 'NSDictionary',
    String: 'NSString *',
    Timestamp: 'NSDate *',
    UInt32: 'NSNumber *',
    UInt64: 'NSNumber *',
    Void: 'void',
}

_primitive_table_user_interface = {
    Boolean: 'BOOL',
    Bytes: 'NSString *',
    Float32: 'double',
    Float64: 'double',
    Int32: 'int',
    Int64: 'long',
    List: 'NSArray',
    Map: 'NSDictionary',
    String: 'NSString *',
    Timestamp: 'NSDate *',
    UInt32: 'unsigned int',
    UInt64: 'unsigned long',
    Void: 'void',
}

_serial_table = {
    Boolean: 'DBBoolSerializer',
    Bytes: 'DBStringSerializer',
    Float32: 'DBNSNumberSerializer',
    Float64: 'DBNSNumberSerializer',
    Int32: 'DBNSNumberSerializer',
    Int64: 'DBNSNumberSerializer',
    List: 'DBArraySerializer',
    Map: 'DBMapSerializer',
    String: 'DBStringSerializer',
    Timestamp: 'DBNSDateSerializer',
    UInt32: 'DBNSNumberSerializer',
    UInt64: 'DBNSNumberSerializer',
}

_validator_table = {
    Float32: 'numericValidator',
    Float64: 'numericValidator',
    Int32: 'numericValidator',
    Int64: 'numericValidator',
    List: 'arrayValidator',
    Map: 'mapValidator',
    String: 'stringValidator',
    UInt32: 'numericValidator',
    UInt64: 'numericValidator',
}

_wrapper_primitives = {
    Boolean,
    Float32,
    Float64,
    UInt32,
    UInt64,
    Int32,
    Int64,
    String,
    Bytes,
}

_reserved_words = {
    'auto',
    'else',
    'long',
    'switch',
    'break',
    'enum',
    'register',
    'typedef',
    'case',
    'extern',
    'return',
    'union',
    'char',
    'float',
    'short',
    'unsigned',
    'const',
    'for',
    'signed',
    'void',
    'continue',
    'goto',
    'sizeof',
    'volatile',
    'default',
    'if',
    'static',
    'while',
    'do',
    'int',
    'struct',
    '_Packed',
    'double',
    'protocol',
    'interface',
    'implementation',
    'NSObject',
    'NSInteger',
    'NSNumber',
    'CGFloat',
    'property',
    'nonatomic',
    'retain',
    'strong',
    'weak',
    'unsafe_unretained',
    'readwrite',
    'description',
    'id',
    'delete',
    'hash',
    'boolvalue',
    'floatvalue',
    'intvalue',
}

_reserved_prefixes = {
    'copy',
    'new',
}


def fmt_obj(o):
    assert not isinstance(o, dict), "Only use for base type literals"
    if o is True:
        return 'true'
    if o is False:
        return 'false'
    if o is None:
        return 'nil'
    return pprint.pformat(o, width=1)


def fmt_camel(name, upper_first=False, reserved=True):
    name = str(name)
    words = [word.capitalize() for word in split_words(name)]
    if not upper_first:
        words[0] = words[0].lower()
    ret = ''.join(words)

    if reserved:
        if ret.lower() in _reserved_words:
            ret += '_'
        # properties can't begin with certain keywords
        for reserved_prefix in _reserved_prefixes:
            if ret.lower().startswith(reserved_prefix):
                new_prefix = 'd' if not upper_first else 'D'
                ret = new_prefix + ret[0].upper() + ret[1:]
                continue
    return ret


def fmt_enum_name(field_name, union):
    return 'DB{}{}{}'.format(
        fmt_class_caps(union.namespace.name),
        fmt_camel_upper(union.name), fmt_camel_upper(field_name))


def fmt_camel_upper(name, reserved=True):
    return fmt_camel(name, upper_first=True, reserved=reserved)


def fmt_public_name(name):
    return fmt_camel_upper(name)


def fmt_class(name):
    return fmt_camel_upper(name)


def fmt_class_caps(name):
    return fmt_camel_upper(name).upper()


def fmt_class_type(data_type, suppress_ptr=False):
    data_type, _ = unwrap_nullable(data_type)

    if is_user_defined_type(data_type):
        result = '{}'.format(fmt_class_prefix(data_type))
    else:
        result = _primitive_table.get(data_type.__class__,
                                      fmt_class(data_type.name))

        if suppress_ptr:
            result = result.replace(' *', '')
            result = result.replace('*', '')

        if is_list_type(data_type):
            data_type, _ = unwrap_nullable(data_type.data_type)
            result = result + '<{}>'.format(fmt_type(data_type))
        elif is_map_type(data_type):
            data_type, _ = unwrap_nullable(data_type.value_data_type)
            result = result + '<NSString *, {}>'.format(fmt_type(data_type))
    return result


def fmt_func(name):
    return fmt_camel(name)


def fmt_type(data_type, tag=False, has_default=False, no_ptr=False, is_prop=False):
    data_type, nullable = unwrap_nullable(data_type)

    if is_user_defined_type(data_type):
        base = '{}' if no_ptr else '{} *'
        result = base.format(fmt_class_prefix(data_type))
    else:
        result = _primitive_table.get(data_type.__class__,
                                      fmt_class(data_type.name))

        if is_list_type(data_type):
            data_type, _ = unwrap_nullable(data_type.data_type)
            base = '<{}>' if no_ptr else '<{}> *'
            result = result + base.format(fmt_type(data_type))
        elif is_map_type(data_type):
            data_type, _ = unwrap_nullable(data_type.value_data_type)
            base = '<NSString *, {}>' if no_ptr else '<NSString *, {}> *'
            result = result + base.format(fmt_type(data_type))

    if tag:
        if (nullable or has_default) and not is_prop:
            result = 'nullable ' + result

    return result


def fmt_route_type(data_type, tag=False, has_default=False):
    data_type, nullable = unwrap_nullable(data_type)

    if is_user_defined_type(data_type):
        result = '{} *'.format(fmt_class_prefix(data_type))
    else:
        result = _primitive_table_user_interface.get(data_type.__class__,
                                                     fmt_class(data_type.name))

        if is_list_type(data_type):
            data_type, _ = unwrap_nullable(data_type.data_type)
            result = result + '<{}> *'.format(fmt_type(data_type))
        elif is_map_type(data_type):
            data_type, _ = unwrap_nullable(data_type.value_data_type)
            result = result + '<NSString *, {}>'.format(fmt_type(data_type))

    if is_user_defined_type(data_type) and tag:
        if nullable or has_default:
            result = 'nullable ' + result
        elif not is_void_type(data_type):
            result += ''

    return result


def fmt_class_prefix(data_type):
    return 'DB{}{}'.format(
        fmt_class_caps(data_type.namespace.name), fmt_class(data_type.name))


def fmt_validator(data_type):
    return _validator_table.get(data_type.__class__, fmt_class(data_type.name))


def fmt_serial_obj(data_type):
    data_type, _ = unwrap_nullable(data_type)

    if is_user_defined_type(data_type):
        result = fmt_serial_class(fmt_class_prefix(data_type))
    else:
        result = _serial_table.get(data_type.__class__,
                                   fmt_class(data_type.name))

    return result


def fmt_serial_class(class_name):
    return '{}Serializer'.format(class_name)


def fmt_route_obj_class(namespace_name):
    return 'DB{}RouteObjects'.format(fmt_class_caps(namespace_name))


def fmt_routes_class(namespace_name, auth_type):
    auth_type_to_use = auth_type
    if auth_type == 'noauth':
        auth_type_to_use = 'user'
    return 'DB{}{}AuthRoutes'.format(
        fmt_class_caps(namespace_name), fmt_camel_upper(auth_type_to_use))


def fmt_route_var(namespace_name, route):
    ret = 'DB{}{}'.format(
        fmt_class_caps(namespace_name), fmt_camel_upper(route.name))
    if route.version != 1:
        ret = '{}V{}'.format(ret, route.version)

    return ret

def fmt_route_func(route):
    ret = fmt_var(route.name)
    if route.version != 1:
        ret = '{}V{}'.format(ret, route.version)

    return ret

def fmt_func_args(arg_str_pairs):
    result = []
    first_arg = True
    for arg_name, arg_value in arg_str_pairs:
        if first_arg:
            result.append('{}'.format(arg_value))
            first_arg = False
        else:
            result.append('{}:{}'.format(arg_name, arg_value))
    return ' '.join(result)


def fmt_func_args_declaration(arg_str_pairs):
    result = []
    first_arg = True
    for arg_name, arg_type in arg_str_pairs:
        if first_arg:
            result.append('({}){}'.format(arg_type, arg_name))
            first_arg = False
        else:
            result.append('{0}:({1}){0}'.format(arg_name, arg_type))
    return ' '.join(result)


def fmt_func_args_from_fields(args):
    result = []
    first_arg = True
    for arg in args:
        if first_arg:
            result.append(
                '({}){}'.format(fmt_type(arg.data_type), fmt_var(arg.name)))
            first_arg = False
        else:
            result.append('{}:({}){}'.format(
                fmt_var(arg.name), fmt_type(arg.data_type), fmt_var(arg.name)))
    return ' '.join(result)


def fmt_func_call(caller, callee, args=None):
    if args:
        result = '[{} {}:{}]'.format(caller, callee, args)
    else:
        result = '[{} {}]'.format(caller, callee)

    return result


def fmt_alloc_call(caller):
    return '[{} alloc]'.format(caller)


def fmt_default_value(field):
    if is_tag_ref(field.default):
        return '[[{} alloc] initWith{}]'.format(
            fmt_class_prefix(field.default.union_data_type),
            fmt_class(field.default.tag_name))
    elif is_numeric_type(field.data_type):
        return '@({})'.format(field.default)
    elif is_boolean_type(field.data_type):
        if field.default:
            bool_str = 'YES'
        else:
            bool_str = 'NO'
        return '@{}'.format(bool_str)
    elif is_string_type(field.data_type):
        return '@"{}"'.format(field.default)
    else:
        raise TypeError(
            'Can\'t handle default value type %r' % type(field.data_type))


def fmt_ns_number_call(data_type):
    result = ''
    if is_numeric_type(data_type):
        if isinstance(data_type, UInt32):
            result = 'numberWithUnsignedInt'
        elif isinstance(data_type, UInt64):
            result = 'numberWithUnsignedLong'
        elif isinstance(data_type, Int32):
            result = 'numberWithInt'
        elif isinstance(data_type, Int64):
            result = 'numberWithLong'
        elif isinstance(data_type, Float32):
            result = 'numberWithDouble'
        elif isinstance(data_type, Float64):
            result = 'numberWithDouble'
    elif is_boolean_type(data_type):
        result = 'numberWithBool'
    return result


def fmt_signature(func, args, return_type='void', class_func=False):
    modifier = '-' if not class_func else '+'
    if args:
        result = '{} ({}){}:{}'.format(modifier, return_type, func, args)
    else:
        result = '{} ({}){}'.format(modifier, return_type, func)

    return result


def is_primitive_type(data_type):
    data_type, _ = unwrap_nullable(data_type)
    return data_type.__class__ in _wrapper_primitives


def fmt_var(name):
    return fmt_camel(name)


def fmt_property(field):
    attrs = ['nonatomic', 'readonly']
    data_type, nullable = unwrap_nullable(field.data_type)
    if is_string_type(data_type):
        attrs.append('copy')
    if nullable:
        attrs.append('nullable')
    base_string = '@property ({}) {}{};'

    return base_string.format(', '.join(attrs),
                              fmt_type(field.data_type, tag=True, is_prop=True),
                              fmt_var(field.name))


def fmt_import(header_file):
    return '#import "{}.h"'.format(header_file)


def fmt_property_str(prop, typ, attrs=None):
    if not attrs:
        attrs = ['nonatomic', 'readonly']
    base_string = '@property ({}) {} {};'
    return base_string.format(', '.join(attrs), typ, prop)


def append_to_jazzy_category_dict(jazzy_dict, label, item):
    for category_dict in jazzy_dict['custom_categories']:
        if category_dict['name'] == label:
            category_dict['children'].append(item)
            return
    return None
