from stone.backends.python_helpers import class_name_for_data_type, fmt_namespace
from stone.ir import (
    Alias,
    ApiNamespace,
    DataType,
    List,
    Map,
    Nullable,
    Timestamp,
    UserDefined,
    is_alias,
    is_boolean_type,
    is_bytes_type,
    is_float_type,
    is_integer_type,
    is_list_type,
    is_map_type,
    is_nullable_type,
    is_string_type,
    is_timestamp_type,
    is_user_defined_type,
    is_void_type,
)
from stone.ir.data_types import String
from stone.typing_hacks import cast

MYPY = False
if MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression
    DataTypeCls = typing.Type[DataType]

    # Unfortunately these are codependent, so I'll weakly type the Dict in Callback
    Callback = typing.Callable[
        [ApiNamespace, DataType, typing.Dict[typing.Any, typing.Any]],
        str
    ]
    OverrideDefaultTypesDict = typing.Dict[DataTypeCls, Callback]
else:
    OverrideDefaultTypesDict = "OverrideDefaultTypesDict"


def map_stone_type_to_python_type(ns, data_type, override_dict=None):
    # type: (ApiNamespace, DataType, typing.Optional[OverrideDefaultTypesDict]) -> typing.Text
    """
    Args:
        override_dict: lets you override the default behavior for a given type by hooking into
            a callback. (Currently only hooked up for stone's List and Nullable)
    """
    override_dict = override_dict or {}

    if is_string_type(data_type):
        string_override = override_dict.get(String, None)
        if string_override:
            return string_override(ns, data_type, override_dict)
        return 'str'
    elif is_bytes_type(data_type):
        return 'bytes'
    elif is_boolean_type(data_type):
        return 'bool'
    elif is_float_type(data_type):
        return 'float'
    elif is_integer_type(data_type):
        return 'int'
    elif is_void_type(data_type):
        return 'None'
    elif is_timestamp_type(data_type):
        timestamp_override = override_dict.get(Timestamp, None)
        if timestamp_override:
            return timestamp_override(ns, data_type, override_dict)
        return 'datetime.datetime'
    elif is_alias(data_type):
        alias_type = cast(Alias, data_type)
        return map_stone_type_to_python_type(ns, alias_type.data_type, override_dict)
    elif is_user_defined_type(data_type):
        user_defined_type = cast(UserDefined, data_type)
        class_name = class_name_for_data_type(user_defined_type)
        if user_defined_type.namespace.name != ns.name:
            return '{}.{}'.format(
                fmt_namespace(user_defined_type.namespace.name), class_name)
        else:
            return class_name
    elif is_list_type(data_type):
        list_type = cast(List, data_type)
        if List in override_dict:
            return override_dict[List](ns, list_type.data_type, override_dict)

        # PyCharm understands this description format for a list
        return 'list of [{}]'.format(
            map_stone_type_to_python_type(ns, list_type.data_type, override_dict)
        )
    elif is_map_type(data_type):
        map_type = cast(Map, data_type)
        if Map in override_dict:
            return override_dict[Map](
                ns,
                data_type,
                override_dict
            )

        return 'dict of [{}:{}]'.format(
            map_stone_type_to_python_type(ns, map_type.key_data_type, override_dict),
            map_stone_type_to_python_type(ns, map_type.value_data_type, override_dict)
        )

    elif is_nullable_type(data_type):
        nullable_type = cast(Nullable, data_type)
        if Nullable in override_dict:
            return override_dict[Nullable](ns, nullable_type.data_type, override_dict)

        return 'Optional[{}]'.format(
            map_stone_type_to_python_type(ns, nullable_type.data_type, override_dict)
        )
    else:
        raise TypeError('Unknown data type %r' % data_type)
