import json
import os
import shutil

import six
import jinja2
import textwrap

from stone.backends.swift import (
    fmt_serial_obj,
    SwiftBaseBackend,
    undocumented,
    _nsnumber_type_table,
)

from stone.backends.swift_helpers import (
    check_route_name_conflict,
    fmt_class,
    fmt_default_value,
    fmt_func,
    fmt_var,
    fmt_type,
    fmt_route_name,
    fmt_objc_type,
    mapped_list_info,
    field_is_user_defined,
    field_is_user_defined_optional,
    field_is_user_defined_map,
    field_is_user_defined_list,
    objc_datatype_value_type_tuples,
    field_datatype_has_subtypes
)

from stone.ir import (
    is_list_type,
    is_numeric_type,
    is_string_type,
    is_struct_type,
    is_union_type,
    is_void_type,
    unwrap_nullable,
    is_user_defined_type,
    is_boolean_type,
    is_map_type
)

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

import argparse

_cmdline_parser = argparse.ArgumentParser(prog='swift-types-backend')
_cmdline_parser.add_argument(
    '-r',
    '--route-method',
    help=('A string used to construct the location of a Swift method for a '
          'given route; use {ns} as a placeholder for namespace name and '
          '{route} for the route name.'),
)
_cmdline_parser.add_argument(
    '--objc',
    action='store_true',
    help='Generate the Objective-C compatibile files',
)
_cmdline_parser.add_argument(
    '-d',
    '--documentation',
    action='store_true',
    help=('Sets whether documentation is generated.'),
)

class SwiftTypesBackend(SwiftBaseBackend):
    """
    Generates Swift modules to represent the input Stone spec.

    Examples for a hypothetical 'copy' enpoint:

    Endpoint argument (struct):

    ```
    public class CopyArg: CustomStringConvertible {
        public let fromPath: String
        public let toPath: String
        public init(fromPath: String, toPath: String) {
            stringValidator(pattern: "/(.|[\\r\\n])*")(value: fromPath)
            self.fromPath = fromPath
            stringValidator(pattern: "/(.|[\\r\\n])*")(value: toPath)
            self.toPath = toPath
        }
        public var description: String {
            return "\\(SerializeUtil.prepareJSONForSerialization(
                CopyArgSerializer().serialize(self)))"
        }
    }
    ```

    Endpoint error (union):

    ```
    public enum CopyError: CustomStringConvertible {
        case TooManyFiles
        case Other

        public var description: String {
            return "\\(SerializeUtil.prepareJSONForSerialization(
                CopyErrorSerializer().serialize(self)))"
        }
    }
    ```

    Argument serializer (error serializer not listed):

    ```
    public class CopyArgSerializer: JSONSerializer {
        public init() { }
        public func serialize(value: CopyArg) -> JSON {
            let output = [
            "from_path": Serialization.serialize(value.fromPath),
            "to_path": Serialization.serialize(value.toPath),
            ]
            return .Dictionary(output)
        }
        public func deserialize(json: JSON) -> CopyArg {
            switch json {
                case .Dictionary(let dict):
                    let fromPath = Serialization.deserialize(dict["from_path"] ?? .Null)
                    let toPath = Serialization.deserialize(dict["to_path"] ?? .Null)
                    return CopyArg(fromPath: fromPath, toPath: toPath)
                default:
                    fatalError("Type error deserializing")
            }
        }
    }
    ```
    """

    cmdline_parser = _cmdline_parser
    def generate(self, api):
        rsrc_folder = os.path.join(os.path.dirname(__file__), 'swift_rsrc')
        if not self.args.objc:
            self.logger.info('Copying StoneValidators.swift to output folder')
            shutil.copy(os.path.join(rsrc_folder, 'StoneValidators.swift'),
                        self.target_folder_path)
            self.logger.info('Copying StoneSerializers.swift to output folder')
            shutil.copy(os.path.join(rsrc_folder, 'StoneSerializers.swift'),
                        self.target_folder_path)
            self.logger.info('Copying StoneBase.swift to output folder')
            shutil.copy(os.path.join(rsrc_folder, 'StoneBase.swift'),
                        self.target_folder_path)

        template_loader = jinja2.FileSystemLoader(searchpath=rsrc_folder)
        template_env = jinja2.Environment(loader=template_loader,
                                          trim_blocks=True,
                                          lstrip_blocks=True,
                                          autoescape=False)

        template_globals = {}
        template_globals['fmt_class'] = fmt_class
        template_globals['is_struct_type'] = is_struct_type
        template_globals['is_union_type'] = is_union_type
        template_globals['fmt_var'] = fmt_var
        template_globals['fmt_type'] = fmt_type
        template_globals['func_args'] = self._func_args
        template_globals['struct_init_args'] = self._struct_init_args
        template_globals['determine_validator_type'] = self._determine_validator_type
        template_globals['fmt_serial_obj'] = fmt_serial_obj
        template_globals['fmt_default_value'] = fmt_default_value
        template_globals['format_tag_type'] = self._format_tag_type
        template_globals['is_void_type'] = is_void_type
        template_globals['tag_type'] = self._tag_type
        template_globals['fmt_func'] = fmt_func
        template_globals['data_type_doc'] = self._data_type_doc
        template_globals['struct_field_doc'] = self._struct_field_doc
        template_globals['union_field_doc'] = self._union_field_doc
        template_globals['field_name_args'] = self._field_name_args
        template_globals['route_schema_attrs'] = self._route_schema_attrs
        template_globals['fmt_route_name'] = fmt_route_name
        template_globals['data_objc_type_doc'] = self._data_objc_type_doc
        template_globals['objc_init_args'] = self._objc_init_args
        template_globals['fmt_objc_type'] = fmt_objc_type
        oneliner_func_key = 'objc_return_field_value_oneliner'
        template_globals[oneliner_func_key] = self._objc_return_field_value_oneliner
        template_globals['field_is_user_defined'] = field_is_user_defined
        template_globals['field_is_user_defined_optional'] = field_is_user_defined_optional
        template_globals['field_is_user_defined_list'] = field_is_user_defined_list
        template_globals['field_is_user_defined_map'] = field_is_user_defined_map
        in_jinja_key = 'field_datatype_has_subtypes'
        template_globals[in_jinja_key] = field_datatype_has_subtypes
        template_globals['objc_datatype_value_type_tuples'] = objc_datatype_value_type_tuples
        template_globals['objc_init_args_to_swift'] = self._objc_init_args_to_swift
        template_globals['objc_union_arg'] = self._objc_union_arg
        template_globals['objc_swift_var_name'] = self._objc_swift_var_name
        template_globals['swift_union_arg_to_objc'] = self._swift_union_arg_to_objc
        template_globals['union_swift_arg_guard'] = self._union_swift_arg_guard

        swift_template_file = "SwiftTypes.jinja"
        swift_template = template_env.get_template(swift_template_file)
        swift_template.globals = template_globals

        objc_template_file = "ObjcTypes.jinja"
        objc_template = template_env.get_template(objc_template_file)
        objc_template.globals = template_globals

        for namespace in api.namespaces.values():
            ns_class = fmt_class(namespace.name)

            if self.args.objc:
                objc_output = objc_template.render(namespace=namespace,
                                                   route_schema=api.route_schema)
                self._write_output_in_target_folder(objc_output,
                                                    'DBX{}.swift'.format(ns_class))
            else:
                swift_output = swift_template.render(namespace=namespace,
                                                     route_schema=api.route_schema)
                self._write_output_in_target_folder(swift_output,
                                                    '{}.swift'.format(ns_class))
        if self.args.documentation:
            self._generate_jazzy_docs(api)

    def _generate_jazzy_docs(self, api):
        jazzy_cfg_path = os.path.join('../Format', 'jazzy.json')
        with open(jazzy_cfg_path, encoding='utf-8') as jazzy_file:
            jazzy_cfg = json.load(jazzy_file)

        for namespace in api.namespaces.values():
            ns_class = fmt_class(namespace.name)
            jazzy_cfg['custom_categories'][1]['children'].append(ns_class)

            if namespace.routes:
                check_route_name_conflict(namespace)
                jazzy_cfg['custom_categories'][0]['children'].append(ns_class + 'Routes')

        with self.output_to_relative_path('../../../../.jazzy.json'):
            self.emit_raw(json.dumps(jazzy_cfg, indent=2) + '\n')

    def _data_type_doc(self, data_type):
        if data_type.doc:
            doc = self.process_doc(data_type.doc, self._docf)
        else:
            doc = 'The {} {}'.format(fmt_class(data_type.name),
                                     'struct' if is_struct_type(data_type) else 'union')
        return textwrap.fill(doc,
                             initial_indent='/// ',
                             subsequent_indent='    /// ',
                             break_long_words=False,
                            break_on_hyphens=False,
                             width=116)

    def _data_objc_type_doc(self, data_type):
        if data_type.doc:
            doc = self.process_doc(data_type.doc, self._docf)
        else:
            doc = 'Objective-C compatible {} {}'.format(fmt_class(data_type.name),
                                     'struct' if is_struct_type(data_type) else 'union')
        return textwrap.fill(doc,
                             initial_indent='/// ',
                             subsequent_indent='/// ',
                             break_long_words=False,
                            break_on_hyphens=False,
                             width=116)

    def _struct_field_doc(self, field, subsequent_indent='        '):
        return self._field_doc(field, undocumented, subsequent_indent)

    def _union_field_doc(self, field, subsequent_indent='        '):
        return self._field_doc(field, 'An unspecified error.', subsequent_indent)

    def _field_doc(self, field, error_text, subsequent_indent='        '):
        fdoc = self.process_doc(field.doc, self._docf) if field.doc else error_text
        return textwrap.fill(fdoc,
                             initial_indent='/// ',
                             subsequent_indent='{}/// '.format(subsequent_indent),
                             break_long_words=False,
                             break_on_hyphens=False,
                             width=112)

    def _determine_validator_type(self, data_type, value):
        data_type, nullable = unwrap_nullable(data_type)
        if is_list_type(data_type):
            item_validator = self._determine_validator_type(data_type.data_type, value)
            if item_validator:
                v = "arrayValidator({})".format(
                    self._func_args([
                        ("minItems", data_type.min_items),
                        ("maxItems", data_type.max_items),
                        ("itemValidator", item_validator),
                    ])
                )
            else:
                return None
        elif is_numeric_type(data_type):
            v = "comparableValidator({})".format(
                self._func_args([
                    ("minValue", data_type.min_value),
                    ("maxValue", data_type.max_value),
                ])
            )
        elif is_string_type(data_type):
            pat = data_type.pattern if data_type.pattern else None
            pat = pat.encode('unicode_escape').replace(b"\"",
                                                       b"\\\"") if pat else pat
            v = "stringValidator({})".format(
                self._func_args([
                    ("minLength", data_type.min_length),
                    ("maxLength", data_type.max_length),
                    ("pattern", '"{}"'.format(six.ensure_str(pat)) if pat else None),
                ])
            )
        else:
            return None

        if nullable:
            v = "nullableValidator({})".format(v)
        return v

    def _format_tag_type(self, data_type):
        if is_void_type(data_type):
            return ''
        else:
            return '({})'.format(fmt_type(data_type))

    def _tag_type(self, data_type, field):
        return "{}.{}".format(
            fmt_class(data_type.name),
            fmt_var(field.name)
        )

    def _field_name_args(self, data_type):
        args = []
        for field in data_type.all_fields:
            name = fmt_var(field.name)
            arg = (name, name)
            args.append(arg)

        return self._func_args(args)

    def _route_schema_attrs(self, route_schema, route):
        attrs = []
        for field in route_schema.fields:
            attr_key = field.name
            if route.attrs.get(attr_key):
                attr_val = route.attrs.get(attr_key)
                if attr_key == 'auth':
                    auths = attr_val.split(', ')
                    auths = ['.{}'.format(auth) for auth in auths]
                    attr_val = ', '.join(auths)
                    attrs.append('{}: [{}]'.format(attr_key, attr_val))
                else:
                    attrs.append('{}: .{}'.format(attr_key, attr_val))

        result = ',\n                                    '.join(attrs)
        return result

    def _objc_return_field_value_oneliner(self, parent_type, field):
        data_type, nullable = unwrap_nullable(field.data_type)
        swift_var_name = self._objc_swift_var_name(parent_type)

        if is_list_type(data_type):
            _, prefix, suffix, list_data_type, list_nullable = mapped_list_info(data_type)

            value = '{}.{}'.format(swift_var_name,
                                   fmt_var(field.name))

            if not is_numeric_type(list_data_type) and not is_user_defined_type(list_data_type):
                return value

            if is_user_defined_type(list_data_type):
                objc_type = fmt_objc_type(list_data_type, False)
                value = '{}{}.map {}{{ {}(swift: $0) }}'.format(value,
                                                                '?' if nullable else '',
                                                                prefix,
                                                                objc_type)
            elif is_numeric_type(list_data_type):
                map_func = 'compactMap' if list_nullable else 'map'
                value = '{}{}.{} {}{{ $0 as NSNumber{} }}'.format(value,
                                                                  '?' if nullable else '',
                                                                  map_func,
                                                                  prefix,
                                                                  '?' if list_nullable else '')

            value = '{}{}'.format(value, suffix)
            return value
        elif is_map_type(data_type) and is_user_defined_type(data_type.value_data_type):
            objc_type = fmt_objc_type(data_type.value_data_type)
            value = '{}.{}'.format(swift_var_name,
                                   fmt_var(field.name))
            value = '{}{}.mapValues {{ {}(swift: $0) }}'.format(value,
                                                                '?' if nullable else '',
                                                                objc_type)
            return value
        elif is_user_defined_type(data_type):
            value = ''
            swift_arg_name = '{}.{}'.format(swift_var_name,
                                            fmt_var(field.name))
            if nullable:
                value = 'guard let swift = {}.{} else {{ return nil }}; return '.format(
                    swift_var_name,
                    fmt_var(field.name))
                swift_arg_name = 'swift'
            return '{}{}(swift: {})'.format(value,
                                            fmt_objc_type(field.data_type, False),
                                            swift_arg_name)
        elif is_numeric_type(data_type) or is_boolean_type(data_type):
            return '{}.{} as NSNumber{}'.format(swift_var_name,
                                                fmt_var(field.name),
                                                '?' if nullable else '')
        else:
            return '{}.{}'.format(swift_var_name,
                                  fmt_var(field.name))

    def _objc_union_arg(self, field):
        field_data_type, field_nullable = unwrap_nullable(field.data_type)
        nsnumber_type = _nsnumber_type_table.get(field_data_type.__class__)

        if is_list_type(field_data_type):
            _, prefix, suffix, list_data_type, _ = mapped_list_info(field_data_type)

            value = '(arg{}'.format('?' if field_nullable else '')
            list_nsnumber_type = _nsnumber_type_table.get(list_data_type.__class__)

            if not is_user_defined_type(list_data_type) and not list_nsnumber_type:
                value = '(arg'
            else:
                value = '{}.map {}'.format(value,
                                           prefix)

                if is_user_defined_type(list_data_type):
                    value = '{}{{ $0.{} }}'.format(value,
                                                   self._objc_swift_var_name(list_data_type))
                else:
                    value = '{}{{ $0{} }}'.format(value,
                                                  list_nsnumber_type)

            value = '{}{})'.format(value,
                                   suffix)
            return value
        elif is_user_defined_type(field_data_type):
            return '(arg{}.{})'.format('?' if field_nullable else '',
                                       self._objc_swift_var_name(field_data_type))
        elif is_void_type(field_data_type):
            return ''
        elif nsnumber_type:
            return '(arg{}{})'.format('?' if field_nullable else '',
                                      nsnumber_type)
        else:
            return '(arg)'

    def _swift_union_arg_to_objc(self, field):
        field_data_type, field_nullable = unwrap_nullable(field.data_type)
        nsnumber_type = _nsnumber_type_table.get(field_data_type.__class__)

        if is_list_type(field_data_type):
            _, prefix, suffix, list_data_type, _ = mapped_list_info(field_data_type)

            value = 'swiftArg{}'.format('?' if field_nullable else '')
            list_nsnumber_type = _nsnumber_type_table.get(list_data_type.__class__)

            if not is_user_defined_type(list_data_type) and not list_nsnumber_type:
                return 'swiftArg'
            else:
                value = '{}.map {}'.format(value,
                                           prefix)

                if is_user_defined_type(list_data_type):
                    factory_func = '.factory' if is_union_type(list_data_type) else ''
                    value = '{}{{ {}{}(swift: $0) }}'.format(value,
                                                           fmt_objc_type(list_data_type),
                                                           factory_func)
                else:
                    value = '{}{{ NSNumber(value: $0) }}'.format(value)

            value = '{}{}'.format(value,
                                  suffix)
            return value
        elif is_user_defined_type(field_data_type):
            return '{}(swift: swiftArg)'.format(fmt_objc_type(field_data_type))
        elif is_void_type(field_data_type):
            return ''
        elif nsnumber_type:
            return 'NSNumber(value: swiftArg)'
        else:
            return 'swiftArg'

    def _union_swift_arg_guard(self, field, class_name):
        field_data_type, field_nullable = unwrap_nullable(field.data_type)

        if field_nullable and is_user_defined_type(field_data_type):
            return 'guard let swiftArg = swiftArg else {{ return {}(nil) }}'.format(class_name)
        else:
            return ''
