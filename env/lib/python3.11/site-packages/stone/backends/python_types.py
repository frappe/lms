"""
Backend for generating Python types that match the spec.
"""


import argparse
import itertools
import re

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

from stone.ir import AnnotationType, ApiNamespace
from stone.ir import (
    is_alias,
    is_boolean_type,
    is_composite_type,
    is_bytes_type,
    is_list_type,
    is_map_type,
    is_nullable_type,
    is_numeric_type,
    is_string_type,
    is_struct_type,
    is_tag_ref,
    is_timestamp_type,
    is_union_type,
    is_user_defined_type,
    is_void_type,
    RedactedBlot,
    RedactedHash,
    Struct,
    Union,
    unwrap,
    unwrap_aliases,
    unwrap_nullable,
)
from stone.ir import DataType
from stone.backend import CodeBackend
from stone.backends.python_helpers import (
    class_name_for_annotation_type,
    class_name_for_data_type,
    check_route_name_conflict,
    emit_pass_if_nothing_emitted,
    fmt_class,
    fmt_func,
    fmt_namespace,
    fmt_namespaced_var,
    fmt_obj,
    fmt_var,
    generate_imports_for_referenced_namespaces,
    generate_module_header,
    validators_import,
)
from stone.backends.python_type_mapping import map_stone_type_to_python_type

# Matches format of Stone doc tags
doc_sub_tag_re = re.compile(':(?P<tag>[A-z]*):`(?P<val>.*?)`')

_cmdline_parser = argparse.ArgumentParser(prog='python-types-backend')
_cmdline_parser.add_argument(
    '-r',
    '--route-method',
    help=('A string used to construct the location of a Python method for a '
          'given route; use {ns} as a placeholder for namespace name and '
          '{route} for the route name. This is used to translate Stone doc '
          'references to routes to references in Python docstrings.'),
)
_cmdline_parser.add_argument(
    '-p',
    '--package',
    type=str,
    required=True,
    help='Package prefix for absolute imports in generated files.',
)


class PythonTypesBackend(CodeBackend):
    """Generates Python modules to represent the input Stone spec."""

    cmdline_parser = _cmdline_parser

    # Instance var of the current namespace being generated
    cur_namespace = None  # type: typing.Optional[ApiNamespace]

    preserve_aliases = True

    def generate(self, api):
        """
        Generates a module for each namespace.

        Each namespace will have Python classes to represent data types and
        routes in the Stone spec.
        """
        with self.output_to_relative_path('__init__.py', mode='ab'):
            pass
        with self.output_to_relative_path('stone_base.py'):
            self.emit("from stone.backends.python_rsrc.stone_base import *")
        with self.output_to_relative_path('stone_serializers.py'):
            self.emit("from stone.backends.python_rsrc.stone_serializers import *")
        with self.output_to_relative_path('stone_validators.py'):
            self.emit("from stone.backends.python_rsrc.stone_validators import *")
        for namespace in api.namespaces.values():
            reserved_namespace_name = fmt_namespace(namespace.name)
            with self.output_to_relative_path('{}.py'.format(reserved_namespace_name)):
                self._generate_base_namespace_module(api, namespace)
            if reserved_namespace_name != namespace.name:
                with self.output_to_relative_path('{}.py'.format(namespace.name)):
                    self._generate_dummy_namespace_module(reserved_namespace_name)

    def _generate_base_namespace_module(self, api, namespace):
        """Creates a module for the namespace. All data types and routes are
        represented as Python classes."""

        self.cur_namespace = namespace
        generate_module_header(self)

        if namespace.doc is not None:
            self.emit('"""')
            self.emit_raw(self.process_doc(namespace.doc, self._docf))
            self.emit('"""')
            self.emit()

        self.emit("from __future__ import unicode_literals")

        self.emit_raw(validators_import)

        # Generate import statements for all referenced namespaces.
        self._generate_imports_for_referenced_namespaces(namespace)

        for annotation_type in namespace.annotation_types:
            self._generate_annotation_type_class(namespace, annotation_type)

        for data_type in namespace.linearize_data_types():
            if isinstance(data_type, Struct):
                self._generate_struct_class(namespace, data_type)
            elif isinstance(data_type, Union):
                self._generate_union_class(namespace, data_type)
            else:
                raise TypeError('Cannot handle type %r' % type(data_type))

        for alias in namespace.linearize_aliases():
            self._generate_alias_definition(namespace, alias)

        # Generate the struct->subtype tag mapping at the end so that
        # references to later-defined subtypes don't cause errors.
        for data_type in namespace.linearize_data_types():
            if is_struct_type(data_type):
                self._generate_struct_class_reflection_attributes(
                    namespace, data_type)
                if data_type.has_enumerated_subtypes():
                    self._generate_enumerated_subtypes_tag_mapping(
                        namespace, data_type)
            elif is_union_type(data_type):
                self._generate_union_class_reflection_attributes(
                    namespace, data_type)
                self._generate_union_class_symbol_creators(data_type)

        for data_type in namespace.linearize_data_types():
            if is_struct_type(data_type):
                self._generate_struct_attributes_defaults(
                    namespace, data_type)

        self._generate_routes(api.route_schema, namespace)

    def _generate_dummy_namespace_module(self, reserved_namespace_name):
        generate_module_header(self)
        self.emit('# If you have issues importing this module because Python recognizes it as a '
                  'keyword, use {} instead.'.format(reserved_namespace_name))
        self.emit('from .{} import *'.format(reserved_namespace_name))

    def _generate_alias_definition(self, namespace, alias):
        v = generate_validator_constructor(namespace, alias.data_type)
        if alias.doc:
            self.emit_wrapped_text(
                self.process_doc(alias.doc, self._docf), prefix='# ')
        validator_name = '{}_validator'.format(alias.name)
        self.emit('{} = {}'.format(validator_name, v))
        if alias.redactor:
            self._generate_redactor(validator_name, alias.redactor)

        unwrapped_dt, _ = unwrap_aliases(alias)
        if is_user_defined_type(unwrapped_dt):
            # If the alias is to a composite type, we want to alias the
            # generated class as well.
            self.emit('{} = {}'.format(
                alias.name,
                class_name_for_data_type(alias.data_type, namespace)))

    def _generate_imports_for_referenced_namespaces(self, namespace):
        # type: (ApiNamespace) -> None
        assert self.args is not None
        generate_imports_for_referenced_namespaces(
            backend=self,
            namespace=namespace,
            package=self.args.package,
        )

    def _docf(self, tag, val):
        """
        Callback used as the handler argument to process_docs(). This converts
        Stone doc references to Sphinx-friendly annotations.
        """
        if tag == 'type':
            return ':class:`{}`'.format(val)
        elif tag == 'route':
            if self.args.route_method:
                return ':meth:`%s`' % self.args.route_method.format(
                    ns=self.cur_namespace.name, route=fmt_func(val))
            else:
                return val
        elif tag == 'link':
            anchor, link = val.rsplit(' ', 1)
            return '`{} <{}>`_'.format(anchor, link)
        elif tag == 'val':
            if val == 'null':
                return 'None'
            elif val == 'true' or val == 'false':
                return '``{}``'.format(val.capitalize())
            else:
                return val
        elif tag == 'field':
            return '``{}``'.format(val)
        else:
            raise RuntimeError('Unknown doc ref tag %r' % tag)

    def _python_type_mapping(self, ns, data_type):
        # type: (ApiNamespace, DataType) -> typing.Text
        """Map Stone data types to their most natural equivalent in Python
        for documentation purposes."""
        return map_stone_type_to_python_type(ns, data_type)

    def _class_declaration_for_type(self, ns, data_type):
        assert is_user_defined_type(data_type), \
            'Expected struct, got %r' % type(data_type)
        if data_type.parent_type:
            extends = class_name_for_data_type(data_type.parent_type, ns)
        else:
            if is_struct_type(data_type):
                # Use a handwritten base class
                extends = 'bb.Struct'
            elif is_union_type(data_type):
                extends = 'bb.Union'
            else:
                extends = 'object'
        return 'class {}({}):'.format(
            class_name_for_data_type(data_type), extends)

    #
    # Annotation types
    #

    def _generate_annotation_type_class(self, ns, annotation_type):
        # type: (ApiNamespace, AnnotationType) -> None
        """Defines a Python class that represents an annotation type in Stone."""
        self.emit('class {}(bb.AnnotationType):'.format(
            class_name_for_annotation_type(annotation_type, ns)))
        with self.indent():
            if annotation_type.has_documented_type_or_params():
                self.emit('"""')
                if annotation_type.doc:
                    self.emit_wrapped_text(
                        self.process_doc(annotation_type.doc, self._docf))
                    if annotation_type.has_documented_params():
                        self.emit()
                for param in annotation_type.params:
                    if not param.doc:
                        continue
                    self.emit_wrapped_text(':ivar {}: {}'.format(
                        fmt_var(param.name, True),
                        self.process_doc(param.doc, self._docf)),
                        subsequent_prefix='    ')
                self.emit('"""')
            self.emit()

            self._generate_annotation_type_class_slots(annotation_type)
            self._generate_annotation_type_class_init(ns, annotation_type)
            self._generate_annotation_type_class_properties(ns, annotation_type)
            self.emit()

    def _generate_annotation_type_class_slots(self, annotation_type):
        # type: (AnnotationType) -> None
        with self.block('__slots__ =', delim=('[', ']')):
            for param in annotation_type.params:
                param_name = fmt_var(param.name, True)
                self.emit("'_{}',".format(param_name))
        self.emit()

    def _generate_annotation_type_class_init(self, ns, annotation_type):
        # type: (ApiNamespace, AnnotationType) -> None
        args = ['self']
        for param in annotation_type.params:
            param_name = fmt_var(param.name, True)
            default_value = (self._generate_python_value(ns, param.default)
                             if param.has_default else 'None')
            args.append('{}={}'.format(param_name, default_value))
        self.generate_multiline_list(args, before='def __init__', after=':')

        with self.indent():
            for param in annotation_type.params:
                self.emit('self._{0} = {0}'.format(fmt_var(param.name, True)))
        self.emit()

    def _generate_annotation_type_class_properties(self, ns, annotation_type):
        # type: (ApiNamespace, AnnotationType) -> None
        for param in annotation_type.params:
            param_name = fmt_var(param.name, True)
            prop_name = fmt_func(param.name, True)
            self.emit('@property')
            self.emit('def {}(self):'.format(prop_name))
            with self.indent():
                self.emit('"""')
                if param.doc:
                    self.emit_wrapped_text(
                        self.process_doc(param.doc, self._docf))
                    # Sphinx wants an extra line between the text and the
                    # rtype declaration.
                    self.emit()
                self.emit(':rtype: {}'.format(
                    self._python_type_mapping(ns, param.data_type)))
                self.emit('"""')
                self.emit('return self._{}'.format(param_name))
            self.emit()

    #
    # Struct Types
    #

    def _generate_struct_class(self, ns, data_type):
        # type: (ApiNamespace, Struct) -> None
        """Defines a Python class that represents a struct in Stone."""
        self.emit(self._class_declaration_for_type(ns, data_type))
        with self.indent():
            if data_type.has_documented_type_or_fields():
                self.emit('"""')
                if data_type.doc:
                    self.emit_wrapped_text(
                        self.process_doc(data_type.doc, self._docf))
                    if data_type.has_documented_fields():
                        self.emit()
                for field in data_type.fields:
                    if not field.doc:
                        continue
                    self.emit_wrapped_text(':ivar {}: {}'.format(
                        fmt_namespaced_var(ns.name, data_type.name, field.name),
                        self.process_doc(field.doc, self._docf)),
                        subsequent_prefix='    ')
                self.emit('"""')
            self.emit()

            self._generate_struct_class_slots(data_type)
            self._generate_struct_class_has_required_fields(data_type)
            self._generate_struct_class_init(data_type)
            self._generate_struct_class_properties(ns, data_type)
            self._generate_struct_class_custom_annotations(ns, data_type)
        if data_type.has_enumerated_subtypes():
            validator = 'StructTree'
        else:
            validator = 'Struct'
        self.emit('{0}_validator = bv.{1}({0})'.format(
            class_name_for_data_type(data_type),
            validator,
        ))
        self.emit()

    def _func_args_from_dict(self, d):
        """Given a Python dictionary, creates a string representing arguments
        for invoking a function. All arguments with a value of None are
        ignored."""
        filtered_d = self.filter_out_none_valued_keys(d)
        return ', '.join(['{}={}'.format(k, v) for k, v in filtered_d.items()])

    def _generate_struct_class_slots(self, data_type):
        """Creates a slots declaration for struct classes.

        Slots are an optimization in Python. They reduce the memory footprint
        of instances since attributes cannot be added after declaration.
        """
        with self.block('__slots__ =', delim=('[', ']')):
            for field in data_type.fields:
                field_name = fmt_var(field.name)
                self.emit("'_%s_value'," % field_name)
        self.emit()

    def _generate_struct_class_has_required_fields(self, data_type):
        has_required_fields = len(data_type.all_required_fields) > 0
        self.emit('_has_required_fields = %r' % has_required_fields)
        self.emit()

    def _generate_struct_class_reflection_attributes(self, ns, data_type):
        """
        Generates two class attributes:
          * _all_field_names_: Set of all field names including inherited fields.
          * _all_fields_: List of tuples, where each tuple is (name, validator).

        If a struct has enumerated subtypes, then two additional attributes are
        generated:
          * _field_names_: Set of all field names excluding inherited fields.
          * _fields: List of tuples, where each tuple is (name, validator), and
            excludes inherited fields.

        These are needed because serializing a struct with enumerated subtypes
        requires knowing the fields defined in each level of the hierarchy.
        """

        class_name = class_name_for_data_type(data_type)
        if data_type.parent_type:
            parent_type_class_name = class_name_for_data_type(
                data_type.parent_type, ns)
        else:
            parent_type_class_name = None

        for field in data_type.fields:
            field_name = fmt_var(field.name)
            validator_name = generate_validator_constructor(ns, field.data_type)
            full_validator_name = '{}.{}.validator'.format(class_name, field_name)
            self.emit('{} = {}'.format(full_validator_name, validator_name))
            if field.redactor:
                self._generate_redactor(full_validator_name, field.redactor)

        # Generate `_all_field_names_` and `_all_fields_` for every omitted caller (and public).
        # As an edge case, we union omitted callers with None in the case when the object has no
        # public fields, as we still need to generate public attributes (`_field_names_` etc)
        child_omitted_callers = data_type.get_all_omitted_callers() | {None}
        parent_omitted_callers = data_type.parent_type.get_all_omitted_callers() if \
            data_type.parent_type else set()

        for omitted_caller in sorted(child_omitted_callers | parent_omitted_callers, key=str):
            is_public = omitted_caller is None
            map_name_prefix = '' if is_public else '_{}'.format(omitted_caller)
            caller_in_parent = data_type.parent_type and (is_public or omitted_caller
                                                         in parent_omitted_callers)

            # generate `_all_field_names_`
            names_map_name = '{}_field_names_'.format(map_name_prefix)
            all_names_map_name = '_all{}_field_names_'.format(map_name_prefix)
            if data_type.is_member_of_enumerated_subtypes_tree():
                if is_public or omitted_caller in child_omitted_callers:
                    self.generate_multiline_list(
                        [
                            "'%s'" % field.name
                            for field in data_type.fields
                            if field.omitted_caller == omitted_caller
                        ],
                        before='{}.{} = set('.format(class_name, names_map_name),
                        after=')',
                        delim=('[', ']'),
                        compact=False)
                if caller_in_parent:
                    self.emit('{0}.{3} = {1}.{3}.union({0}.{2})'
                              .format(class_name, parent_type_class_name, names_map_name,
                                      all_names_map_name))
                else:
                    self.emit('{0}.{2} = {0}.{1}'.format(class_name, names_map_name,
                                                         all_names_map_name))
            else:
                if caller_in_parent:
                    before = '{0}.{1} = {2}.{1}.union(set('.format(class_name, all_names_map_name,
                                                                   parent_type_class_name)
                    after = '))'
                else:
                    before = '{}.{} = set('.format(class_name, all_names_map_name)
                    after = ')'
                items = [
                    "'%s'" % field.name
                    for field in data_type.fields
                    if field.omitted_caller == omitted_caller
                ]
                self.generate_multiline_list(
                    items,
                    before=before,
                    after=after,
                    delim=('[', ']'),
                    compact=False)

            # generate `_all_fields_`
            fields_map_name = '{}_fields_'.format(map_name_prefix)
            all_fields_map_name = '_all{}_fields_'.format(map_name_prefix)
            if data_type.is_member_of_enumerated_subtypes_tree():
                items = []
                for field in data_type.fields:
                    if field.omitted_caller != omitted_caller:
                        continue

                    var_name = fmt_var(field.name)
                    validator_name = '{}.{}.validator'.format(class_name, var_name)
                    items.append("('{}', {})".format(var_name, validator_name))
                self.generate_multiline_list(
                    items,
                    before='{}.{} = '.format(class_name, fields_map_name),
                    delim=('[', ']'),
                    compact=False,
                )
                if caller_in_parent:
                    self.emit('{0}.{3} = {1}.{3} + {0}.{2}'.format(
                        class_name, parent_type_class_name, fields_map_name, all_fields_map_name))
                else:
                    self.emit('{0}.{2} = {0}.{1}'.format(
                        class_name, fields_map_name, all_fields_map_name))
            else:
                if caller_in_parent:
                    before = '{0}.{2} = {1}.{2} + '.format(
                        class_name, parent_type_class_name, all_fields_map_name)
                else:
                    before = '{}.{} = '.format(class_name, all_fields_map_name)

                items = []
                for field in data_type.fields:
                    if field.omitted_caller != omitted_caller:
                        continue

                    var_name = fmt_var(field.name)
                    validator_name = '{}.{}.validator'.format(
                        class_name, var_name)
                    items.append("('{}', {})".format(var_name, validator_name))
                self.generate_multiline_list(
                    items, before=before, delim=('[', ']'), compact=False)

        self.emit()

    def _generate_struct_attributes_defaults(self, ns, data_type):
        # Default values can cross-reference, so we also set them after classes.
        class_name = class_name_for_data_type(data_type)
        for field in data_type.fields:
            if field.has_default:
                self.emit(
                    "{}.{}.default = {}".format(
                        class_name,
                        fmt_var(field.name),
                        self._generate_python_value(ns, field.default))
                )

    def _generate_struct_class_init(self, data_type):
        """
        Generates constructor. The constructor takes all possible fields as
        optional arguments. Any argument that is set on construction sets the
        corresponding field for the instance.
        """

        args = ['self']
        for field in data_type.all_fields:
            field_name_reserved_check = fmt_var(field.name, True)
            args.append('%s=None' % field_name_reserved_check)

        self.generate_multiline_list(args, before='def __init__', after=':')

        with self.indent():
            lineno = self.lineno

            # Call the parent constructor if a super type exists
            if data_type.parent_type:
                class_name = class_name_for_data_type(data_type)
                all_parent_fields = [fmt_func(f.name, check_reserved=True)
                              for f in data_type.parent_type.all_fields]
                self.generate_multiline_list(
                    all_parent_fields,
                    before='super({}, self).__init__'.format(class_name))

            # initialize each field
            for field in data_type.fields:
                field_var_name = fmt_var(field.name)
                self.emit('self._{}_value = bb.NOT_SET'.format(field_var_name))

            # handle arguments that were set
            for field in data_type.fields:
                field_var_name = fmt_var(field.name, True)
                self.emit('if {} is not None:'.format(field_var_name))
                with self.indent():
                    self.emit('self.{0} = {0}'.format(field_var_name))

            if lineno == self.lineno:
                self.emit('pass')
            self.emit()

    def _generate_python_value(self, ns, value):
        if is_tag_ref(value):
            ref = '{}.{}'.format(class_name_for_data_type(value.union_data_type),
                                 fmt_var(value.tag_name))
            if ns != value.union_data_type.namespace:
                ref = '{}.{}'.format(fmt_namespace(value.union_data_type.namespace.name), ref)
            return ref
        else:
            return fmt_obj(value)

    def _generate_struct_class_properties(self, ns, data_type):
        """
        Each field of the struct has a corresponding setter and getter.
        The setter validates the value being set.
        """
        for field in data_type.fields:
            field_name = fmt_func(field.name, check_reserved=True)
            if is_nullable_type(field.data_type):
                field_dt = field.data_type.data_type
                dt_nullable = True
            else:
                field_dt = field.data_type
                dt_nullable = False

            # generate getter for field
            args = '"{}"'.format(field_name)
            if dt_nullable:
                args += ", nullable=True"
            if is_user_defined_type(field_dt):
                args += ", user_defined=True"
            self.emit(
                '# Instance attribute type: {} (validator is set below)'.format(
                    self._python_type_mapping(ns, field_dt)
                )
            )
            self.emit("{} = bb.Attribute({})".format(field_name, args))
            self.emit()

    def _generate_custom_annotation_instance(self, ns, annotation):
        """
        Generates code to construct an instance of an annotation type object
        with parameters from the specified annotation.
        """
        annotation_class = class_name_for_annotation_type(annotation.annotation_type, ns)
        return generate_func_call(
            annotation_class,
            kwargs=((fmt_var(k, True), self._generate_python_value(ns, v))
                    for k, v in annotation.kwargs.items())
        )

    def _generate_custom_annotation_processors(self, ns, data_type, extra_annotations=()):
        """
        Generates code that will run a custom function 'processor' on every
        field with a custom annotation, no matter how deep (recursively) it
        might be located in data_type (incl. in elements of lists or maps).
        If extra_annotations is passed, it's assumed to be a list of custom
        annotation applied directly onto data_type (e.g. because it's a field
        in a struct).
        Yields pairs of (annotation_type, code) where code is code that
        evaluates to a function that should be executed with an instance of
        data_type as the only parameter, and whose return value should replace
        that instance.
        """
        # annotations applied to members of this type
        dt, _, _ = unwrap(data_type)
        if is_struct_type(dt) or is_union_type(dt):
            annotation_types_seen = set()
            # If data type enumerates subtypes, recurse to subtypes instead which in turn collect
            # parents' custom annotations
            if is_struct_type(dt) and dt.has_enumerated_subtypes():
                for subtype in dt.get_enumerated_subtypes():
                    processors = self._generate_custom_annotation_processors(ns, subtype.data_type)
                    for annotation_type, recursive_processor in processors:
                        if annotation_type not in annotation_types_seen:
                            yield (annotation_type, recursive_processor)
                            annotation_types_seen.add(annotation_type)
            else:
                for _, annotation in dt.recursive_custom_annotations:
                    if annotation.annotation_type not in annotation_types_seen:
                        yield (annotation.annotation_type,
                               generate_func_call(
                                   'bb.make_struct_annotation_processor',
                                   args=[class_name_for_annotation_type(annotation.annotation_type,
                                    ns),
                                         'processor']
                               ))
                        annotation_types_seen.add(annotation.annotation_type)
        elif is_list_type(dt):
            for annotation_type, recursive_processor in self._generate_custom_annotation_processors(
                    ns, dt.data_type):
                # every member needs to be replaced---use handwritten processor
                yield (annotation_type,
                       generate_func_call(
                           'bb.make_list_annotation_processor',
                           args=[recursive_processor]
                       ))
        elif is_map_type(dt):
            for annotation_type, recursive_processor in self._generate_custom_annotation_processors(
                    ns, dt.value_data_type):
                # every value needs to be replaced---use handwritten processor
                yield (annotation_type,
                       generate_func_call(
                           'bb.make_map_value_annotation_processor',
                           args=[recursive_processor]
                       ))

        # annotations applied directly to this type (through aliases or
        # passed in from the caller)
        indirect_annotations = dt.recursive_custom_annotations if is_composite_type(dt) else set()
        all_annotations = (data_type.recursive_custom_annotations
                           if is_composite_type(data_type) else set())
        remaining_annotations = [annotation for _, annotation in
                                 all_annotations.difference(indirect_annotations)]
        for annotation in itertools.chain(remaining_annotations,
                                          extra_annotations):
            yield (annotation.annotation_type,
                   generate_func_call(
                       'bb.partially_apply',
                       args=['processor', self._generate_custom_annotation_instance(ns, annotation)]
                   ))

    def _generate_struct_class_custom_annotations(self, ns, data_type):
        """
        The _process_custom_annotations function allows client code to access
        custom annotations defined in the spec.
        """
        self.emit('def _process_custom_annotations(self, annotation_type, field_path, processor):')

        with self.indent(), emit_pass_if_nothing_emitted(self):
            self.emit(
                (
                    'super({}, self)._process_custom_annotations(annotation_type, field_path, '
                    'processor)'
                ).format(class_name_for_data_type(data_type))
            )
            self.emit()

            for field in data_type.fields:
                field_name = fmt_var(field.name, check_reserved=True)
                recursive_processors = list(self._generate_custom_annotation_processors(
                    ns, field.data_type, field.custom_annotations))
                recursive_processors = sorted(recursive_processors, key=lambda x: x[0].name)
                for annotation_type, processor in recursive_processors:
                    annotation_class = class_name_for_annotation_type(annotation_type, ns)
                    self.emit('if annotation_type is {}:'.format(annotation_class))
                    with self.indent():
                        self.emit('self.{} = {}'.format(
                            field_name,
                            generate_func_call(
                                processor,
                                args=[
                                    "'{{}}.{}'.format(field_path)".format(field_name),
                                    'self.{}'.format(field_name),
                                ])
                        ))
                    self.emit()

    def _generate_enumerated_subtypes_tag_mapping(self, ns, data_type):
        """
        Generates attributes needed for serializing and deserializing structs
        with enumerated subtypes. These assignments are made after all the
        Python class definitions to ensure that all references exist.
        """
        assert data_type.has_enumerated_subtypes()

        # Generate _tag_to_subtype_ attribute: Map from string type tag to
        # the validator of the referenced subtype. Used on deserialization
        # to look up the subtype for a given tag.
        tag_to_subtype_items = []
        for tags, subtype in data_type.get_all_subtypes_with_tags():
            tag_to_subtype_items.append("{}: {}".format(
                tags,
                generate_validator_constructor(ns, subtype)))

        self.generate_multiline_list(
            tag_to_subtype_items,
            before='{}._tag_to_subtype_ = '.format(data_type.name),
            delim=('{', '}'),
            compact=False)

        # Generate _pytype_to_tag_and_subtype_: Map from Python class to a
        # tuple of (type tag, subtype). Used on serialization to lookup how a
        # class should be encoded based on the root struct's enumerated
        # subtypes.
        items = []
        for tag, subtype in data_type.get_all_subtypes_with_tags():
            items.append("{}: ({}, {})".format(
                fmt_class(subtype.name),
                tag,
                generate_validator_constructor(ns, subtype)))
        self.generate_multiline_list(
            items,
            before='{}._pytype_to_tag_and_subtype_ = '.format(data_type.name),
            delim=('{', '}'),
            compact=False)

        # Generate _is_catch_all_ attribute:
        self.emit('{}._is_catch_all_ = {!r}'.format(
            data_type.name, data_type.is_catch_all()))

        self.emit()

    #
    # Tagged Union Types
    #

    def _generate_union_class(self, ns, data_type):
        # type: (ApiNamespace, Union) -> None
        """Defines a Python class that represents a union in Stone."""
        self.emit(self._class_declaration_for_type(ns, data_type))
        with self.indent():
            self.emit('"""')
            if data_type.doc:
                self.emit_wrapped_text(
                    self.process_doc(data_type.doc, self._docf))
                self.emit()

            self.emit_wrapped_text(
                'This class acts as a tagged union. Only one of the ``is_*`` '
                'methods will return true. To get the associated value of a '
                'tag (if one exists), use the corresponding ``get_*`` method.')

            if data_type.has_documented_fields():
                self.emit()

            for field in data_type.fields:
                if not field.doc:
                    continue
                if is_void_type(field.data_type):
                    ivar_doc = ':ivar {}: {}'.format(
                        fmt_namespaced_var(ns.name, data_type.name, field.name),
                        self.process_doc(field.doc, self._docf))
                elif is_user_defined_type(field.data_type):
                    if data_type.namespace.name != ns.name:
                        formatted_var = fmt_namespaced_var(ns.name, data_type.name, field.name)
                    else:
                        formatted_var = '{}.{}'.format(data_type.name, fmt_var(field.name))
                    ivar_doc = ':ivar {} {}: {}'.format(
                        fmt_class(field.data_type.name),
                        formatted_var,
                        self.process_doc(field.doc, self._docf))
                else:
                    ivar_doc = ':ivar {} {}: {}'.format(
                        self._python_type_mapping(ns, field.data_type),
                        fmt_namespaced_var(ns.name, data_type.name, field.name), field.doc)
                self.emit_wrapped_text(ivar_doc, subsequent_prefix='    ')
            self.emit('"""')
            self.emit()

            self._generate_union_class_vars(data_type)
            self._generate_union_class_variant_creators(ns, data_type)
            self._generate_union_class_is_set(data_type)
            self._generate_union_class_get_helpers(ns, data_type)
            self._generate_union_class_custom_annotations(ns, data_type)
        self.emit('{0}_validator = bv.Union({0})'.format(
            class_name_for_data_type(data_type)
        ))
        self.emit()

    def _generate_union_class_vars(self, data_type):
        """
        Adds a _catch_all_ attribute to each class. Also, adds a placeholder
        attribute for the construction of union members of void type.
        """
        lineno = self.lineno
        if data_type.catch_all_field:
            self.emit("_catch_all = '%s'" % data_type.catch_all_field.name)
        elif not data_type.parent_type:
            self.emit('_catch_all = None')

        # Generate stubs for class variables so that IDEs like PyCharms have an
        # easier time detecting their existence.
        for field in data_type.fields:
            if is_void_type(field.data_type):
                field_name = fmt_var(field.name)
                self.emit('# Attribute is overwritten below the class definition')
                self.emit('{} = None'.format(field_name))

        if lineno != self.lineno:
            self.emit()

    def _generate_union_class_reflection_attributes(self, ns, data_type):
        """
        Adds a class attribute for each union member assigned to a validator.
        Also adds an attribute that is a map from tag names to validators.
        """
        class_name = fmt_class(data_type.name)

        for field in data_type.fields:
            field_name = fmt_var(field.name)
            validator_name = generate_validator_constructor(
                ns, field.data_type)
            full_validator_name = '{}._{}_validator'.format(class_name, field_name)
            self.emit('{} = {}'.format(full_validator_name, validator_name))

            if field.redactor:
                self._generate_redactor(full_validator_name, field.redactor)

        # generate _all_fields_ for each omitted caller (and public)
        child_omitted_callers = data_type.get_all_omitted_callers()
        parent_omitted_callers = data_type.parent_type.get_all_omitted_callers() if \
            data_type.parent_type else set()

        all_omitted_callers = child_omitted_callers | parent_omitted_callers
        if len(all_omitted_callers) != 0:
            self.emit('{}._permissioned_tagmaps = {}'.format(class_name, all_omitted_callers))
        for omitted_caller in sorted(all_omitted_callers | {None}, key=str):
            is_public = omitted_caller is None
            tagmap_name = '_tagmap' if is_public else '_{}_tagmap'.format(omitted_caller)
            caller_in_parent = data_type.parent_type and (is_public or omitted_caller
                                                         in parent_omitted_callers)

            with self.block('{}.{} ='.format(class_name, tagmap_name)):
                for field in data_type.fields:
                    if field.omitted_caller != omitted_caller:
                        continue
                    var_name = fmt_var(field.name)
                    validator_name = '{}._{}_validator'.format(class_name, var_name)
                    self.emit("'{}': {},".format(var_name, validator_name))

            if caller_in_parent:
                self.emit('{0}.{1}.update({2}.{1})'.format(
                    class_name, tagmap_name,
                    class_name_for_data_type(data_type.parent_type, ns))
                )

        self.emit()

    def _generate_union_class_variant_creators(self, ns, data_type):
        """
        Each non-symbol, non-any variant has a corresponding class method that
        can be used to construct a union with that variant selected.
        """
        for field in data_type.fields:
            if not is_void_type(field.data_type):
                field_name = fmt_func(field.name)
                field_name_reserved_check = fmt_func(field.name, check_reserved=True)
                if is_nullable_type(field.data_type):
                    field_dt = field.data_type.data_type
                else:
                    field_dt = field.data_type
                self.emit('@classmethod')
                self.emit('def {}(cls, val):'.format(field_name_reserved_check))
                with self.indent():
                    self.emit('"""')
                    self.emit_wrapped_text(
                        'Create an instance of this class set to the ``%s`` '
                        'tag with value ``val``.' % field_name)
                    self.emit()
                    self.emit(':param {} val:'.format(
                        self._python_type_mapping(ns, field_dt)))
                    self.emit(':rtype: {}'.format(
                        self._python_type_mapping(ns, data_type)))
                    self.emit('"""')
                    self.emit("return cls('{}', val)".format(field_name))
                self.emit()

    def _generate_union_class_is_set(self, data_type):
        for field in data_type.fields:
            field_name = fmt_func(field.name)
            self.emit('def is_{}(self):'.format(field_name))
            with self.indent():
                self.emit('"""')
                self.emit('Check if the union tag is ``%s``.' % field_name)
                self.emit()
                self.emit(':rtype: bool')
                self.emit('"""')
                self.emit("return self._tag == '{}'".format(field_name))
            self.emit()

    def _generate_union_class_get_helpers(self, ns, data_type):
        """
        These are the getters used to access the value of a variant, once
        the tag has been switched on.
        """
        for field in data_type.fields:
            field_name = fmt_func(field.name)

            if not is_void_type(field.data_type):
                # generate getter for field
                self.emit('def get_{}(self):'.format(field_name))
                with self.indent():
                    if is_nullable_type(field.data_type):
                        field_dt = field.data_type.data_type
                    else:
                        field_dt = field.data_type
                    self.emit('"""')
                    if field.doc:
                        self.emit_wrapped_text(
                            self.process_doc(field.doc, self._docf))
                        self.emit()
                    self.emit("Only call this if :meth:`is_%s` is true." %
                              field_name)
                    # Sphinx wants an extra line between the text and the
                    # rtype declaration.
                    self.emit()
                    self.emit(':rtype: {}'.format(
                        self._python_type_mapping(ns, field_dt)))
                    self.emit('"""')

                    self.emit('if not self.is_{}():'.format(field_name))
                    with self.indent():
                        self.emit(
                            'raise AttributeError("tag \'{}\' not set")'.format(
                                field_name))
                    self.emit('return self._value')
                self.emit()

    def _generate_union_class_custom_annotations(self, ns, data_type):
        """
        The _process_custom_annotations function allows client code to access
        custom annotations defined in the spec.
        """
        self.emit('def _process_custom_annotations(self, annotation_type, field_path, processor):')
        with self.indent(), emit_pass_if_nothing_emitted(self):
            self.emit(
                (
                    'super({}, self)._process_custom_annotations(annotation_type, field_path, '
                    'processor)'
                ).format(class_name_for_data_type(data_type))
            )
            self.emit()

            for field in data_type.fields:
                recursive_processors = list(self._generate_custom_annotation_processors(
                    ns, field.data_type, field.custom_annotations))

                # check if we have any annotations that apply to this field at all
                if len(recursive_processors) == 0:
                    continue

                recursive_processors = sorted(recursive_processors, key=lambda x: x[0].name)

                field_name = fmt_func(field.name)
                self.emit('if self.is_{}():'.format(field_name))

                with self.indent():
                    for annotation_type, processor in recursive_processors:
                        annotation_class = class_name_for_annotation_type(annotation_type, ns)
                        self.emit('if annotation_type is {}:'.format(annotation_class))
                        with self.indent():
                            self.emit('self._value = {}'.format(
                                generate_func_call(
                                    processor,
                                    args=[
                                        "'{{}}.{}'.format(field_path)".format(field_name),
                                        'self._value',
                                    ])
                            ))
                        self.emit()

    def _generate_union_class_symbol_creators(self, data_type):
        """
        Class attributes that represent a symbol are set after the union class
        definition.
        """
        class_name = fmt_class(data_type.name)
        lineno = self.lineno
        for field in data_type.fields:
            if is_void_type(field.data_type):
                field_name = fmt_func(field.name)
                self.emit("{0}.{1} = {0}('{1}')".format(class_name, field_name))
        if lineno != self.lineno:
            self.emit()

    def _generate_routes(self, route_schema, namespace):

        check_route_name_conflict(namespace)

        for route in namespace.routes:
            data_types = [route.arg_data_type, route.result_data_type,
                          route.error_data_type]
            with self.block(
                    '{} = bb.Route('.format(fmt_func(route.name, version=route.version)),
                    delim=(None, None),
                    after=')'):
                self.emit("'{}',".format(route.name))
                self.emit('{},'.format(route.version))
                self.emit('{!r},'.format(route.deprecated is not None))
                for data_type in data_types:
                    self.emit(
                        generate_validator_constructor(namespace, data_type) + ',')
                attrs = []
                for field in route_schema.fields:
                    attr_key = field.name
                    attrs.append("'{}': {!r}".format(attr_key, route.attrs.get(attr_key)))
                self.generate_multiline_list(
                    attrs, delim=('{', '}'), after=',', compact=True)

        if namespace.routes:
            self.emit()

        with self.block('ROUTES =', delim=('{', '}')):
            for route in namespace.routes:
                self.emit("'{}': {},".format(
                    route.name_with_version(), fmt_func(route.name, version=route.version)))
        self.emit()

    def _generate_redactor(self, validator_name, redactor):
        regex = "'{}'".format(redactor.regex) if redactor.regex else 'None'
        if isinstance(redactor, RedactedHash):
            self.emit("{}._redact = bv.HashRedactor({})".format(validator_name, regex))
        elif isinstance(redactor, RedactedBlot):
            self.emit("{}._redact = bv.BlotRedactor({})".format(validator_name, regex))

def generate_validator_constructor(ns, data_type):
    """
    Given a Stone data type, returns a string that can be used to construct
    the appropriate validation object in Python.
    """
    dt, nullable_dt = unwrap_nullable(data_type)
    if is_list_type(dt):
        v = generate_func_call(
            'bv.List',
            args=[
                generate_validator_constructor(ns, dt.data_type)],
            kwargs=[
                ('min_items', dt.min_items),
                ('max_items', dt.max_items)],
        )
    elif is_map_type(dt):
        v = generate_func_call(
            'bv.Map',
            args=[
                generate_validator_constructor(ns, dt.key_data_type),
                generate_validator_constructor(ns, dt.value_data_type),
            ]
        )
    elif is_numeric_type(dt):
        v = generate_func_call(
            'bv.{}'.format(dt.name),
            kwargs=[
                ('min_value', dt.min_value),
                ('max_value', dt.max_value)],
        )
    elif is_string_type(dt):
        pattern = None
        if dt.pattern is not None:
            pattern = repr(dt.pattern)
        v = generate_func_call(
            'bv.String',
            kwargs=[
                ('min_length', dt.min_length),
                ('max_length', dt.max_length),
                ('pattern', pattern)],
        )
    elif is_timestamp_type(dt):
        v = generate_func_call(
            'bv.Timestamp',
            args=[repr(dt.format)],
        )
    elif is_user_defined_type(dt):
        v = fmt_class(dt.name) + '_validator'
        if ns.name != dt.namespace.name:
            v = '{}.{}'.format(fmt_namespace(dt.namespace.name), v)
    elif is_alias(dt):
        # Assume that the alias has already been declared elsewhere.
        name = fmt_class(dt.name) + '_validator'
        if ns.name != dt.namespace.name:
            name = '{}.{}'.format(fmt_namespace(dt.namespace.name), name)
        v = name
    elif is_boolean_type(dt) or is_bytes_type(dt) or is_void_type(dt):
        v = generate_func_call('bv.{}'.format(dt.name))
    else:
        raise AssertionError('Unsupported data type: %r' % dt)

    if nullable_dt:
        return generate_func_call('bv.Nullable', args=[v])
    else:
        return v


def generate_func_call(name, args=None, kwargs=None):
    """
    Generates code to call a function.

    Args:
        name (str): The function name.
        args (list[str]): Each positional argument.
        kwargs (list[tuple]): Each tuple is (arg: str, value: str). If
            value is None, then the keyword argument is omitted. Otherwise,
            if the value is not a string, then str() is called on it.

    Returns:
        str: Code to call a function.
    """
    all_args = []
    if args:
        all_args.extend(args)
    if kwargs:
        all_args.extend('{}={}'.format(k, v)
                        for k, v in kwargs if v is not None)
    return '{}({})'.format(name, ', '.join(all_args))
