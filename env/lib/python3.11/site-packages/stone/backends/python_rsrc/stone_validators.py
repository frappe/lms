"""
Defines classes to represent each Stone type in Python. These classes should
be used to validate Python objects and normalize them for a given type.

The data types defined here should not be specific to an RPC or serialization
format.
"""


import datetime
import hashlib
import math
import numbers
import re
from abc import ABCMeta, abstractmethod

import six

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

# See <http://python3porting.com/differences.html#buffer>
_binary_types = (bytes, memoryview)  # noqa: E501,F821 # pylint: disable=undefined-variable,useless-suppression


class ValidationError(Exception):
    """Raised when a value doesn't pass validation by its validator."""

    def __init__(self, message, parent=None):
        """
        Args:
            message (str): Error message detailing validation failure.
            parent (str): Adds the parent as the closest reference point for
                the error. Use :meth:`add_parent` to add more.
        """
        super().__init__(message)
        self.message = message
        self._parents = []
        if parent:
            self._parents.append(parent)

    def add_parent(self, parent):
        """
        Args:
            parent (str): Adds the parent to the top of the tree of references
                that lead to the validator that failed.
        """
        self._parents.append(parent)

    def __str__(self):
        """
        Returns:
            str: A descriptive message of the validation error that may also
                include the path to the validator that failed.
        """
        if self._parents:
            return '{}: {}'.format('.'.join(self._parents[::-1]), self.message)
        else:
            return self.message

    def __repr__(self):
        # Not a perfect repr, but includes the error location information.
        return 'ValidationError(%r)' % str(self)


def type_name_with_module(t):
    # type: (typing.Type[typing.Any]) -> typing.Any
    return '{}.{}'.format(t.__module__, t.__name__)


def generic_type_name(v):
    # type: (typing.Any) -> typing.Any
    """Return a descriptive type name that isn't Python specific. For example,
    an int value will return 'integer' rather than 'int'."""
    if isinstance(v, bool):
        # Must come before any numbers checks since booleans are integers too
        return 'boolean'
    elif isinstance(v, numbers.Integral):
        # Must come before real numbers check since integrals are reals too
        return 'integer'
    elif isinstance(v, numbers.Real):
        return 'float'
    elif isinstance(v, (tuple, list)):
        return 'list'
    elif isinstance(v, str):
        return 'string'
    elif v is None:
        return 'null'
    else:
        return type_name_with_module(type(v))


def get_value_string(v, max_length=1000):
    # type: (typing.Any, int) -> str
    """Return a truncated version of the input string.  If the input string is longer than
       1000 characters, this will return the first 1000 characters and append with '[The
       string has been truncated due to its length]' to indicate that it has been truncated."""
    v_str = str(v)
    if len(v_str) > max_length:
        return v_str[:max_length] + ' [The string has been truncated due to its length]'
    return v_str


class Validator(metaclass=ABCMeta):
    """All primitive and composite data types should be a subclass of this."""
    __slots__ = ("_redact",)

    @abstractmethod
    def validate(self, val):
        """Validates that val is of this data type.

        Returns: A normalized value if validation succeeds.
        Raises: ValidationError
        """

    def has_default(self):
        return False

    def get_default(self):
        raise AssertionError('No default available.')


class Primitive(Validator):  # pylint: disable=abstract-method
    """A basic type that is defined by Stone."""
    __slots__ = ()


class Boolean(Primitive):
    __slots__ = ()

    def validate(self, val):
        if not isinstance(val, bool):
            raise ValidationError('%r is not a valid boolean' % val)
        return val


class Integer(Primitive):
    """
    Do not use this class directly. Extend it and specify a 'default_minimum' and
    'default_maximum' value as class variables for a more restrictive integer range.
    """
    __slots__ = ("minimum", "maximum")

    default_minimum = None  # type: typing.Optional[int]
    default_maximum = None  # type: typing.Optional[int]

    def __init__(self, min_value=None, max_value=None):
        """
        A more restrictive minimum or maximum value can be specified than the
        range inherent to the defined type.
        """
        if min_value is not None:
            assert isinstance(min_value, numbers.Integral), \
                'min_value must be an integral number'
            assert min_value >= self.default_minimum, \
                'min_value cannot be less than the minimum value for this ' \
                'type (%d < %d)' % (min_value, self.default_minimum)
            self.minimum = min_value
        else:
            self.minimum = self.default_minimum
        if max_value is not None:
            assert isinstance(max_value, numbers.Integral), \
                'max_value must be an integral number'
            assert max_value <= self.default_maximum, \
                'max_value cannot be greater than the maximum value for ' \
                'this type (%d < %d)' % (max_value, self.default_maximum)
            self.maximum = max_value
        else:
            self.maximum = self.default_maximum

    def validate(self, val):
        if not isinstance(val, numbers.Integral):
            raise ValidationError('expected integer, got %s'
                                  % generic_type_name(val))
        elif not (self.minimum <= val <= self.maximum):
            raise ValidationError('%d is not within range [%d, %d]'
                                  % (val, self.minimum, self.maximum))
        return val

    def __repr__(self):
        return '%s()' % self.__class__.__name__


class Int32(Integer):
    __slots__ = ()

    default_minimum = -2**31
    default_maximum = 2**31 - 1


class UInt32(Integer):
    __slots__ = ()

    default_minimum = 0
    default_maximum = 2**32 - 1


class Int64(Integer):
    __slots__ = ()

    default_minimum = -2**63
    default_maximum = 2**63 - 1


class UInt64(Integer):
    __slots__ = ()

    default_minimum = 0
    default_maximum = 2**64 - 1


class Real(Primitive):
    """
    Do not use this class directly. Extend it and optionally set a 'default_minimum'
    and 'default_maximum' value to enforce a range that's a subset of the Python float
    implementation. Python floats are doubles.
    """
    __slots__ = ("minimum", "maximum")

    default_minimum = None  # type: typing.Optional[float]
    default_maximum = None  # type: typing.Optional[float]

    def __init__(self, min_value=None, max_value=None):
        """
        A more restrictive minimum or maximum value can be specified than the
        range inherent to the defined type.
        """
        if min_value is not None:
            assert isinstance(min_value, numbers.Real), \
                'min_value must be a real number'
            if not isinstance(min_value, float):
                try:
                    min_value = float(min_value)
                except OverflowError:
                    raise AssertionError('min_value is too small for a float')
            if self.default_minimum is not None and min_value < self.default_minimum:
                raise AssertionError('min_value cannot be less than the '
                                     'minimum value for this type (%f < %f)' %
                                     (min_value, self.default_minimum))
            self.minimum = min_value
        else:
            self.minimum = self.default_minimum
        if max_value is not None:
            assert isinstance(max_value, numbers.Real), \
                'max_value must be a real number'
            if not isinstance(max_value, float):
                try:
                    max_value = float(max_value)
                except OverflowError:
                    raise AssertionError('max_value is too large for a float')
            if self.default_maximum is not None and max_value > self.default_maximum:
                raise AssertionError('max_value cannot be greater than the '
                                     'maximum value for this type (%f < %f)' %
                                     (max_value, self.default_maximum))
            self.maximum = max_value
        else:
            self.maximum = self.default_maximum

    def validate(self, val):
        if not isinstance(val, numbers.Real):
            raise ValidationError('expected real number, got %s' %
                                  generic_type_name(val))
        if not isinstance(val, float):
            # This checks for the case where a number is passed in with a
            # magnitude larger than supported by float64.
            try:
                val = float(val)
            except OverflowError:
                raise ValidationError('too large for float')
        if math.isnan(val) or math.isinf(val):
            raise ValidationError('%f values are not supported' % val)
        if self.minimum is not None and val < self.minimum:
            raise ValidationError('%f is not greater than %f' %
                                  (val, self.minimum))
        if self.maximum is not None and val > self.maximum:
            raise ValidationError('%f is not less than %f' %
                                  (val, self.maximum))
        return val

    def __repr__(self):
        return '%s()' % self.__class__.__name__


class Float32(Real):
    __slots__ = ()

    # Maximum and minimums from the IEEE 754-1985 standard
    default_minimum = -3.40282 * 10**38
    default_maximum = 3.40282 * 10**38


class Float64(Real):
    __slots__ = ()


class String(Primitive):
    """Represents a unicode string."""
    __slots__ = ("min_length", "max_length", "pattern", "pattern_re")

    def __init__(self, min_length=None, max_length=None, pattern=None):
        if min_length is not None:
            assert isinstance(min_length, numbers.Integral), \
                'min_length must be an integral number'
            assert min_length >= 0, 'min_length must be >= 0'
        if max_length is not None:
            assert isinstance(max_length, numbers.Integral), \
                'max_length must be an integral number'
            assert max_length > 0, 'max_length must be > 0'
        if min_length and max_length:
            assert max_length >= min_length, 'max_length must be >= min_length'
        if pattern is not None:
            assert isinstance(pattern, str), \
                'pattern must be a string'

        self.min_length = min_length
        self.max_length = max_length
        self.pattern = pattern
        self.pattern_re = None

        if pattern:
            try:
                self.pattern_re = re.compile(r"\A(?:" + pattern + r")\Z")
            except re.error as e:
                raise AssertionError('Regex {!r} failed: {}'.format(
                    pattern, e.args[0]))

    def validate(self, val):
        """
        A unicode string of the correct length and pattern will pass validation.
        In PY2, we enforce that a str type must be valid utf-8, and a unicode
        string will be returned.
        """
        if not isinstance(val, str):
            raise ValidationError("'%s' expected to be a string, got %s"
                                  % (get_value_string(val), generic_type_name(val)))
        if not six.PY3 and isinstance(val, str):
            try:
                val = val.decode('utf-8')
            except UnicodeDecodeError:
                raise ValidationError("'%s' was not valid utf-8")

        if self.max_length is not None and len(val) > self.max_length:
            raise ValidationError("'%s' must be at most %d characters, got %d"
                                  % (get_value_string(val), self.max_length, len(val)))
        if self.min_length is not None and len(val) < self.min_length:
            raise ValidationError("'%s' must be at least %d characters, got %d"
                                  % (get_value_string(val), self.min_length, len(val)))

        if self.pattern and not self.pattern_re.match(val):
            # Detect if pattern is matching an email address and return redacted error message.
            if self.pattern == "^['#&A-Za-z0-9._%+-]+@[A-Za-z0-9-][A-Za-z0-9.-]*\\.[A-Za-z]{2,15}$":
                val = "*****"

            raise ValidationError("'%s' did not match pattern '%s'"
                                  % (get_value_string(val), self.pattern))
        return val


class Bytes(Primitive):
    __slots__ = ("min_length", "max_length")

    def __init__(self, min_length=None, max_length=None):
        if min_length is not None:
            assert isinstance(min_length, numbers.Integral), \
                'min_length must be an integral number'
            assert min_length >= 0, 'min_length must be >= 0'
        if max_length is not None:
            assert isinstance(max_length, numbers.Integral), \
                'max_length must be an integral number'
            assert max_length > 0, 'max_length must be > 0'
        if min_length is not None and max_length is not None:
            assert max_length >= min_length, 'max_length must be >= min_length'

        self.min_length = min_length
        self.max_length = max_length

    def validate(self, val):
        if not isinstance(val, _binary_types):
            raise ValidationError("expected bytes type, got %s"
                                  % generic_type_name(val))
        elif self.max_length is not None and len(val) > self.max_length:
            raise ValidationError("'%s' must have at most %d bytes, got %d"
                                  % (get_value_string(val), self.max_length, len(val)))
        elif self.min_length is not None and len(val) < self.min_length:
            raise ValidationError("'%s' has fewer than %d bytes, got %d"
                                  % (get_value_string(val), self.min_length, len(val)))
        return val


class Timestamp(Primitive):
    """Note that while a format is specified, it isn't used in validation
    since a native Python datetime object is preferred. The format, however,
    can and should be used by serializers."""
    __slots__ = ("format",)

    def __init__(self, fmt):
        """fmt must be composed of format codes that the C standard (1989)
        supports, most notably in its strftime() function."""
        assert isinstance(fmt, str), 'format must be a string'
        self.format = fmt

    def validate(self, val):
        if not isinstance(val, datetime.datetime):
            raise ValidationError('expected timestamp, got %s'
                                  % generic_type_name(val))
        elif val.tzinfo is not None and \
                val.tzinfo.utcoffset(val).total_seconds() != 0:
            raise ValidationError('timestamp should have either a UTC '
                                  'timezone or none set at all')
        return val


class Composite(Validator):  # pylint: disable=abstract-method
    """Validator for a type that builds on other primitive and composite
    types."""
    __slots__ = ()


class List(Composite):
    """Assumes list contents are homogeneous with respect to types."""
    __slots__ = ("item_validator", "min_items", "max_items")

    def __init__(self, item_validator, min_items=None, max_items=None):
        """Every list item will be validated with item_validator."""
        self.item_validator = item_validator
        if min_items is not None:
            assert isinstance(min_items, numbers.Integral), \
                'min_items must be an integral number'
            assert min_items >= 0, 'min_items must be >= 0'
        if max_items is not None:
            assert isinstance(max_items, numbers.Integral), \
                'max_items must be an integral number'
            assert max_items > 0, 'max_items must be > 0'
        if min_items is not None and max_items is not None:
            assert max_items >= min_items, 'max_items must be >= min_items'

        self.min_items = min_items
        self.max_items = max_items

    def validate(self, val):
        if not isinstance(val, (tuple, list)):
            raise ValidationError('%r is not a valid list' % get_value_string(val))
        elif self.max_items is not None and len(val) > self.max_items:
            raise ValidationError('%r has more than %s items'
                                  % (get_value_string(val), self.max_items))
        elif self.min_items is not None and len(val) < self.min_items:
            raise ValidationError('%r has fewer than %s items'
                                  % (get_value_string(val), self.min_items))
        return [self.item_validator.validate(item) for item in val]


class Map(Composite):
    """Assumes map keys and values are homogeneous with respect to types."""
    __slots__ = ("key_validator", "value_validator")

    def __init__(self, key_validator, value_validator):
        """
        Every Map key/value pair will be validated with item_validator.
        key validators must be a subclass of a String validator
        """
        self.key_validator = key_validator
        self.value_validator = value_validator

    def validate(self, val):
        if not isinstance(val, dict):
            raise ValidationError('%r is not a valid dict' % get_value_string(val))
        return {
            self.key_validator.validate(key):
                self.value_validator.validate(value) for key, value in val.items()
        }


class Struct(Composite):
    __slots__ = ("definition",)

    def __init__(self, definition):
        """
        Args:
            definition (class): A generated class representing a Stone struct
                from a spec. Must have a _fields_ attribute with the following
                structure:

                _fields_ = [(field_name, validator), ...]

                where
                    field_name: Name of the field (str).
                    validator: Validator object.
        """
        super().__init__()
        self.definition = definition

    def validate(self, val):
        """
        For a val to pass validation, val must be of the correct type and have
        all required fields present.
        """
        self.validate_type_only(val)
        self.validate_fields_only(val)
        return val

    def validate_with_permissions(self, val, caller_permissions):
        """
        For a val to pass validation, val must be of the correct type and have
        all required permissioned fields present. Should only be called
        for callers with extra permissions.
        """
        self.validate(val)
        self.validate_fields_only_with_permissions(val, caller_permissions)
        return val

    def validate_fields_only(self, val):
        """
        To pass field validation, no required field should be missing.

        This method assumes that the contents of each field have already been
        validated on assignment, so it's merely a presence check.

        FIXME(kelkabany): Since the definition object does not maintain a list
        of which fields are required, all fields are scanned.
        """
        for field_name in self.definition._all_field_names_:
            if not hasattr(val, field_name):
                raise ValidationError("missing required field '%s'" %
                                      field_name)

    def validate_fields_only_with_permissions(self, val, caller_permissions):
        """
        To pass field validation, no required field should be missing.
        This method assumes that the contents of each field have already been
        validated on assignment, so it's merely a presence check.
        Should only be called for callers with extra permissions.
        """
        self.validate_fields_only(val)

        # check if type has been patched
        for extra_permission in caller_permissions.permissions:
            all_field_names = '_all_{}_field_names_'.format(extra_permission)
            for field_name in getattr(self.definition, all_field_names, set()):
                if not hasattr(val, field_name):
                    raise ValidationError("missing required field '%s'" % field_name)

    def validate_type_only(self, val):
        """
        Use this when you only want to validate that the type of an object
        is correct, but not yet validate each field.
        """
        # Since the definition maintains the list of fields for serialization,
        # we're okay with a subclass that might have extra information. This
        # makes it easier to return one subclass for two routes, one of which
        # relies on the parent class.
        if not isinstance(val, self.definition):
            raise ValidationError('expected type %s, got %s' %
                (
                    type_name_with_module(self.definition),
                    generic_type_name(val),
                ),
            )

    def has_default(self):
        return not self.definition._has_required_fields

    def get_default(self):
        assert not self.definition._has_required_fields, 'No default available.'
        return self.definition()


class StructTree(Struct):
    """Validator for structs with enumerated subtypes.

    NOTE: validate_fields_only() validates the fields known to this base
    struct, but does not do any validation specific to the subtype.
    """
    __slots__ = ()

    # See PyCQA/pylint#1043 for why this is disabled; this should show up
    # as a usless-suppression (and can be removed) once a fix is released
    def __init__(self, definition):  # pylint: disable=useless-super-delegation
        super().__init__(definition)


class Union(Composite):
    __slots__ = ("definition",)

    def __init__(self, definition):
        """
        Args:
            definition (class): A generated class representing a Stone union
                from a spec. Must have a _tagmap attribute with the following
                structure:

                _tagmap = {field_name: validator, ...}

                where
                    field_name (str): Tag name.
                    validator (Validator): Tag value validator.
        """
        self.definition = definition

    def validate(self, val):
        """
        For a val to pass validation, it must have a _tag set. This assumes
        that the object validated that _tag is a valid tag, and that any
        associated value has also been validated.
        """
        self.validate_type_only(val)
        if not hasattr(val, '_tag') or val._tag is None:
            raise ValidationError('no tag set')
        return val

    def validate_type_only(self, val):
        """
        Use this when you only want to validate that the type of an object
        is correct, but not yet validate each field.

        We check whether val is a Python parent class of the definition. This
        is because Union subtyping works in the opposite direction of Python
        inheritance. For example, if a union U2 extends U1 in Python, this
        validator will accept U1 in places where U2 is expected.
        """
        if not issubclass(self.definition, type(val)):
            raise ValidationError('expected type %s or subtype, got %s' %
                (
                    type_name_with_module(self.definition),
                    generic_type_name(val),
                ),
            )


class Void(Primitive):
    __slots__ = ()

    def validate(self, val):
        if val is not None:
            raise ValidationError('expected NoneType, got %s' %
                                  generic_type_name(val))

    def has_default(self):
        return True

    def get_default(self):
        return None


class Nullable(Validator):
    __slots__ = ("validator",)

    def __init__(self, validator):
        super().__init__()
        assert isinstance(validator, (Primitive, Composite)), \
            'validator must be for a primitive or composite type'
        assert not isinstance(validator, Nullable), \
            'nullables cannot be stacked'
        assert not isinstance(validator, Void), \
            'void cannot be made nullable'
        self.validator = validator

    def validate(self, val):
        if val is None:
            return
        else:
            return self.validator.validate(val)

    def validate_type_only(self, val):
        """Use this only if Nullable is wrapping a Composite."""
        if val is None:
            return
        else:
            return self.validator.validate_type_only(val)

    def has_default(self):
        return True

    def get_default(self):
        return None


class Redactor:
    __slots__ = ("regex",)

    def __init__(self, regex):
        """
        Args:
            regex: What parts of the field to redact.
        """
        self.regex = regex

    @abstractmethod
    def apply(self, val):
        """Redacts information from annotated field.
        Returns: A redacted version of the string provided.
        """

    def _get_matches(self, val):
        if not self.regex:
            return None
        try:
            return re.search(self.regex, val)
        except TypeError:
            return None


class HashRedactor(Redactor):
    __slots__ = ()

    def apply(self, val):
        matches = self._get_matches(val)

        val_to_hash = str(val) if isinstance(val, int) or isinstance(val, float) else val

        try:
            # add string literal to ensure unicode
            hashed = hashlib.md5(val_to_hash.encode('utf-8')).hexdigest() + ''
        except [AttributeError, ValueError]:
            hashed = None

        if matches:
            blotted = '***'.join(matches.groups())
            if hashed:
                return '{} ({})'.format(hashed, blotted)
            return blotted
        return hashed


class BlotRedactor(Redactor):
    __slots__ = ()

    def apply(self, val):
        matches = self._get_matches(val)
        if matches:
            return '***'.join(matches.groups())
        return '********'
