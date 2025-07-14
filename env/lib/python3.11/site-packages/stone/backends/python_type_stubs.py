import argparse
from io import StringIO

from stone.backend import CodeBackend
from stone.backends.python_helpers import (
    check_route_name_conflict,
    class_name_for_annotation_type,
    class_name_for_data_type,
    emit_pass_if_nothing_emitted,
    fmt_func,
    fmt_namespace,
    fmt_var,
    generate_imports_for_referenced_namespaces,
    generate_module_header,
    validators_import_with_type_ignore,
)
from stone.backends.python_type_mapping import (
    map_stone_type_to_python_type,
    OverrideDefaultTypesDict,
)
from stone.ir import (
    Alias,
    AnnotationType,
    Api,
    ApiNamespace,
    DataType,
    is_nullable_type,
    is_struct_type,
    is_union_type,
    is_user_defined_type,
    is_void_type,
    List,
    Map,
    Nullable,
    Struct,
    Timestamp,
    Union,
    unwrap_aliases,
)
from stone.ir.data_types import String
from stone.typing_hacks import cast

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression


class ImportTracker:
    def __init__(self):
        # type: () -> None
        self.cur_namespace_typing_imports = set()  # type: typing.Set[typing.Text]
        self.cur_namespace_adhoc_imports = set()  # type: typing.Set[typing.Text]

    def clear(self):
        # type: () -> None
        self.cur_namespace_typing_imports.clear()
        self.cur_namespace_adhoc_imports.clear()

    def _register_typing_import(self, s):
        # type: (typing.Text) -> None
        """
        Denotes that we need to import something specifically from the `typing` module.

        For example, _register_typing_import("Optional")
        """
        self.cur_namespace_typing_imports.add(s)

    def _register_adhoc_import(self, s):
        # type: (typing.Text) -> None
        """
        Denotes an ad-hoc import.

        For example,
        _register_adhoc_import("import datetime")
        or
        _register_adhoc_import("from xyz import abc")
        """
        self.cur_namespace_adhoc_imports.add(s)


_cmdline_parser = argparse.ArgumentParser(prog='python-types-backend')
_cmdline_parser.add_argument(
    '-p',
    '--package',
    type=str,
    required=True,
    help='Package prefix for absolute imports in generated files.',
)


class PythonTypeStubsBackend(CodeBackend):
    """Generates Python modules to represent the input Stone spec."""

    cmdline_parser = _cmdline_parser
    # Instance var of the current namespace being generated
    cur_namespace = None
    preserve_aliases = True
    import_tracker = ImportTracker()

    def __init__(self, *args, **kwargs):
        # type: (...) -> None
        super().__init__(*args, **kwargs)
        self._pep_484_type_mapping_callbacks = self._get_pep_484_type_mapping_callbacks()

    def generate(self, api):
        # type: (Api) -> None
        """
        Generates a module for each namespace.

        Each namespace will have Python classes to represent data types and
        routes in the Stone spec.
        """
        for namespace in api.namespaces.values():
            with self.output_to_relative_path('{}.pyi'.format(fmt_namespace(namespace.name))):
                self._generate_base_namespace_module(namespace)

    def _generate_base_namespace_module(self, namespace):
        # type: (ApiNamespace) -> None
        """Creates a module for the namespace. All data types and routes are
        represented as Python classes."""

        self.cur_namespace = namespace
        self.import_tracker.clear()
        generate_module_header(self)

        self.emit_placeholder('imports_needed_for_typing')
        self.emit_raw(validators_import_with_type_ignore)

        # Generate import statements for all referenced namespaces.
        self._generate_imports_for_referenced_namespaces(namespace)

        self._generate_typevars()

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

        self._generate_routes(namespace)
        self._generate_imports_needed_for_typing()

    def _generate_imports_for_referenced_namespaces(self, namespace):
        # type: (ApiNamespace) -> None
        assert self.args is not None
        generate_imports_for_referenced_namespaces(
            backend=self,
            namespace=namespace,
            package=self.args.package,
            insert_type_ignore=True,
        )

    def _generate_typevars(self):
        # type: () -> None
        """
        Creates type variables that are used by the type signatures for
        _process_custom_annotations.
        """
        self.emit("T = TypeVar('T', bound=bb.AnnotationType)")
        self.emit("U = TypeVar('U')")
        self.import_tracker._register_typing_import('TypeVar')
        self.emit()

    def _generate_annotation_type_class(self, ns, annotation_type):
        # type: (ApiNamespace, AnnotationType) -> None
        """Defines a Python class that represents an annotation type in Stone."""
        self.emit('class {}(object):'.format(class_name_for_annotation_type(annotation_type, ns)))
        with self.indent():
            self._generate_annotation_type_class_init(ns, annotation_type)
            self._generate_annotation_type_class_properties(ns, annotation_type)
        self.emit()

    def _generate_annotation_type_class_init(self, ns, annotation_type):
        # type: (ApiNamespace, AnnotationType) -> None
        args = ['self']
        for param in annotation_type.params:
            param_name = fmt_var(param.name, True)
            param_type = self.map_stone_type_to_pep484_type(ns, param.data_type)

            if not is_nullable_type(param.data_type):
                self.import_tracker._register_typing_import('Optional')
                param_type = 'Optional[{}]'.format(param_type)

            args.append(
                "{param_name}: {param_type} = ...".format(
                    param_name=param_name,
                    param_type=param_type))

        self.generate_multiline_list(args, before='def __init__', after=' -> None: ...')
        self.emit()

    def _generate_annotation_type_class_properties(self, ns, annotation_type):
        # type: (ApiNamespace, AnnotationType) -> None
        for param in annotation_type.params:
            prop_name = fmt_var(param.name, True)
            param_type = self.map_stone_type_to_pep484_type(ns, param.data_type)

            self.emit('@property')
            self.emit('def {prop_name}(self) -> {param_type}: ...'.format(
                prop_name=prop_name,
                param_type=param_type,
            ))
            self.emit()

    def _generate_struct_class(self, ns, data_type):
        # type: (ApiNamespace, Struct) -> None
        """Defines a Python class that represents a struct in Stone."""
        self.emit(self._class_declaration_for_type(ns, data_type))
        with self.indent():
            self._generate_struct_class_init(ns, data_type)
            self._generate_struct_class_properties(ns, data_type)
            self._generate_struct_or_union_class_custom_annotations()

        self._generate_validator_for(data_type)
        self.emit()

    def _generate_validator_for(self, data_type):
        # type: (DataType) -> None
        cls_name = class_name_for_data_type(data_type)
        self.emit("{}_validator: bv.Validator = ...".format(
            cls_name
        ))

    def _generate_union_class(self, ns, data_type):
        # type: (ApiNamespace, Union) -> None
        self.emit(self._class_declaration_for_type(ns, data_type))
        with self.indent(), emit_pass_if_nothing_emitted(self):
            self._generate_union_class_vars(ns, data_type)
            self._generate_union_class_is_set(data_type)
            self._generate_union_class_variant_creators(ns, data_type)
            self._generate_union_class_get_helpers(ns, data_type)
            self._generate_struct_or_union_class_custom_annotations()

        self._generate_validator_for(data_type)
        self.emit()

    def _generate_union_class_vars(self, ns, data_type):
        # type: (ApiNamespace, Union) -> None
        lineno = self.lineno

        # Generate stubs for class variables so that IDEs like PyCharms have an
        # easier time detecting their existence.
        for field in data_type.fields:
            if is_void_type(field.data_type):
                field_name = fmt_var(field.name)
                field_type = class_name_for_data_type(data_type, ns)
                self.emit('{field_name}: {field_type} = ...'.format(
                    field_name=field_name,
                    field_type=field_type,
                ))

        if lineno != self.lineno:
            self.emit()

    def _generate_union_class_is_set(self, union):
        # type: (Union) -> None
        for field in union.fields:
            field_name = fmt_func(field.name)
            self.emit('def is_{}(self) -> bool: ...'.format(field_name))
            self.emit()

    def _generate_union_class_variant_creators(self, ns, data_type):
        # type: (ApiNamespace, Union) -> None
        """
        Generate the following section in the 'union Shape' example:
        @classmethod
        def circle(cls, val: float) -> Shape: ...
        """
        union_type = class_name_for_data_type(data_type)

        for field in data_type.fields:
            if not is_void_type(field.data_type):
                field_name_reserved_check = fmt_func(field.name, check_reserved=True)
                val_type = self.map_stone_type_to_pep484_type(ns, field.data_type)

                self.emit('@classmethod')
                self.emit('def {field_name}(cls, val: {val_type}) -> {union_type}: ...'.format(
                    field_name=field_name_reserved_check,
                    val_type=val_type,
                    union_type=union_type,
                ))
                self.emit()

    def _generate_union_class_get_helpers(self, ns, data_type):
        # type: (ApiNamespace, Union) -> None
        """
        Generates the following section in the 'union Shape' example:
        def get_circle(self) -> float: ...
        """
        for field in data_type.fields:
            field_name = fmt_func(field.name)

            if not is_void_type(field.data_type):
                # generate getter for field
                val_type = self.map_stone_type_to_pep484_type(ns, field.data_type)

                self.emit('def get_{field_name}(self) -> {val_type}: ...'.format(
                    field_name=field_name,
                    val_type=val_type,
                ))
                self.emit()

    def _generate_alias_definition(self, namespace, alias):
        # type: (ApiNamespace, Alias) -> None
        self._generate_validator_for(alias)

        unwrapped_dt, _ = unwrap_aliases(alias)
        if is_user_defined_type(unwrapped_dt):
            # If the alias is to a composite type, we want to alias the
            # generated class as well.
            self.emit('{} = {}'.format(
                alias.name,
                class_name_for_data_type(alias.data_type, namespace)))

    def _class_declaration_for_type(self, ns, data_type):
        # type: (ApiNamespace, typing.Union[Struct, Union]) -> typing.Text
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

    def _generate_struct_class_init(self, ns, struct):
        # type: (ApiNamespace, Struct) -> None
        args = ["self"]
        for field in struct.all_fields:
            field_name_reserved_check = fmt_var(field.name, True)
            field_type = self.map_stone_type_to_pep484_type(ns, field.data_type)

            if field.has_default:
                self.import_tracker._register_typing_import('Optional')
                field_type = 'Optional[{}]'.format(field_type)

            args.append("{field_name}: {field_type} = ...".format(
                field_name=field_name_reserved_check,
                field_type=field_type))

        self.generate_multiline_list(args, before='def __init__', after=' -> None: ...')

    def _generate_struct_class_properties(self, ns, struct):
        # type: (ApiNamespace, Struct) -> None
        to_emit = []  # type: typing.List[typing.Text]
        for field in struct.all_fields:
            field_name_reserved_check = fmt_func(field.name, check_reserved=True)
            field_type = self.map_stone_type_to_pep484_type(ns, field.data_type)

            to_emit.append(
                "{}: bb.Attribute[{}] = ...".format(field_name_reserved_check, field_type)
            )

        for s in to_emit:
            self.emit(s)

    def _generate_struct_or_union_class_custom_annotations(self):
        """
        The _process_custom_annotations function allows client code to access
        custom annotations defined in the spec.
        """
        self.emit('def _process_custom_annotations(')
        with self.indent():
            self.emit('self,')
            self.emit('annotation_type: Type[T],')
            self.emit('field_path: Text,')
            self.emit('processor: Callable[[T, U], U],')
            self.import_tracker._register_typing_import('Type')
            self.import_tracker._register_typing_import('Text')
            self.import_tracker._register_typing_import('Callable')
        self.emit(') -> None: ...')
        self.emit()

    def _get_pep_484_type_mapping_callbacks(self):
        # type: () -> OverrideDefaultTypesDict
        """
        Once-per-instance, generate a mapping from
        "List" -> return pep4848-compatible List[SomeType]
        "Nullable" -> return pep484-compatible Optional[SomeType]

        This is per-instance because we have to also call `self._register_typing_import`, because
        we need to potentially import some things.
        """
        def upon_encountering_list(ns, data_type, override_dict):
            # type: (ApiNamespace, DataType, OverrideDefaultTypesDict) -> typing.Text
            self.import_tracker._register_typing_import("List")
            return "List[{}]".format(
                map_stone_type_to_python_type(ns, data_type, override_dict)
            )

        def upon_encountering_map(ns, map_data_type, override_dict):
            # type: (ApiNamespace, DataType, OverrideDefaultTypesDict) -> typing.Text
            map_type = cast(Map, map_data_type)
            self.import_tracker._register_typing_import("Dict")
            return "Dict[{}, {}]".format(
                map_stone_type_to_python_type(ns, map_type.key_data_type, override_dict),
                map_stone_type_to_python_type(ns, map_type.value_data_type, override_dict)
            )

        def upon_encountering_nullable(ns, data_type, override_dict):
            # type: (ApiNamespace, DataType, OverrideDefaultTypesDict) -> typing.Text
            self.import_tracker._register_typing_import("Optional")
            return "Optional[{}]".format(
                map_stone_type_to_python_type(ns, data_type, override_dict)
            )

        def upon_encountering_timestamp(
                ns, data_type, override_dict
        ):  # pylint: disable=unused-argument
            # type: (ApiNamespace, DataType, OverrideDefaultTypesDict) -> typing.Text
            self.import_tracker._register_adhoc_import("import datetime")
            return map_stone_type_to_python_type(ns, data_type)

        def upon_encountering_string(
            ns, data_type, override_dict
        ):  # pylint: disable=unused-argument
            # type: (...) -> typing.Text
            self.import_tracker._register_typing_import("Text")
            return "Text"

        callback_dict = {
            List: upon_encountering_list,
            Map: upon_encountering_map,
            Nullable: upon_encountering_nullable,
            Timestamp: upon_encountering_timestamp,
            String: upon_encountering_string,
        }  # type: OverrideDefaultTypesDict
        return callback_dict

    def map_stone_type_to_pep484_type(self, ns, data_type):
        # type: (ApiNamespace, DataType) -> typing.Text
        assert self._pep_484_type_mapping_callbacks
        return map_stone_type_to_python_type(ns, data_type,
                                             override_dict=self._pep_484_type_mapping_callbacks)

    def _generate_routes(
            self,
            namespace,  # type: ApiNamespace
    ):
        # type: (...) -> None

        check_route_name_conflict(namespace)

        for route in namespace.routes:
            self.emit(
                "{method_name}: bb.Route = ...".format(
                    method_name=fmt_func(route.name, version=route.version)))

        if namespace.routes:
            self.emit()

    def _generate_imports_needed_for_typing(self):
        # type: () -> None
        output_buffer = StringIO()
        with self.capture_emitted_output(output_buffer):
            if self.import_tracker.cur_namespace_typing_imports:
                self.emit("")
                self.emit('from typing import (')
                with self.indent():
                    for to_import in sorted(self.import_tracker.cur_namespace_typing_imports):
                        self.emit("{},".format(to_import))
                self.emit(')')

            if self.import_tracker.cur_namespace_adhoc_imports:
                self.emit("")
                for to_import in self.import_tracker.cur_namespace_adhoc_imports:
                    self.emit(to_import)

        self.add_named_placeholder('imports_needed_for_typing', output_buffer.getvalue())
