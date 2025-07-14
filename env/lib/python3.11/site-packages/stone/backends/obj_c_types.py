import json
import os
import shutil

import six

from stone.backends.obj_c import (
    base_file_comment,
    comment_prefix,
    ObjCBaseBackend,
    undocumented, )
from stone.backends.obj_c_helpers import (
    append_to_jazzy_category_dict,
    fmt_alloc_call,
    fmt_camel,
    fmt_camel_upper,
    fmt_class,
    fmt_class_prefix,
    fmt_class_type,
    fmt_default_value,
    fmt_enum_name,
    fmt_func,
    fmt_func_args,
    fmt_func_args_declaration,
    fmt_func_args_from_fields,
    fmt_func_call,
    fmt_import,
    fmt_property,
    fmt_property_str,
    fmt_public_name,
    fmt_routes_class,
    fmt_route_func,
    fmt_route_obj_class,
    fmt_route_var,
    fmt_serial_class,
    fmt_serial_obj,
    fmt_signature,
    fmt_type,
    fmt_validator,
    fmt_var,
    is_primitive_type, )
from stone.ir import (
    is_list_type,
    is_map_type,
    is_nullable_type,
    is_numeric_type,
    is_string_type,
    is_struct_type,
    is_timestamp_type,
    is_union_type,
    is_user_defined_type,
    is_void_type,
    unwrap_nullable, )

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

import argparse

_cmdline_parser = argparse.ArgumentParser(prog='obj-c-types-backend')
_cmdline_parser.add_argument(
    '-r',
    '--route-method',
    help=('A string used to construct the location of an Objective-C method for a '
        'given route; use {ns} as a placeholder for namespace name and '
        '{route} for the route name.'), )
_cmdline_parser.add_argument(
    '-d',
    '--documentation',
    action='store_true',
    help=('Sets whether documentation is generated.'), )
_cmdline_parser.add_argument(
    '-e',
    '--exclude-from-analysis',
    action='store_true',
    help=('Sets whether generated code should marked for exclusion ' +
        'from analysis.'), )


class ObjCTypesBackend(ObjCBaseBackend):
    """Generates Obj C modules to represent the input Stone spec."""

    cmdline_parser = _cmdline_parser
    obj_name_to_namespace = {}  # type: typing.Dict[str, str]
    namespace_to_has_route_auth_list = {}  # type: typing.Dict[typing.Any, typing.Set]

    def generate(self, api):
        """
        Generates a module for each namespace.

        Each namespace will have Obj C classes to represent data types and
        routes in the Stone spec.
        """
        rsrc_folder = os.path.join(os.path.dirname(__file__), 'obj_c_rsrc')
        rsrc_output_folder = os.path.join(self.target_folder_path, 'Resources')

        if not os.path.exists(rsrc_output_folder):
            os.makedirs(rsrc_output_folder)

        self.logger.info('Copying DBStoneValidators.{h,m} to output folder')
        shutil.copy(
            os.path.join(rsrc_folder, 'DBStoneValidators.h'),
            rsrc_output_folder)
        shutil.copy(
            os.path.join(rsrc_folder, 'DBStoneValidators.m'),
            rsrc_output_folder)
        self.logger.info('Copying DBStoneSerializers.{h,m} to output folder')
        shutil.copy(
            os.path.join(rsrc_folder, 'DBStoneSerializers.h'),
            rsrc_output_folder)
        shutil.copy(
            os.path.join(rsrc_folder, 'DBStoneSerializers.m'),
            rsrc_output_folder)
        self.logger.info('Copying DBStoneBase.{h,m} to output folder')
        shutil.copy(
            os.path.join(rsrc_folder, 'DBStoneBase.h'), rsrc_output_folder)
        shutil.copy(
            os.path.join(rsrc_folder, 'DBStoneBase.m'), rsrc_output_folder)
        self.logger.info('Copying DBSerializableProtocol.h to output folder')
        shutil.copy(
            os.path.join(rsrc_folder, 'DBSerializableProtocol.h'),
            rsrc_output_folder)

        jazzy_cfg = None

        if self.args.documentation:
            jazzy_cfg_path = os.path.join('../Format', 'jazzy.json')
            with open(jazzy_cfg_path, encoding='utf-8') as jazzy_file:
                jazzy_cfg = json.load(jazzy_file)

            for idx, namespace in enumerate(api.namespaces.values()):
                ns_name = fmt_public_name(namespace.name)
                ns_dict = {"name": ns_name, "children": [], }
                jazzy_cfg['custom_categories'].insert(idx, ns_dict)

        for namespace in api.namespaces.values():
            self.namespace_to_has_route_auth_list[namespace] = set()
            if namespace.routes:
                for route in namespace.routes:
                    auth_types = set(map(lambda x: x.strip(), route.attrs.get('auth').split(',')))
                    if 'noauth' not in auth_types:
                        self.namespace_to_has_route_auth_list[namespace].add(
                            route.attrs.get('auth'))
                    else:
                        self.namespace_to_has_route_auth_list[namespace].add(
                            'user')

        with self.output_to_relative_path('DBSDKImportsGenerated.h'):
            self._generate_all_imports(api)

        for namespace in api.namespaces.values():
            for data_type in namespace.linearize_data_types():
                self.obj_name_to_namespace[data_type.name] = fmt_class_prefix(
                    data_type)

        for namespace in api.namespaces.values():
            ns_name = fmt_public_name(namespace.name)
            self._generate_namespace_types(namespace, jazzy_cfg)

            if namespace.routes:
                if self.args.documentation:
                    for auth_type in self.namespace_to_has_route_auth_list[
                            namespace]:
                        append_to_jazzy_category_dict(
                            jazzy_cfg, 'Routes', fmt_routes_class(ns_name, auth_type))
                    append_to_jazzy_category_dict(
                        jazzy_cfg, 'RouteObjects', fmt_route_obj_class(ns_name))
                self._generate_route_objects_m(api.route_schema, namespace)
                self._generate_route_objects_h(api.route_schema, namespace)

        if self.args.documentation:
            with self.output_to_relative_path('../../../../.jazzy.json'):
                self.emit_raw(json.dumps(jazzy_cfg, indent=2) + '\n')

    def _generate_all_imports(self, api):
        self.emit_raw(base_file_comment)

        self.emit('/// Import autogenerated files')
        self.emit()

        self.emit('// Routes')
        for namespace in api.namespaces.values():
            if namespace.routes:
                for auth_type in self.namespace_to_has_route_auth_list[
                        namespace]:
                    self.emit(
                        fmt_import(
                            fmt_routes_class(namespace.name, auth_type)))
                self.emit(fmt_import(fmt_route_obj_class(namespace.name)))
        self.emit()

        for namespace in api.namespaces.values():
            namespace_imports = []
            self.emit()
            self.emit(
                '// `{}` namespace types'.format(fmt_class(namespace.name)))
            self.emit()
            for data_type in namespace.linearize_data_types():
                namespace_imports.append(fmt_class_prefix(data_type))

            self._generate_imports_m(namespace_imports)

    def _generate_namespace_types(self, namespace, jazzy_cfg):
        """Creates Obj C argument, error, serializer and deserializer types
        for the given namespace."""
        ns_name = fmt_public_name(namespace.name)
        output_path = os.path.join('ApiObjects', ns_name)
        output_path_headers = os.path.join(output_path, 'Headers')

        for data_type in namespace.linearize_data_types():
            class_name = fmt_class_prefix(data_type)

            if self.args.documentation:
                append_to_jazzy_category_dict(jazzy_cfg, ns_name, class_name)
                append_to_jazzy_category_dict(
                    jazzy_cfg, 'Serializers', '{}Serializer'.format(class_name))

            if is_struct_type(data_type):
                # struct header
                file_path = os.path.join(output_path_headers,
                                         class_name + '.h')
                with self.output_to_relative_path(file_path):
                    self.emit_raw(base_file_comment)
                    self._generate_struct_class_h(data_type)
            elif is_union_type(data_type):

                if self.args.documentation:
                    append_to_jazzy_category_dict(
                        jazzy_cfg, 'Tags', '{}Tag'.format(fmt_class_prefix(data_type)))
                # union header
                file_path = os.path.join(output_path_headers,
                                         class_name + '.h')
                with self.output_to_relative_path(file_path):
                    self.emit_raw(base_file_comment)
                    self._generate_union_class_h(data_type)
            else:
                raise TypeError('Can\'t handle type %r' % type(data_type))

        file_path = os.path.join(
            output_path,
            'DB{}Objects.m'.format(fmt_camel_upper(namespace.name)))
        with self.output_to_relative_path(file_path):
            self.emit_raw(base_file_comment)

            description = '/// Arguments, results, and errors for the `{}` namespace.'.format(
                fmt_camel_upper(namespace.name))
            self.emit(description)

            if self.args.exclude_from_analysis:
                self.emit()
                self.emit('#ifndef __clang_analyzer__')

            for data_type in namespace.linearize_data_types():
                if is_struct_type(data_type):
                    # struct implementation
                    self._generate_struct_class_m(data_type)
                elif is_union_type(data_type):
                    # union implementation
                    self._generate_union_class_m(data_type)

            if self.args.exclude_from_analysis:
                self.emit('#endif')

    def _generate_struct_class_m(self, struct):
        """Defines an Obj C implementation file that represents a struct in Stone."""
        self.emit()
        self._generate_imports_m(
            self._get_imports_m(
                struct,
                default_imports=['DBStoneSerializers', 'DBStoneValidators']))

        struct_name = fmt_class_prefix(struct)

        self.emit('#pragma mark - API Object')
        self.emit()
        with self.block_m(struct_name):
            self.emit('#pragma mark - Constructors')
            self.emit()
            self._generate_struct_cstor(struct)
            self._generate_struct_cstor_default(struct)
            self.emit('#pragma mark - Serialization methods')
            self.emit()
            self._generate_serializable_funcs(struct_name)
            self.emit('#pragma mark - Debug Description method')
            self.emit()
            self._generate_debug_description_func(struct_name)
            self.emit('#pragma mark - Copyable method')
            self.emit()
            self._generate_copyable_func()
            self.emit('#pragma mark - Hash method')
            self.emit()
            self._generate_hash_func(struct)
            self.emit('#pragma mark - Equality method')
            self.emit()
            self._generate_equality_func(struct)

        self.emit()
        self.emit()

        self.emit('#pragma mark - Serializer Object')
        self.emit()
        with self.block_m(fmt_serial_class(struct_name)):
            self._generate_struct_serializer(struct)
            self._generate_struct_deserializer(struct)

    def _generate_struct_class_h(self, struct):
        """Defines an Obj C header file that represents a struct in Stone."""
        self._generate_init_imports_h(struct)
        self._generate_imports_h(self._get_imports_h(struct))

        self.emit()
        self.emit('NS_ASSUME_NONNULL_BEGIN')
        self.emit()

        self.emit('#pragma mark - API Object')
        self.emit()

        self._generate_class_comment(struct)

        struct_name = fmt_class_prefix(struct)

        with self.block_h_from_data_type(struct, protocol=['DBSerializable', 'NSCopying']):
            self.emit('#pragma mark - Instance fields')
            self.emit()
            self._generate_struct_properties(struct.fields)
            self.emit('#pragma mark - Constructors')
            self.emit()
            self._generate_struct_cstor_signature(struct)
            self._generate_struct_cstor_signature_default(struct)
            self._generate_init_unavailable_signature(struct)

        self.emit()
        self.emit()

        self.emit('#pragma mark - Serializer Object')
        self.emit()
        self.emit(comment_prefix)
        self.emit_wrapped_text(
            'The serialization class for the `{}` struct.'.format(
                fmt_class(struct.name)),
            prefix=comment_prefix)
        self.emit(comment_prefix)
        with self.block_h(fmt_serial_class(struct_name)):
            self._generate_serializer_signatures(struct_name)

        self.emit()
        self.emit('NS_ASSUME_NONNULL_END')
        self.emit()

    def _generate_union_class_m(self, union):
        """Defines an Obj C implementation file that represents a union in Stone."""
        self.emit()
        self._generate_imports_m(
            self._get_imports_m(
                union,
                default_imports=['DBStoneSerializers', 'DBStoneValidators']))

        union_name = fmt_class_prefix(union)

        self.emit('#pragma mark - API Object')
        self.emit()
        with self.block_m(fmt_class_prefix(union)):
            self._generate_synthesize_ivars(union)
            self.emit('#pragma mark - Constructors')
            self.emit()
            self._generate_union_cstor_funcs(union)
            self.emit('#pragma mark - Instance field accessors')
            self.emit()
            self._generate_union_tag_vars_funcs(union)
            self.emit('#pragma mark - Tag state methods')
            self.emit()
            self._generate_union_tag_state_funcs(union)
            self.emit('#pragma mark - Serialization methods')
            self.emit()
            self._generate_serializable_funcs(union_name)
            self.emit('#pragma mark - Debug Description method')
            self.emit()
            self._generate_debug_description_func(union_name)
            self.emit('#pragma mark - Copyable method')
            self.emit()
            self._generate_copyable_func()
            self.emit('#pragma mark - Hash method')
            self.emit()
            self._generate_hash_func(union)
            self.emit('#pragma mark - Equality method')
            self.emit()
            self._generate_equality_func(union)

        self.emit()
        self.emit()

        self.emit('#pragma mark - Serializer Object')
        self.emit()
        with self.block_m(fmt_serial_class(union_name)):
            self._generate_union_serializer(union)
            self._generate_union_deserializer(union)

    def _generate_union_class_h(self, union):
        """Defines an Obj C header file that represents a union in Stone."""
        self._generate_init_imports_h(union)
        self._generate_imports_h(self._get_imports_h(union))

        self.emit()
        self.emit('NS_ASSUME_NONNULL_BEGIN')
        self.emit()

        self.emit('#pragma mark - API Object')
        self.emit()
        self._generate_class_comment(union)

        union_name = fmt_class_prefix(union)

        with self.block_h_from_data_type(union, protocol=['DBSerializable', 'NSCopying']):
            self.emit('#pragma mark - Instance fields')
            self.emit()
            self._generate_union_tag_state(union)
            self._generate_union_tag_property(union)
            self._generate_union_properties(union.all_fields)
            self.emit('#pragma mark - Constructors')
            self.emit()
            self._generate_union_cstor_signatures(union, union.all_fields)
            self._generate_init_unavailable_signature(union)
            self.emit('#pragma mark - Tag state methods')
            self.emit()
            self._generate_union_tag_access_signatures(union)

        self.emit()
        self.emit()

        self.emit('#pragma mark - Serializer Object')
        self.emit()
        self.emit(comment_prefix)
        self.emit_wrapped_text(
            'The serialization class for the `{}` union.'.format(union_name),
            prefix=comment_prefix)
        self.emit(comment_prefix)
        with self.block_h(fmt_serial_class(union_name)):
            self._generate_serializer_signatures(union_name)

        self.emit()
        self.emit('NS_ASSUME_NONNULL_END')
        self.emit()

    def _generate_synthesize_ivars(self, union):
        non_void_exists = False
        for field in union.all_fields:
            if not is_void_type(field.data_type):
                non_void_exists = True
                self.emit('@synthesize {} = _{};'.format(
                    fmt_var(field.name), fmt_var(field.name)))

        if non_void_exists:
            self.emit()

    def _generate_struct_cstor(self, struct):
        """Emits struct standard constructor."""
        with self.block_func(
                func=self._cstor_name_from_fields(struct.all_fields),
                args=fmt_func_args_from_fields(struct.all_fields),
                return_type='instancetype'):
            for field in struct.all_fields:
                self._generate_validator(field)

            self.emit()

            super_fields = [
                f for f in struct.all_fields if f not in struct.fields
            ]

            if super_fields:
                super_args = fmt_func_args([(fmt_var(f.name), fmt_var(f.name))
                                            for f in super_fields])
                self.emit('self = [super {}:{}];'.format(
                    self._cstor_name_from_fields(super_fields), super_args))
            else:
                if struct.parent_type:
                    self.emit('self = [super initDefault];')
                else:
                    self.emit('self = [super init];')
            with self.block_init():
                for field in struct.fields:
                    field_name = fmt_var(field.name)

                    if field.has_default:
                        self.emit('_{0} = {0} ?: {1};'.format(
                            field_name, fmt_default_value(field)))
                    else:
                        self.emit('_{0} = {0};'.format(field_name))
        self.emit()

    def _generate_struct_cstor_default(self, struct):
        """Emits struct convenience constructor. Default arguments are omitted."""
        if not self._struct_has_defaults(struct):
            return

        fields_no_default = [
            f for f in struct.all_fields
            if not f.has_default and not is_nullable_type(f.data_type)
        ]

        with self.block_func(
                func=self._cstor_name_from_fields(fields_no_default),
                args=fmt_func_args_from_fields(fields_no_default),
                return_type='instancetype'):
            args = ([(fmt_var(f.name), fmt_var(f.name) if not f.has_default and
                      not is_nullable_type(f.data_type) else 'nil')
                     for f in struct.all_fields])
            cstor_args = fmt_func_args(args)
            self.emit('return [self {}:{}];'.format(
                self._cstor_name_from_fields(struct.all_fields), cstor_args))
        self.emit()

    def _generate_struct_cstor_signature(self, struct):
        """Emits struct standard constructor signature to be used in the struct's header file."""
        fields = struct.all_fields
        self.emit(comment_prefix)
        description_str = 'Full constructor for the struct (exposes all instance variables).'
        self.emit_wrapped_text(description_str, prefix=comment_prefix)
        signature = fmt_signature(
            func=self._cstor_name_from_fields(fields),
            args=self._cstor_args_from_fields(fields, is_struct=True),
            return_type='instancetype')
        self.emit(comment_prefix)
        for field in struct.all_fields:
            doc = self.process_doc(field.doc,
                                   self._docf) if field.doc else undocumented
            self.emit_wrapped_text(
                '@param {} {}'.format(fmt_var(field.name), doc),
                prefix=comment_prefix)
        if struct.all_fields:
            self.emit(comment_prefix)
        self.emit_wrapped_text(
            '@return An initialized instance.', prefix=comment_prefix)
        self.emit(comment_prefix)
        self.emit('{};'.format(signature))

        self.emit()

    def _generate_struct_cstor_signature_default(self, struct):
        """Emits struct convenience constructor with default arguments
        ommitted signature to be used in the struct header file."""
        if not self._struct_has_defaults(struct):
            return

        fields_no_default = [
            f for f in struct.all_fields
            if not f.has_default and not is_nullable_type(f.data_type)
        ]
        signature = fmt_signature(
            func=self._cstor_name_from_fields(fields_no_default),
            args=self._cstor_args_from_fields(
                fields_no_default, is_struct=True),
            return_type='instancetype')

        self.emit(comment_prefix)
        description_str = (
            'Convenience constructor (exposes only non-nullable '
            'instance variables with no default value).')
        self.emit_wrapped_text(description_str, prefix=comment_prefix)
        self.emit(comment_prefix)
        for field in fields_no_default:
            doc = self.process_doc(field.doc,
                                   self._docf) if field.doc else undocumented
            self.emit_wrapped_text(
                '@param {} {}'.format(fmt_var(field.name), doc),
                prefix=comment_prefix)
        if struct.all_fields:
            self.emit(comment_prefix)
        self.emit_wrapped_text(
            '@return An initialized instance.', prefix=comment_prefix)
        self.emit(comment_prefix)

        self.emit('{};'.format(signature))
        self.emit()

    def _generate_union_cstor_funcs(self, union):
        """Emits standard union constructor."""
        for field in union.all_fields:
            enum_field_name = fmt_enum_name(field.name, union)
            func_args = [] if is_void_type(
                field.data_type) else fmt_func_args_from_fields([field])

            with self.block_func(
                    func=self._cstor_name_from_field(field),
                    args=func_args,
                    return_type='instancetype'):
                self.emit('self = [super init];')
                with self.block_init():
                    self.emit('_tag = {};'.format(enum_field_name))
                    if not is_void_type(field.data_type):
                        self.emit('_{} = {};'.format(
                            fmt_var(field.name), fmt_var(field.name)))
            self.emit()

    def _generate_union_cstor_signatures(self, union, fields):  # pylint: disable=unused-argument
        """Emits union constructor signatures to be used in the union's header file."""
        for field in fields:
            args = self._cstor_args_from_fields(
                [field] if not is_void_type(field.data_type) else [])
            signature = fmt_signature(
                func=self._cstor_name_from_field(field),
                args=args,
                return_type='instancetype')
            self.emit(comment_prefix)
            self.emit_wrapped_text(
                'Initializes union class with tag state of "{}".'.format(
                    field.name),
                prefix=comment_prefix)
            self.emit(comment_prefix)
            if field.doc:
                doc = self.process_doc(
                    field.doc, self._docf) if field.doc else undocumented
                self.emit_wrapped_text(
                    'Description of the "{}" tag state: {}'.format(
                        field.name, doc),
                    prefix=comment_prefix)
                self.emit(comment_prefix)
            if not is_void_type(field.data_type):
                doc = self.process_doc(
                    field.doc, self._docf) if field.doc else undocumented
                self.emit_wrapped_text(
                    '@param {} {}'.format(fmt_var(field.name), doc),
                    prefix=comment_prefix)
                self.emit(comment_prefix)
            self.emit_wrapped_text(
                '@return An initialized instance.', prefix=comment_prefix)
            self.emit(comment_prefix)
            self.emit('{};'.format(signature))
            self.emit()

    def _generate_union_tag_state(self, union):
        """Emits union tag enum type, which stores union state."""
        union_name = fmt_class_prefix(union)
        tag_type = fmt_enum_name('tag', union)
        description_str = ('The `{}` enum type represents the possible tag '
                           'states with which the `{}` union can exist.')
        self.emit_wrapped_text(
            description_str.format(tag_type, union_name),
            prefix=comment_prefix)
        with self.block(
                'typedef NS_CLOSED_ENUM(NSInteger, {})'.format(tag_type), after=';'):
            for field in union.all_fields:
                doc = self.process_doc(
                    field.doc, self._docf) if field.doc else undocumented
                self.emit_wrapped_text(doc, prefix=comment_prefix)
                self.emit('{},'.format(fmt_enum_name(field.name, union)))
                self.emit()
        self.emit()

    def _generate_init_unavailable_signature(self, data_type):
        if not data_type.parent_type or is_union_type(data_type):
            self.emit('- (instancetype)init NS_UNAVAILABLE;')
            self.emit()

    def _generate_serializable_funcs(self, data_type_name):
        """Emits the two struct/union functions that implement the Serializable protocol."""
        with self.block_func(
                func='serialize',
                args=fmt_func_args_declaration([('instance', 'id')]),
                return_type='nullable NSDictionary<NSString *, id>  *',
                class_func=True):
            func_call = fmt_func_call(
                caller=fmt_serial_class(data_type_name),
                callee='serialize',
                args=fmt_func_args([('instance', 'instance')]))
            self.emit('return {};'.format(func_call))
        self.emit()

        with self.block_func(
                func='deserialize',
                args=fmt_func_args_declaration([('dict', 'NSDictionary<NSString *, id>  *')]),
                return_type='id',
                class_func=True):
            self.emit('return {};'.format(
                fmt_func_call(
                    caller=fmt_serial_class(data_type_name),
                    callee='deserialize',
                    args=fmt_func_args([('dict', 'dict')]))))
        self.emit()

    def _generate_serializer_signatures(self, obj_name):
        """Emits the signatures of the serializer object's serializing functions."""
        serial_signature = fmt_signature(
            func='serialize',
            args=fmt_func_args_declaration([(
                'instance', '{} *'.format(obj_name))]),
            return_type='nullable NSDictionary<NSString *, id>  *',
            class_func=True)
        deserial_signature = fmt_signature(
            func='deserialize',
            args=fmt_func_args_declaration([('dict',
                                             'NSDictionary<NSString *, id>  *')]),
            return_type='{} *'.format(obj_name),
            class_func=True)
        self.emit(comment_prefix)
        self.emit_wrapped_text(
            'Serializes `{}` instances.'.format(obj_name),
            prefix=comment_prefix)
        self.emit(comment_prefix)
        self.emit_wrapped_text(
            '@param instance An instance of the `{}` API object.'.format(
                obj_name),
            prefix=comment_prefix)
        self.emit(comment_prefix)
        description_str = ('@return A json-compatible dictionary '
                           'representation of the `{}` API object.')
        self.emit_wrapped_text(
            description_str.format(obj_name), prefix=comment_prefix)
        self.emit(comment_prefix)
        self.emit('{};'.format(serial_signature))
        self.emit()
        self.emit(comment_prefix)
        self.emit_wrapped_text(
            'Deserializes `{}` instances.'.format(obj_name),
            prefix=comment_prefix)
        self.emit(comment_prefix)
        description_str = ('@param dict A json-compatible dictionary '
                           'representation of the `{}` API object.')
        self.emit_wrapped_text(
            description_str.format(obj_name), prefix=comment_prefix)
        self.emit(comment_prefix)
        self.emit_wrapped_text(
            '@return An instantiation of the `{}` object.'.format(obj_name),
            prefix=comment_prefix)
        self.emit(comment_prefix)
        self.emit('{};'.format(deserial_signature))
        self.emit()

    def _generate_debug_description_func(self, data_type_name):
        with self.block_func(
                func='debugDescription', args=[], return_type='NSString *'):
            serialize_call = fmt_func_call(
                caller=fmt_serial_class(data_type_name),
                callee='serialize',
                args=fmt_func_args([('valueObj', 'self')]))
            self.emit('return {};'.format(
                fmt_func_call(caller=serialize_call, callee='description')))
        self.emit()

    def _generate_copyable_func(self):
        with self.block_func(
                func='copyWithZone', args=fmt_func_args_declaration(
                    [('zone', 'NSZone *')]), return_type='instancetype'):
            self.emit('#pragma unused(zone)')
            self.emit_wrapped_text('object is immutable', prefix=comment_prefix)
            self.emit('return self;')
        self.emit()

    def _generate_hash_func(self, data_type):
        with self.block_func(
                func='hash', return_type='NSUInteger'):
            self.emit('NSUInteger prime = 31;')
            self.emit('NSUInteger result = 1;')
            self.emit()
            if is_union_type(data_type):
                with self.block('switch (_tag)'):
                    for field in data_type.all_fields:
                        enum_field_name = fmt_enum_name(field.name, data_type)
                        self.emit('case {}:'.format(enum_field_name))
                        self._generate_hash_func_helper(data_type, field)
                        self.emit('break;')
            elif is_struct_type(data_type):
                for field in data_type.all_fields:
                    self._generate_hash_func_helper(data_type, field)
            self.emit()
            self.emit('return prime * result;')
        self.emit()

    def _generate_hash_func_helper(self, data_type, field):
        _, nullable = unwrap_nullable(field.data_type)
        if nullable:
            with self.block('if (self.{} != nil)'.format(fmt_var(field.name))):
                self._generate_hash_check(data_type, field)
        else:
            self._generate_hash_check(data_type, field)

    def _generate_hash_check(self, data_type, field):
        if is_union_type(data_type) and is_void_type(field.data_type):
            self.emit('result = prime * result + [[self tagName] hash];')
        else:
            self.emit('result = prime * result + [self.{} hash];'.format(fmt_var(field.name)))

    def _generate_equality_func(self, data_type):
        is_equal_func_name = 'isEqualTo{}'.format(fmt_camel_upper(data_type.name))
        with self.block_func(func='isEqual',
                args=fmt_func_args_declaration([('other', 'id')]),
                return_type='BOOL'):
            with self.block('if (other == self)'):
                self.emit('return YES;')
            with self.block('if (!other || ![other isKindOfClass:[self class]])'):
                self.emit('return NO;')
            self.emit('return [self {}:other];'.format(is_equal_func_name))
        self.emit()

        if data_type.name[0].lower() in 'aeiou':
            other_obj_name = 'an{}'.format(fmt_class(data_type.name))
        else:
            other_obj_name = 'a{}'.format(fmt_class(data_type.name))

        with self.block_func(
                func=is_equal_func_name,
                args=fmt_func_args_declaration([(other_obj_name, '{} *'.format(
                    fmt_class_type(data_type)))]), return_type='BOOL'):
            with self.block('if (self == {})'.format(other_obj_name)):
                self.emit('return YES;')
            if is_union_type(data_type):
                with self.block('if (self.tag != {}.tag)'.format(other_obj_name)):
                    self.emit('return NO;')
                with self.block('switch (_tag)'):
                    for field in data_type.all_fields:
                        self._generate_equality_func_helper(data_type, field, other_obj_name)
                self.emit('return YES;')
            elif is_struct_type(data_type):
                for field in data_type.all_fields:
                    self._generate_equality_func_helper(data_type, field, other_obj_name)
                self.emit('return YES;')
        self.emit()

    def _generate_equality_func_helper(self, data_type, field, other_obj_name):
        _, nullable = unwrap_nullable(field.data_type)
        if is_union_type(data_type):
            enum_field_name = fmt_enum_name(field.name, data_type)
            self.emit('case {}:'.format(enum_field_name))
        if nullable:
            with self.block('if (self.{})'.format(fmt_var(field.name))):
                self._generate_equality_check(data_type, field, other_obj_name)
        else:
            self._generate_equality_check(data_type, field, other_obj_name)

    def _generate_equality_check(self, data_type, field, other_obj_name):
        field_name = fmt_var(field.name)

        if is_union_type(data_type):
            if is_void_type(field.data_type):
                self.emit('return [[self tagName] isEqual:[{} tagName]];'.format(other_obj_name))
            else:
                self.emit('return [self.{0} isEqual:{1}.{0}];'.format(
                    field_name, other_obj_name))
        elif is_struct_type(data_type):
            with self.block('if (![self.{0} isEqual:{1}.{0}])'.format(
                    field_name, other_obj_name)):
                self.emit('return NO;')

    def _cstor_args_from_fields(self, fields, is_struct=False):
        """Returns a string representing the properly formatted arguments for a constructor."""
        if is_struct:
            args = [(fmt_var(f.name),
                fmt_type(f.data_type, tag=True, has_default=f.has_default)) for f in fields]
        else:
            args = [(fmt_var(f.name), fmt_type(f.data_type, tag=True)) for f in fields]

        return fmt_func_args_declaration(args)

    def _generate_validator(self, field):
        """Emits validator if data type has associated validator."""
        validator = self._determine_validator_type(field.data_type,
                                                   fmt_var(field.name),
                                                   field.has_default)
        value = fmt_var(
            field.name) if not field.has_default else '{} ?: {}'.format(
                fmt_var(field.name), fmt_default_value(field))
        if validator:
            self.emit('{}({});'.format(validator, value))

    def _determine_validator_type(self, data_type, value, has_default):
        """Returns validator string for given data type, else None."""
        data_type, nullable = unwrap_nullable(data_type)

        validator = None

        if is_list_type(data_type):
            item_validator = self._determine_validator_type(
                data_type.data_type, value, False)
            item_validator = item_validator if item_validator else 'nil'

            validator = '{}:{}'.format(
                fmt_validator(data_type),
                fmt_func_args([
                    ('minItems', '@({})'.format(data_type.min_items)
                     if data_type.min_items else 'nil'),
                    ('maxItems', '@({})'.format(data_type.max_items)
                     if data_type.max_items else 'nil'),
                    ('itemValidator', item_validator),
                ]))
        elif is_map_type(data_type):
            item_validator = self._determine_validator_type(
                data_type.value_data_type, value, False)
            item_validator = item_validator if item_validator else 'nil'

            validator = '{}:{}'.format(
                fmt_validator(data_type),
                fmt_func_args([
                    ('itemValidator', item_validator),
                ]))
        elif is_numeric_type(data_type):
            if data_type.min_value or data_type.max_value:
                validator = '{}:{}'.format(
                    fmt_validator(data_type),
                    fmt_func_args([
                        ('minValue', '@({})'.format(data_type.min_value)
                         if data_type.min_value else 'nil'),
                        ('maxValue', '@({})'.format(data_type.max_value)
                         if data_type.max_value else 'nil'),
                    ]))
        elif is_string_type(data_type):
            if data_type.pattern or data_type.min_length or data_type.max_length:
                pattern = data_type.pattern.encode('unicode_escape').replace(
                    b"\"",
                    b"\\\"") if data_type.pattern else None
                validator = '{}:{}'.format(
                    fmt_validator(data_type),
                    fmt_func_args([
                        ('minLength', '@({})'.format(data_type.min_length)
                         if data_type.min_length else 'nil'),
                        ('maxLength', '@({})'.format(data_type.max_length)
                         if data_type.max_length else 'nil'),
                        ('pattern', '@"{}"'.format(six.ensure_str(pattern))
                         if pattern else 'nil'),
                    ]))

        if nullable:
            if validator:
                validator = fmt_func_call(
                    caller='DBStoneValidators', callee=validator)
                validator = fmt_func_call(
                    caller='DBStoneValidators',
                    callee='nullableValidator',
                    args=validator)
        else:
            if validator:
                validator = fmt_func_call(
                    caller='DBStoneValidators', callee=validator)
            else:
                validator = 'nil'
            if not has_default:
                validator = fmt_func_call(
                    caller='DBStoneValidators',
                    callee='nonnullValidator',
                    args=validator)
            else:
                validator = None
        return validator

    def _generate_struct_serializer(self, struct):
        """Emits the serialize method for the serialization object for the given struct."""
        struct_name = fmt_class_prefix(struct)

        with self.block_func(
                func='serialize',
                args=fmt_func_args_declaration([('valueObj',
                                                 '{} *'.format(struct_name))]),
                return_type='NSDictionary<NSString *, id> *',
                class_func=True):
            if not struct.all_fields and not struct.has_enumerated_subtypes():
                self.emit('#pragma unused(valueObj)')

            self.emit(
                'NSMutableDictionary *jsonDict = [[NSMutableDictionary alloc] init];'
            )
            self.emit()
            for field in struct.all_fields:
                data_type, nullable = unwrap_nullable(field.data_type)

                input_value = 'valueObj.{}'.format(fmt_var(field.name))
                serialize_call = self._fmt_serialization_call(
                    field.data_type, input_value, True)

                if not nullable:
                    if is_primitive_type(data_type):
                        self.emit('jsonDict[@"{}"] = {};'.format(
                            field.name, input_value))
                    else:
                        self.emit('jsonDict[@"{}"] = {};'.format(
                            field.name, serialize_call))
                else:
                    with self.block('if ({})'.format(input_value)):
                        self.emit('jsonDict[@"{}"] = {};'.format(
                            field.name, serialize_call))
            self.emit()

            if struct.has_enumerated_subtypes():
                first_block = True
                for tags, subtype in struct.get_all_subtypes_with_tags():
                    assert len(tags) == 1, tags
                    tag = tags[0]
                    base_condition = '{} ([valueObj isKindOfClass:[{} class]])'
                    with self.block(
                            base_condition.format('if' if first_block else
                                                  'else if',
                                                  fmt_class_prefix(subtype))):
                        if first_block:
                            first_block = False
                        func_args = fmt_func_args([('value',
                            '({} *)valueObj'.format(
                                fmt_class_prefix(
                                    subtype)))])
                        caller = fmt_serial_class(fmt_class_prefix(subtype))
                        serialize_call = fmt_func_call(
                            caller=caller, callee='serialize', args=func_args)
                        self.emit('NSDictionary *subTypeFields = {};'.format(
                            serialize_call))
                        with self.block(
                                'for (NSString* key in subTypeFields)'):
                            self.emit('jsonDict[key] = subTypeFields[key];')
                        self.emit(
                            'jsonDict[@".tag"] = @"{}";'.format(fmt_var(tag)))
                self.emit()
            self.emit('return jsonDict;')
        self.emit()

    def _generate_struct_deserializer(self, struct):
        """Emits the deserialize method for the serialization object for the given struct."""
        struct_name = fmt_class_prefix(struct)

        with self.block_func(
                func='deserialize',
                args=fmt_func_args_declaration([('valueDict',
                                                 'NSDictionary<NSString *, id> *')]),
                return_type='{} *'.format(struct_name),
                class_func=True):
            if not struct.all_fields and not struct.has_enumerated_subtypes():
                self.emit('#pragma unused(valueDict)')

            def emit_struct_deserialize_logic(struct):
                for field in struct.all_fields:
                    data_type, nullable = unwrap_nullable(field.data_type)
                    input_value = 'valueDict[@"{}"]'.format(field.name)

                    if is_primitive_type(data_type):
                        deserialize_call = input_value
                    else:
                        deserialize_call = self._fmt_serialization_call(
                            field.data_type, input_value, False)

                    if nullable or field.has_default:
                        default_value = fmt_default_value(
                            field) if field.has_default else 'nil'
                        if is_primitive_type(data_type):
                            deserialize_call = '{} ?: {}'.format(
                                input_value, default_value)
                        else:
                            deserialize_call = '{} ? {} : {}'.format(
                                input_value, deserialize_call, default_value)

                    self.emit('{}{} = {};'.format(
                        fmt_type(field.data_type),
                        fmt_var(field.name), deserialize_call))

                self.emit()

                deserialized_obj_args = [(fmt_var(f.name), fmt_var(f.name))
                                         for f in struct.all_fields]
                init_call = fmt_func_call(
                    caller=fmt_alloc_call(caller=struct_name),
                    callee=self._cstor_name_from_fields(struct.all_fields),
                    args=fmt_func_args(deserialized_obj_args))
                self.emit('return {};'.format(init_call))

            if not struct.has_enumerated_subtypes():
                emit_struct_deserialize_logic(struct)
            else:
                for tags, subtype in struct.get_all_subtypes_with_tags():
                    assert len(tags) == 1, tags
                    tag = tags[0]

                    base_string = 'if ([valueDict[@".tag"] isEqualToString:@"{}"])'
                    with self.block(base_string.format(tag)):
                        caller = fmt_serial_class(fmt_class_prefix(subtype))
                        args = fmt_func_args([('value', 'valueDict')])
                        deserialize_call = fmt_func_call(
                            caller=caller, callee='deserialize', args=args)
                        self.emit('return {};'.format(deserialize_call))

                self.emit()

                if struct.is_catch_all():
                    emit_struct_deserialize_logic(struct)
                else:
                    description_str = (
                        '[NSString stringWithFormat:@"Tag has an invalid '
                        'value: \\\"%@\\\".", valueDict[@".tag"]]')
                    self._generate_throw_error('InvalidTag', description_str)
        self.emit()

    def _generate_union_serializer(self, union):
        """Emits the serialize method for the serialization object for the given union."""
        union_name = fmt_class_prefix(union)

        with self.block_func(
                func='serialize',
                args=fmt_func_args_declaration([('valueObj',
                                                 '{} *'.format(union_name))]),
                return_type='NSDictionary<NSString *, id> *',
                class_func=True):

            if not union.all_fields:
                self.emit('#pragma unused(valueObj)')

            self.emit(
                'NSMutableDictionary *jsonDict = [[NSMutableDictionary alloc] init];'
            )
            self.emit()

            first_block = True
            for field in union.all_fields:
                with self.block('{} ([valueObj is{}])'.format(
                        'if' if first_block else 'else if',
                        fmt_camel_upper(field.name))):
                    data_type, nullable = unwrap_nullable(field.data_type)
                    input_value = 'valueObj.{}'.format(fmt_var(field.name))
                    serialize_call = self._fmt_serialization_call(
                        field.data_type, input_value, True)

                    def emit_serializer():
                        if is_user_defined_type(data_type):
                            if is_struct_type(data_type) and \
                                    not data_type.has_enumerated_subtypes():
                                self.emit('[jsonDict addEntriesFromDictionary:{}];'.
                                          format(serialize_call))
                            else:
                                self.emit(
                                    'jsonDict[@"{}"] = [{} mutableCopy];'.
                                    format(field.name, serialize_call))
                        elif is_primitive_type(data_type):
                            self.emit('jsonDict[@"{}"] = {};'.format(
                                field.name, input_value))
                        else:
                            self.emit('jsonDict[@"{}"] = {};'.format(
                                field.name, serialize_call))

                    if not is_void_type(data_type):
                        if not nullable:
                            emit_serializer()
                        else:
                            with self.block('if (valueObj.{})'.format(
                                    fmt_var(field.name))):
                                emit_serializer()

                    self.emit('jsonDict[@".tag"] = @"{}";'.format(field.name))

                if first_block:
                    first_block = False

            with self.block('else'):
                if not union.closed:
                    self.emit('jsonDict[@".tag"] = @"other";')
                else:
                    self._generate_throw_error(
                        'InvalidTag',
                        '@"Object not properly initialized. Tag has an unknown value."'
                    )

            self.emit()
            self.emit('return jsonDict;')

        self.emit()

    def _generate_union_deserializer(self, union):
        """Emits the deserialize method for the serialization object for the given union."""
        union_name = fmt_class_prefix(union)

        with self.block_func(
                func='deserialize',
                args=fmt_func_args_declaration([('valueDict',
                                                 'NSDictionary<NSString *, id> *')]),
                return_type='{} *'.format(union_name),
                class_func=True):
            if not union.all_fields:
                self.emit('#pragma unused(valueDict)')

            self.emit('NSString *tag = valueDict[@".tag"];')
            self.emit()

            first_block = True
            for field in union.all_fields:
                base_cond = '{} ([tag isEqualToString:@"{}"])'
                with self.block(
                        base_cond.format('if' if first_block else 'else if',
                                         field.name)):
                    if first_block:
                        first_block = False
                    if not is_void_type(field.data_type):
                        data_type, nullable = unwrap_nullable(field.data_type)
                        if is_struct_type(
                                data_type
                        ) and not data_type.has_enumerated_subtypes():
                            input_value = 'valueDict'
                        else:
                            input_value = 'valueDict[@"{}"]'.format(field.name)

                        if is_primitive_type(data_type):
                            deserialize_call = input_value
                        else:
                            deserialize_call = self._fmt_serialization_call(
                                data_type, input_value, False)

                        if nullable:
                            deserialize_call = '{} ? {} : nil'.format(
                                input_value, deserialize_call)

                        self.emit('{}{} = {};'.format(
                            fmt_type(field.data_type),
                            fmt_var(field.name), deserialize_call))
                        deserialized_obj_args = [(fmt_var(field.name),
                                                  fmt_var(field.name))]
                    else:
                        deserialized_obj_args = []

                    args = fmt_func_args(deserialized_obj_args)
                    callee = self._cstor_name_from_field(field)
                    self.emit('return {};'.format(
                        fmt_func_call(
                            caller=fmt_alloc_call(union_name),
                            callee=callee,
                            args=args)))
            with self.block('else'):
                if not union.closed:
                    callee = 'initWithOther'
                    self.emit('return {};'.format(
                        fmt_func_call(
                            caller=fmt_alloc_call(union_name), callee=callee)))
                else:
                    reason = (
                        '[NSString stringWithFormat:@"Tag has an '
                        'invalid value: \\\"%@\\\".", valueDict[@".tag"]]')
                    self._generate_throw_error('InvalidTag', reason)
        self.emit()

    def _fmt_serialization_call(self, data_type, input_value, serialize, depth=0):
        """Returns the appropriate serialization / deserialization method
        call for the given data type."""
        data_type, _ = unwrap_nullable(data_type)
        serializer_func = 'serialize' if serialize else 'deserialize'
        serializer_args = []

        if is_primitive_type(data_type):
            return input_value

        if is_list_type(data_type) or is_map_type(data_type):
            serializer_args.append(('value', input_value))
            elem_data_type = (data_type.value_data_type if
                is_map_type(data_type) else data_type.data_type)
            serialization_call = self._fmt_serialization_call(
                elem_data_type, 'elem{}'.format(depth), serialize, depth + 1)
            data_struct_block = '^id(id elem{}) {{ return {}; }}'.format(
                depth, serialization_call)
            serializer_args.append(('withBlock', data_struct_block))
        elif is_timestamp_type(data_type):
            serializer_args.append(('value', input_value))
            serializer_args.append(('dateFormat',
                                    '@"{}"'.format(data_type.format)))
        else:
            serializer_args.append(('value', input_value))

        return '{}'.format(
            fmt_func_call(
                caller=fmt_serial_obj(data_type),
                callee=serializer_func,
                args=fmt_func_args(serializer_args)))

    def _generate_route_objects_m(self, route_schema, namespace):
        """Emits implementation files for Route objects which encapsulate information
        regarding each route. These objects are passed as parameters when route calls are made."""
        output_path = 'Routes/RouteObjects/{}.m'.format(
            fmt_route_obj_class(namespace.name))

        with self.output_to_relative_path(output_path):
            self.emit_raw(base_file_comment)

            import_classes = [
                fmt_route_obj_class(namespace.name),
                'DBStoneBase',
                'DBRequestErrors',
            ]

            for auth_type in self.namespace_to_has_route_auth_list[namespace]:
                import_classes.append(
                    fmt_routes_class(namespace.name, auth_type))

            imports_classes_m = import_classes + \
                self._get_imports_m(
                    self._get_namespace_route_imports(namespace, include_route_args=False), [])
            self._generate_imports_m(imports_classes_m)

            with self.block_m(fmt_route_obj_class(namespace.name)):
                for route in namespace.routes:
                    route_name = fmt_route_var(namespace.name, route)
                    self.emit('static DBRoute *{};'.format(route_name))
                self.emit()

                self.emit('static NSObject *lockObj = nil;')
                with self.block_func(
                        func='initialize',
                        args=[],
                        return_type='void',
                        class_func=True):
                    self.emit('static dispatch_once_t onceToken;')
                    with self.block(
                            'dispatch_once(&onceToken, ^{',
                            delim=(None, None),
                            after='});'):
                        self.emit('lockObj = [[NSObject alloc] init];')
                    self.emit()
                self.emit()

                for route in namespace.routes:
                    route_name = fmt_route_var(namespace.name, route)
                    if route.version == 1:
                        route_path = route.name
                    else:
                        route_path = '{}_v{}'.format(route.name, route.version)

                    if route.deprecated:
                        deprecated = '@{}'.format('YES')
                    else:
                        deprecated = '@{}'.format('NO')

                    if not is_void_type(route.result_data_type):
                        caller = fmt_class_type(
                            route.result_data_type, suppress_ptr=True)
                        result_type = fmt_func_call(
                            caller=caller, callee='class')
                    else:
                        result_type = 'nil'

                    if not is_void_type(route.error_data_type):
                        caller = fmt_class_type(
                            route.error_data_type, suppress_ptr=True)
                        error_type = fmt_func_call(
                            caller=caller, callee='class')
                    else:
                        error_type = 'nil'

                    if is_list_type(route.arg_data_type) or is_map_type(route.arg_data_type):
                        dataStructSerialBlock = '^id(id dataStruct) {{ return {}; }}'.format(
                            self._fmt_serialization_call(
                                route.result_data_type, 'dataStruct', True))
                    else:
                        dataStructSerialBlock = 'nil'

                    if is_list_type(route.result_data_type) or is_map_type(route.result_data_type):
                        dataStructDeserialBlock = '^id(id dataStruct) {{ return {}; }}'.format(
                            self._fmt_serialization_call(
                                route.result_data_type, 'dataStruct', False))
                    else:
                        dataStructDeserialBlock = 'nil'

                    with self.block_func(
                            func=route_name,
                            args=[],
                            return_type='DBRoute *',
                            class_func=True):
                        with self.block('@synchronized(lockObj)'):
                            with self.block('if (!{})'.format(route_name)):
                                with self.block(
                                        '{} = [[DBRoute alloc] init:'.format(
                                            route_name),
                                        delim=(None, None),
                                        after='];'):
                                    self.emit('@\"{}\"'.format(route_path))
                                    self.emit('namespace_:@\"{}\"'.format(
                                        namespace.name))
                                    self.emit('deprecated:{}'.format(deprecated))
                                    self.emit('resultType:{}'.format(result_type))
                                    self.emit('errorType:{}'.format(error_type))

                                    attrs = []
                                    for field in route_schema.fields:
                                        attr_key = field.name
                                        attr_val = ("@\"{}\"".format(route.attrs
                                                .get(attr_key)) if route.attrs
                                            .get(attr_key)
                                            else 'nil')
                                        attrs.append('@\"{}\": {}'.format(
                                            attr_key, attr_val))

                                    self.generate_multiline_list(
                                        attrs,
                                        delim=('attrs:@{', '}'),
                                        compact=True)

                                    self.emit('dataStructSerialBlock:{}'.format(
                                        dataStructSerialBlock))
                                    self.emit('dataStructDeserialBlock:{}'.format(
                                        dataStructDeserialBlock))

                            self.emit('return {};'.format(route_name))
                        self.emit()
                    self.emit()

    def _generate_route_objects_h(
            self,
            route_schema,  # pylint: disable=unused-argument
            namespace):
        """Emits header files for Route objects which encapsulate information
         regarding each route. These objects are passed as parameters when route calls are made."""
        output_path = 'Routes/RouteObjects/{}.h'.format(
            fmt_route_obj_class(namespace.name))
        with self.output_to_relative_path(output_path):
            self.emit_raw(base_file_comment)

            self.emit('#import <Foundation/Foundation.h>')
            self.emit()
            self._generate_imports_h(['DBRoute'])

            self.emit()
            self.emit('NS_ASSUME_NONNULL_BEGIN')
            self.emit()

            self.emit(comment_prefix)
            description_str = (
                'Stone route objects for the {} namespace. Each route in '
                'the {} namespace has its own static object, which contains '
                'information about the route.')
            self.emit_wrapped_text(
                description_str.format(
                    fmt_class(namespace.name), fmt_class(namespace.name)),
                prefix=comment_prefix)
            self.emit(comment_prefix)
            with self.block_h(fmt_route_obj_class(namespace.name)):
                for route in namespace.routes:
                    route_name = fmt_route_var(namespace.name, route)

                    route_obj_access_signature = fmt_signature(
                        func=route_name,
                        args=None,
                        return_type='DBRoute *',
                        class_func=True)
                    base_str = 'Accessor method for the {} route object.'
                    self.emit_wrapped_text(
                        base_str.format(fmt_route_func(route)),
                        prefix=comment_prefix)
                    self.emit('{};'.format(route_obj_access_signature))
                    self.emit()

            self.emit()
            self.emit('NS_ASSUME_NONNULL_END')
            self.emit()

    def _generate_union_tag_access_signatures(self, union):
        """Emits the is<TAG_NAME> methods and tagName method signatures for
         determining tag state and retrieving human-readable value of tag
         state, respectively."""
        for field in union.all_fields:
            self.emit(comment_prefix)
            base_str = 'Retrieves whether the union\'s current tag state has value "{}".'
            self.emit_wrapped_text(
                base_str.format(field.name), prefix=comment_prefix)
            self.emit(comment_prefix)
            if not is_void_type(field.data_type):
                warning_str = (
                    '@note Call this method and ensure it returns true before '
                    'accessing the `{}` property, otherwise a runtime exception '
                    'will be thrown.')
                self.emit_wrapped_text(
                    warning_str.format(fmt_var(field.name)),
                    prefix=comment_prefix)
                self.emit(comment_prefix)
            base_str = '@return Whether the union\'s current tag state has value "{}".'
            self.emit_wrapped_text(
                base_str.format(field.name), prefix=comment_prefix)
            self.emit(comment_prefix)

            is_tag_signature = fmt_signature(
                func='is{}'.format(fmt_camel_upper(field.name)),
                args=[],
                return_type='BOOL')
            self.emit('{};'.format(is_tag_signature))
            self.emit()

        get_tag_name_signature = fmt_signature(
            func='tagName', args=None, return_type='NSString *')

        self.emit(comment_prefix)
        self.emit_wrapped_text(
            "Retrieves string value of union's current tag state.",
            prefix=comment_prefix)
        self.emit(comment_prefix)
        base_str = "@return A human-readable string representing the union's current tag state."
        self.emit_wrapped_text(base_str, prefix=comment_prefix)
        self.emit(comment_prefix)
        self.emit('{};'.format(get_tag_name_signature))
        self.emit()

    def _generate_union_tag_state_funcs(self, union):
        """Emits the is<TAG_NAME> methods and tagName method for determining
        tag state and retrieving human-readable value of tag state, respectively."""
        for field in union.all_fields:
            enum_field_name = fmt_enum_name(field.name, union)

            with self.block_func(
                    func='is{}'.format(fmt_camel_upper(field.name)),
                    args=[],
                    return_type='BOOL'):
                self.emit('return _tag == {};'.format(enum_field_name))
            self.emit()

        with self.block_func(
                func='tagName', args=[], return_type='NSString *'):
            with self.block('switch (_tag)'):
                for field in union.all_fields:
                    enum_field_name = fmt_enum_name(field.name, union)
                    self.emit('case {}:'.format(enum_field_name))
                    self.emit('   return @"{}";'.format(enum_field_name))
            self.emit()
            self._generate_throw_error('InvalidTag',
                                       '@"Tag has an unknown value."')
        self.emit()

    def _generate_union_tag_vars_funcs(self, union):
        """Emits the getter methods for retrieving tag-specific state. Setters throw
        an error in the event an associated tag state variable is accessed without
        the correct tag state."""
        for field in union.all_fields:
            if not is_void_type(field.data_type):
                enum_field_name = fmt_enum_name(field.name, union)

                with self.block_func(
                        func=fmt_camel(field.name),
                        args=[],
                        return_type=fmt_type(field.data_type)):

                    with self.block(
                            'if (![self is{}])'.format(
                                fmt_camel_upper(field.name)),
                            delim=('{', '}')):
                        error_msg = 'Invalid tag: required {}, but was %@.'.format(
                            enum_field_name)
                        throw_exc = (
                            '[NSException raise:@"IllegalStateException" '
                            'format:@"{}", [self tagName]];')
                        self.emit(throw_exc.format(error_msg))
                    self.emit('return _{};'.format(fmt_var(field.name)))
                self.emit()

    def _generate_struct_properties(self, fields):
        """Emits struct instance properties from the given fields."""
        for field in fields:
            doc = self.process_doc(field.doc,
                                   self._docf) if field.doc else undocumented
            self.emit_wrapped_text(
                self.process_doc(doc, self._docf), prefix=comment_prefix)
            self.emit(fmt_property(field=field))
            self.emit()

    def _generate_union_properties(self, fields):
        """Emits union instance properties from the given fields."""
        for field in fields:
            # void types do not need properties to store additional state
            # information
            if not is_void_type(field.data_type):
                doc = self.process_doc(
                    field.doc, self._docf) if field.doc else undocumented
                warning_str = (
                    ' @note Ensure the `is{}` method returns true before accessing, '
                    'otherwise a runtime exception will be raised.')
                doc += warning_str.format(fmt_camel_upper(field.name))
                self.emit_wrapped_text(
                    self.process_doc(doc, self._docf), prefix=comment_prefix)
                self.emit(fmt_property(field=field))
                self.emit()

    def _generate_union_tag_property(self, union):
        """Emits union instance property representing union state."""
        self.emit_wrapped_text(
            'Represents the union\'s current tag state.',
            prefix=comment_prefix)
        self.emit(
            fmt_property_str(
                prop='tag', typ='{}'.format(fmt_enum_name('tag', union))))
        self.emit()

    def _generate_class_comment(self, data_type):
        """Emits a generic class comment for a union or struct."""
        if is_struct_type(data_type):
            class_type = 'struct'
        elif is_union_type(data_type):
            class_type = 'union'
        else:
            raise TypeError('Can\'t handle type %r' % type(data_type))

        self.emit(comment_prefix)
        self.emit_wrapped_text(
            'The `{}` {}.'.format(fmt_class(data_type.name), class_type),
            prefix=comment_prefix)

        if data_type.doc:
            self.emit(comment_prefix)
            self.emit_wrapped_text(
                self.process_doc(data_type.doc, self._docf),
                prefix=comment_prefix)

        self.emit(comment_prefix)
        protocol_str = (
            'This class implements the `DBSerializable` protocol '
            '(serialize and deserialize instance methods), which is required '
            'for all Obj-C SDK API route objects.')
        self.emit_wrapped_text(
            protocol_str.format(fmt_class_prefix(data_type), class_type),
            prefix=comment_prefix)
        self.emit(comment_prefix)

    def _generate_throw_error(self, name, reason):
        """Emits a generic error throwing line."""
        throw_exc = '@throw([NSException exceptionWithName:@"{}" reason:{} userInfo:nil]);'
        self.emit(throw_exc.format(name, reason))

    def _docf(self, tag, val):
        if tag == 'route':
            return '`{}`'.format(fmt_func(val))
        elif tag == 'field':
            if '.' in val:
                cls_name, field = val.split('.')
                return ('`{}` in `{}`'.format(
                    fmt_var(field), self.obj_name_to_namespace[cls_name]))
            else:
                return fmt_var(val)
        elif tag in ('type', 'val', 'link'):
            return val
        else:
            return val
