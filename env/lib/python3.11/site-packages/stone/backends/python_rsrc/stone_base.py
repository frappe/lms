"""
Helpers for representing Stone data types in Python.
"""


import functools

from stone.backends.python_rsrc import stone_validators as bv

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

class AnnotationType:
    # This is a base class for all annotation types.
    pass

if _MYPY:
    T = typing.TypeVar('T', bound=AnnotationType)
    U = typing.TypeVar('U')


class NotSet:
    __slots__ = ()

    def __copy__(self):
        # type: () -> NotSet
        # disable copying so we can do identity comparison even after copying stone objects
        return self

    def __deepcopy__(self, memo):
        # type: (typing.Dict[typing.Text, typing.Any]) -> NotSet
        # disable copying so we can do identity comparison even after copying stone objects
        return self

    def __repr__(self):
        return "NOT_SET"


NOT_SET = NotSet()  # dummy object to denote that a field has not been set

NO_DEFAULT = object()


class Attribute:
    __slots__ = ("name", "default", "nullable", "user_defined", "validator")

    def __init__(self, name, nullable=False, user_defined=False):
        # type: (typing.Text, bool, bool) -> None
        # Internal name to store actual value for attribute.
        self.name = "_{}_value".format(name)
        self.nullable = nullable
        self.user_defined = user_defined
        # These should be set later, because of possible cross-references.
        self.validator = None  # type: typing.Any
        self.default = NO_DEFAULT

    def __get__(self, instance, owner):
        # type: (typing.Any, typing.Any) -> typing.Any
        if instance is None:
            return self
        value = getattr(instance, self.name)
        if value is not NOT_SET:
            return value
        if self.nullable:
            return None
        if self.default is not NO_DEFAULT:
            return self.default
        # No luck, give a nice error.
        raise AttributeError("missing required field '{}'".format(public_name(self.name)))

    def __set__(self, instance, value):
        # type: (typing.Any, typing.Any) -> None
        if self.nullable and value is None:
            setattr(instance, self.name, NOT_SET)
            return
        if self.user_defined:
            self.validator.validate_type_only(value)
        else:
            value = self.validator.validate(value)
        setattr(instance, self.name, value)

    def __delete__(self, instance):
        # type: (typing.Any) -> None
        setattr(instance, self.name, NOT_SET)


class Struct:
    # This is a base class for all classes representing Stone structs.

    # every parent class in the inheritance tree must define __slots__ in order to get full memory
    # savings
    __slots__ = ()

    _all_field_names_ = set()  # type: typing.Set[str]

    def __eq__(self, other):
        # type: (object) -> bool
        if not isinstance(other, Struct):
            return False

        if self._all_field_names_ != other._all_field_names_:
            return False

        if not isinstance(other, self.__class__) and not isinstance(self, other.__class__):
            return False

        for field_name in self._all_field_names_:
            if getattr(self, field_name) != getattr(other, field_name):
                return False

        return True

    def __ne__(self, other):
        # type: (object) -> bool
        return not self == other

    def __repr__(self):
        args = ["{}={!r}".format(name, getattr(self, "_{}_value".format(name)))
                for name in sorted(self._all_field_names_)]
        return "{}({})".format(type(self).__name__, ", ".join(args))

    def _process_custom_annotations(self, annotation_type, field_path, processor):
        # type: (typing.Type[T], typing.Text, typing.Callable[[T, U], U]) -> None
        pass

class Union:
    # TODO(kelkabany): Possible optimization is to remove _value if a
    # union is composed of only symbols.
    __slots__ = ['_tag', '_value']
    _tagmap = {}  # type: typing.Dict[str, bv.Validator]
    _permissioned_tagmaps = set()  # type: typing.Set[typing.Text]

    def __init__(self, tag, value=None):
        validator = None
        tagmap_names = ['_{}_tagmap'.format(map_name) for map_name in self._permissioned_tagmaps]
        for tagmap_name in ['_tagmap'] + tagmap_names:
            if tag in getattr(self, tagmap_name):
                validator = getattr(self, tagmap_name)[tag]
        assert validator is not None, 'Invalid tag %r.' % tag
        if isinstance(validator, bv.Void):
            assert value is None, 'Void type union member must have None value.'
        elif isinstance(validator, (bv.Struct, bv.Union)):
            validator.validate_type_only(value)
        else:
            validator.validate(value)
        self._tag = tag
        self._value = value

    def __eq__(self, other):
        # Also need to check if one class is a subclass of another. If one union extends another,
        # the common fields should be able to be compared to each other.
        return (
            isinstance(other, Union) and
            (isinstance(self, other.__class__) or isinstance(other, self.__class__)) and
            self._tag == other._tag and self._value == other._value
        )

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self._tag, self._value))

    def __repr__(self):
        return "{}({!r}, {!r})".format(type(self).__name__, self._tag, self._value)

    def _process_custom_annotations(self, annotation_type, field_path, processor):
        # type: (typing.Type[T], typing.Text, typing.Callable[[T, U], U]) -> None
        pass

    @classmethod
    def _is_tag_present(cls, tag, caller_permissions):
        assert tag is not None, 'tag value should not be None'

        if tag in cls._tagmap:
            return True

        for extra_permission in caller_permissions.permissions:
            tagmap_name = '_{}_tagmap'.format(extra_permission)
            if hasattr(cls, tagmap_name) and tag in getattr(cls, tagmap_name):
                return True

        return False

    @classmethod
    def _get_val_data_type(cls, tag, caller_permissions):
        assert tag is not None, 'tag value should not be None'

        for extra_permission in caller_permissions.permissions:
            tagmap_name = '_{}_tagmap'.format(extra_permission)
            if hasattr(cls, tagmap_name) and tag in getattr(cls, tagmap_name):
                return getattr(cls, tagmap_name)[tag]

        return cls._tagmap[tag]

class Route:
    __slots__ = ("name", "version", "deprecated", "arg_type", "result_type", "error_type", "attrs")

    def __init__(self, name, version, deprecated, arg_type, result_type, error_type, attrs):
        self.name = name
        self.version = version
        self.deprecated = deprecated
        self.arg_type = arg_type
        self.result_type = result_type
        self.error_type = error_type
        assert isinstance(attrs, dict), 'Expected dict, got %r' % attrs
        self.attrs = attrs

    def __repr__(self):
        return 'Route({!r}, {!r}, {!r}, {!r}, {!r}, {!r}, {!r})'.format(
            self.name,
            self.version,
            self.deprecated,
            self.arg_type,
            self.result_type,
            self.error_type,
            self.attrs)

# helper functions used when constructing custom annotation processors

# put this here so that every other file doesn't need to import functools
partially_apply = functools.partial

def make_struct_annotation_processor(annotation_type, processor):
    def g(field_path, struct):
        if struct is None:
            return struct
        struct._process_custom_annotations(annotation_type, field_path, processor)
        return struct
    return g

def make_list_annotation_processor(processor):
    def g(field_path, list_):
        if list_ is None:
            return list_
        return [processor('{}[{}]'.format(field_path, idx), x) for idx, x in enumerate(list_)]
    return g

def make_map_value_annotation_processor(processor):
    def g(field_path, map_):
        if map_ is None:
            return map_
        return {k: processor('{}[{}]'.format(field_path, repr(k)), v) for k, v in map_.items()}
    return g

def public_name(name):
    # _some_attr_value -> some_attr
    return "_".join(name.split("_")[1:-1])
