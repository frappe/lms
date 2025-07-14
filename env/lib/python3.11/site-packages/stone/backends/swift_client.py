import json
import os
import jinja2
import textwrap

from stone.ir import (
    is_struct_type,
    is_union_type,
    is_void_type,
    unwrap_nullable,
    is_list_type,
    is_user_defined_type,
    is_numeric_type,
)
from stone.backends.swift import (
    fmt_serial_type,
    SwiftBaseBackend,
    undocumented,
)
from stone.backends.swift_helpers import (
    check_route_name_conflict,
    fmt_class,
    fmt_func,
    fmt_var,
    fmt_type,
    fmt_route_name,
    fmt_route_name_namespace,
    fmt_func_namespace,
    fmt_objc_type,
    mapped_list_info,
    datatype_has_subtypes,
)

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

import argparse


_cmdline_parser = argparse.ArgumentParser(
    prog='swift-client-backend',
    description=(
        'Generates a Swift class with an object for each namespace, and in each '
        'namespace object, a method for each route. This class assumes that the '
        'swift_types backend was used with the same output directory.'),
)
_cmdline_parser.add_argument(
    '-m',
    '--module-name',
    required=True,
    type=str,
    help=('The name of the Swift module to generate. Please exclude the .swift '
          'file extension.'),
)
_cmdline_parser.add_argument(
    '-c',
    '--class-name',
    required=True,
    type=str,
    help=('The name of the Swift class that contains an object for each namespace, '
          'and in each namespace object, a method for each route.')
)
_cmdline_parser.add_argument(
    '-t',
    '--transport-client-name',
    required=True,
    type=str,
    help='The name of the Swift class that manages network API calls.',
)
_cmdline_parser.add_argument(
    '-w',
    '--auth-type',
    type=str,
    help='The auth type of the client to generate.',
)
_cmdline_parser.add_argument(
    '-y',
    '--client-args',
    required=True,
    type=str,
    help='The client-side route arguments to append to each route by style type.',
)
_cmdline_parser.add_argument(
    '-z',
    '--style-to-request',
    required=True,
    type=str,
    help='The dict that maps a style type to a Swift request object name.',
)
_cmdline_parser.add_argument(
    '--objc',
    action='store_true',
    help='Generate the Objective-C compatibile files.',
)


class SwiftBackend(SwiftBaseBackend):
    """
    Generates Swift client base that implements route interfaces.

    Examples:

    ```
    public class ExampleClientBase {
        /// Routes within the namespace1 namespace. See Namespace1 for details.
        public var namespace1: Namespace1!
        /// Routes within the namespace2 namespace. See Namespace2 for details.
        public var namespace2: Namespace2!

        public init(client: ExampleTransportClient) {
            self.namespace1 = Namespace1(client: client)
            self.namespace2 = Namespace2(client: client)
        }
    }
    ```

    Here, `ExampleTransportClient` would contain the implementation of a handwritten,
    project-specific networking client. Additionally, the `Namespace1` object would
    have as its methods all routes in the `Namespace1` namespace. A hypothetical 'copy'
    enpoding might be implemented like:

    ```
    public func copy(fromPath fromPath: String, toPath: String) ->
                     ExampleRequestType<Namespace1.CopySerializer, Namespace1.CopyErrorSerializer> {
        let route = Namespace1.copy
        let serverArgs = Namespace1.CopyArg(fromPath: fromPath, toPath: toPath)
        return client.request(route, serverArgs: serverArgs)
    }
    ```

    Here, ExampleRequestType is a project-specific request type, parameterized by response and
    error serializers.
    """

    cmdline_parser = _cmdline_parser

    def generate(self, api):
        for namespace in api.namespaces.values():
            if namespace.routes:
                self._generate_routes(namespace)

        self._generate_client(api)
        self._generate_request_boxes(api)
        if not self.args.objc:
            self._generate_reconnection_helpers(api)

    def _generate_client(self, api):
        template_globals = {}
        template_globals['class_name'] = self.args.class_name
        template_globals['namespaces'] = api.namespaces.values()
        template_globals['namespace_fields'] = self._namespace_fields(api)
        template_globals['transport_client_name'] = self.args.transport_client_name

        if self.args.objc:
            template = self._jinja_template("ObjCClient.jinja")
            template.globals = template_globals

            self._write_output_in_target_folder(template.render(),
                                                'DBX{}.swift'.format(self.args.module_name))
        else:
            template = self._jinja_template("SwiftClient.jinja")
            template.globals = template_globals

            self._write_output_in_target_folder(template.render(),
                                                '{}.swift'.format(self.args.module_name))

    def _namespace_fields(self, api):
        namespace_fields = []
        for namespace in api.namespaces.values():
            if self._namespace_contains_valid_routes_for_auth_type(namespace):
                namespace_fields.append((fmt_var(namespace.name),
                                        fmt_class(self._class_name(namespace.name))))

        return namespace_fields

    def _generate_routes(self, namespace):
        check_route_name_conflict(namespace)
        if not self._namespace_contains_valid_routes_for_auth_type(namespace):
            return

        template_globals = {}
        template_globals['fmt_class'] = fmt_class
        template_globals['class_name'] = self._class_name
        template_globals['route_doc'] = self._route_doc
        template_globals['route_param_docs'] = self._route_param_docs
        template_globals['route_returns_doc'] = self._route_returns_doc
        template_globals['route_client_args'] = self._route_client_args
        template_globals['fmt_func'] = fmt_func
        template_globals['deprecation_warning'] = self._deprecation_warning
        template_globals['route_args'] = self._route_args
        template_globals['request_object_name'] = self._request_object_name
        template_globals['fmt_serial_type'] = fmt_serial_type
        template_globals['is_struct_type'] = is_struct_type
        template_globals['is_union_type'] = is_union_type
        template_globals['fmt_var'] = fmt_var
        template_globals['server_args'] = self._server_args
        template_globals['fmt_type'] = fmt_type
        template_globals['return_args'] = self._return_args
        template_globals['transport_client_name'] = self.args.transport_client_name
        template_globals['fmt_route_objc_class'] = self._fmt_route_objc_class
        template_globals['route_objc_result_type'] = self._route_objc_result_type
        template_globals['routes_for_objc_requests'] = self._routes_for_objc_requests
        template_globals['valid_route_for_auth_type'] = self._valid_route_for_auth_type
        template_globals['route_objc_func_suffix'] = self._route_objc_func_suffix
        template_globals['fmt_objc_type'] = fmt_objc_type
        template_globals['objc_init_args_to_swift'] = self._objc_init_args_to_swift
        template_globals['objc_result_from_swift'] = self._objc_result_from_swift
        template_globals['objc_no_defualts_func_args'] = self._objc_no_defualts_func_args
        template_globals['objc_app_auth_route_wrapper_already_defined'] = \
            self._objc_app_auth_route_wrapper_already_defined

        ns_class = self._class_name(fmt_class(namespace.name))

        if self.args.objc:
            template = self._jinja_template("ObjCRoutes.jinja")
            template.globals = template_globals

            output_from_parsed_template = template.render(namespace=namespace)

            self._write_output_in_target_folder(output_from_parsed_template,
                                                'DBX{}Routes.swift'.format(ns_class))
        else:
            template = self._jinja_template("SwiftRoutes.jinja")
            template.globals = template_globals

            output_from_parsed_template = template.render(namespace=namespace)

            self._write_output_in_target_folder(output_from_parsed_template,
                                                '{}Routes.swift'.format(ns_class))

    def _generate_request_boxes(self, api):
        background_compatible_routes = self._background_compatible_namespace_route_pairs(api)

        if len(background_compatible_routes) == 0:
            return

        background_objc_routes = self._background_compatible_routes_for_objc_requests(api)

        template_globals = {}
        template_globals['request_type_signature'] = self._request_type_signature
        template_globals['fmt_func'] = fmt_func
        template_globals['fmt_route_objc_class'] = self._fmt_route_objc_class
        template_globals['fmt_func_namespace'] = fmt_func_namespace
        template_globals['fmt_route_name_namespace'] = fmt_route_name_namespace
        swift_class_name = '{}RequestBox'.format(self.args.class_name)

        if self.args.objc:
            template = self._jinja_template("ObjCRequestBox.jinja")
            template.globals = template_globals

            output = template.render(
                background_compatible_routes=background_compatible_routes,
                background_objc_routes=background_objc_routes,
                class_name=swift_class_name
            )

            file_name = 'DBX{}RequestBox.swift'.format(self.args.class_name)
            self._write_output_in_target_folder(output,
                                                file_name)
        else:
            template = self._jinja_template("SwiftRequestBox.jinja")
            template.globals = template_globals

            output = template.render(background_compatible_routes=background_compatible_routes,
                                     background_objc_routes=background_objc_routes,
                                     class_name=swift_class_name)
            self._write_output_in_target_folder(output,
                                                '{}RequestBox.swift'.format(self.args.class_name))

    def _generate_reconnection_helpers(self, api):
        background_compatible_pairs = self._background_compatible_namespace_route_pairs(api)

        if len(background_compatible_pairs) == 0:
            return

        is_app_auth_client = self.args.auth_type == 'app'
        class_name_prefix = 'AppAuth' if is_app_auth_client else ''
        class_name = '{}ReconnectionHelpers'.format(class_name_prefix)
        return_type = '{}RequestBox'.format(self.args.class_name)

        template = self._jinja_template("SwiftReconnectionHelpers.jinja")
        template.globals['fmt_route_name'] = fmt_route_name
        template.globals['fmt_route_name_namespace'] = fmt_route_name_namespace
        template.globals['fmt_func_namespace'] = fmt_func_namespace
        template.globals['fmt_func'] = fmt_func
        template.globals['fmt_class'] = fmt_class
        template.globals['class_name'] = class_name
        template.globals['return_type'] = return_type

        output_from_parsed_template = template.render(
            background_compatible_namespace_route_pairs=background_compatible_pairs
        )

        self._write_output_in_target_folder(
            output_from_parsed_template, '{}.swift'.format(class_name)
        )

    def _background_compatible_namespace_route_pairs(self, api):
        namespaces = api.namespaces.values()
        background_compatible_routes = []
        for namespace in namespaces:
            for route in namespace.routes:
                is_background_compatible = self._background_session_route_style(route) is not None
                if is_background_compatible and self._valid_route_for_auth_type(route):
                    namespace_route_pair = (namespace, route)
                    background_compatible_routes.append(namespace_route_pair)
        return background_compatible_routes

    def _request_type_signature(self, route):
        route_style = self._background_session_route_style(route)
        request_name = self._request_object_name_for_key(route_style)
        rserializer_type = fmt_serial_type(route.result_data_type)
        eserializer_type = fmt_serial_type(route.error_data_type)

        return '{}<{}, {}>'.format(request_name, rserializer_type, eserializer_type)

    def _jinja_template(self, template_file):
        rsrc_folder = os.path.join(os.path.dirname(__file__), 'swift_rsrc')
        template_loader = jinja2.FileSystemLoader(searchpath=rsrc_folder)
        template_env = jinja2.Environment(loader=template_loader,
                                          trim_blocks=True,
                                          lstrip_blocks=True,
                                          autoescape=False)
        template = template_env.get_template(template_file)
        return template

    def _valid_route_for_auth_type(self, route):
        # jlocke: this is a bit of a hack to match the route grouping style of the Objective-C SDK
        # in app auth situations without blowing up the current user and team auth names

        # route_auth_type can be either a string or a list of strings
        route_auth_type = route.attrs.get('auth')
        client_auth_type = self.args.auth_type

        # if building the app client, only include app auth routes
        # if building the user or team client, include routes of all auth types except
        # app auth exclusive routes

        is_app_auth_only_route = route_auth_type == 'app'
        route_auth_types_include_app = 'app' in route_auth_type

        if client_auth_type == 'app':
            return is_app_auth_only_route or route_auth_types_include_app
        else:
            return not is_app_auth_only_route

    # The objc compatibility wrapper generates a class to wrap each route providing properly
    # typed completion handlers without generics. User and App clients are generated in separate
    # passes, and if the wrapper is already defined for the user client, we must skip generating
    # a second definition of it for the app client.
    def _objc_app_auth_route_wrapper_already_defined(self, route):
        client_auth_type = self.args.auth_type
        is_app_auth_client = client_auth_type == 'app'

        return is_app_auth_client and route.attrs.get('auth') != 'app'

    def _namespace_contains_valid_routes_for_auth_type(self, namespace):
        valid_count = 0
        for route in namespace.routes:
            if self._valid_route_for_auth_type(route):
                valid_count = valid_count + 1

        return valid_count > 0

    def _class_name(self, name):
        class_name = name

        if self.args.auth_type == 'app':
            class_name = class_name + "AppAuth"

        return class_name

    def _get_route_args(self, namespace, route, objc=False, include_defaults=True):
        data_type = route.arg_data_type
        if objc is False:
            arg_type = fmt_type(data_type)
        else:
            arg_type = fmt_objc_type(data_type)

        if is_struct_type(data_type):
            if objc is False:
                arg_list = self._struct_init_args(data_type, namespace=namespace)
            else:
                arg_list = self._objc_init_args(data_type, include_defaults)

            doc_list = [(fmt_var(f.name), self.process_doc(f.doc, self._docf)
                if f.doc else undocumented) for f in data_type.fields if f.doc]
        elif is_union_type(data_type):
            if objc is False:
                arg_list = [(fmt_var(data_type.name), '{}.{}'.format(
                            fmt_class(namespace.name), fmt_class(data_type.name)))]
            else:
                arg_list = [(fmt_var(data_type.name), '{}'.format(fmt_objc_type(data_type)))]

            doc_list = [(fmt_var(data_type.name),
                self.process_doc(data_type.doc, self._docf)
                if data_type.doc else 'The {} union'.format(fmt_class(data_type.name)))]
        else:
            arg_list = [] if is_void_type(data_type) else [('request', arg_type)]
            doc_list = []
        return arg_list, doc_list

    def _route_client_args(self, route):
        route_type = route.attrs.get('style')
        client_args = json.loads(self.args.client_args)

        if route_type not in client_args.keys():
            return [None]
        else:
            return client_args[route_type]

    def _background_session_route_style(self, route):
        route_type = route.attrs.get('style')
        client_args = json.loads(self.args.client_args)

        if route_type not in client_args.keys():
            return None
        else:
            client_arg_styles_for_route_type = map(lambda arg_data: arg_data[0],
                                                   client_args[route_type])
            route_style_if_background_session_compatible = next(
                filter(lambda arg_data: arg_data in ["upload", "download_file"],
                       client_arg_styles_for_route_type))
            return route_style_if_background_session_compatible

    def _route_doc(self, route):
        if route.doc:
            rdoc = self.process_doc(route.doc, self._docf)
        else:
            rdoc = 'The {} route'.format(fmt_func(route.name, route.version))
        return textwrap.fill(rdoc,
                             initial_indent='/// ',
                             subsequent_indent='    /// ',
                             break_long_words=False,
                             break_on_hyphens=False,
                             width=116)

    def _route_param_docs(self, namespace, route, args_data):
        _, doc_list = self._get_route_args(namespace, route)
        if args_data is not None:
            _, type_data_list = tuple(args_data)
            extra_docs = [(type_data[0], type_data[-1]) for type_data in type_data_list]
        else:
            extra_docs = []

        param_docs = []
        for name, doc in doc_list + extra_docs:
            param_doc = '- parameter {}: {}'.format(name, doc if doc is not None else undocumented)
            param_docs.append(textwrap.fill(param_doc,
                             initial_indent='/// ',
                             subsequent_indent='    /// ',
                             break_long_words=False,
                             break_on_hyphens=False,
                             width=116))

        return param_docs

    def _route_returns_doc(self, route):
        rdoc = '- returns: Through the response callback, the caller will receive a '
        rdoc = rdoc + '`{}` object on success'.format(fmt_type(route.result_data_type))
        rdoc = rdoc + ' or a `{}` object on failure.'.format(fmt_type(route.error_data_type))
        return textwrap.fill(rdoc,
                             initial_indent='/// ',
                             subsequent_indent='    /// ',
                             break_long_words=False,
                             break_on_hyphens=False,
                             width=116)

    def _deprecation_warning(self, route):
        if route.deprecated:
            msg = '{} is deprecated.'.format(fmt_func(route.name, route.version))
            if route.deprecated.by:
                msg += ' Use {}.'.format(
                    fmt_func(route.deprecated.by.name, route.deprecated.by.version))
            return '@available(*, unavailable, message:"{}")'.format(msg)

    def _route_args(self, namespace, route, args_data, objc=False, include_defaults=True):
        arg_list, _ = self._get_route_args(namespace, route, objc, include_defaults)
        if args_data is not None:
            _, type_data_list = tuple(args_data)
            extra_args = [tuple(type_data[:-1]) for type_data in type_data_list]
            if objc and not include_defaults:
                extra_args = [arg for arg in extra_args]
            # extra_args = [tuple(type_data[:-1]) for type_data in type_data_list]
            # for name, value, type in extra_args:
            #     if not is_nullable_type(type):
        else:
            extra_args = []

        for name, _, extra_type in extra_args:
            if objc and '=' in extra_type:
                extra_type = extra_type.split(' = ', 1)[0]
            arg_list.append((name, extra_type))

        return self._func_args(arg_list, force_first=False)

    def _request_object_name_for_key(self, key):
        style_to_request = json.loads(self.args.style_to_request)
        return style_to_request[key]

    def _request_object_name(self, route, args_data):
        route_type = route.attrs.get('style')
        if args_data is not None:
            req_obj_key, _ = tuple(args_data)
            return self._request_object_name_for_key(req_obj_key)
        else:
            return self._request_object_name_for_key(route_type)

    def _server_args(self, route):
        args = [(name, name) for name, _ in self._struct_init_args(route.arg_data_type)]
        return self._func_args(args)

    def _return_args(self, route, args_data):
        return_args = [('route', 'route')]

        if not is_void_type(route.arg_data_type):
            return_args += [('serverArgs', 'serverArgs')]

        if args_data is not None:
            _, type_data_list = tuple(args_data)
            extra_args = [tuple(type_data[:-1]) for type_data in type_data_list]
            for name, value, _ in extra_args:
                return_args.append((name, value))

        return self._func_args(return_args, not_init=True)

    def _fmt_route_objc_class(self, namespace, route, args_data):
        name = 'DBX{}{}{}'.format(fmt_class(namespace.name),
                                 fmt_class(route.name),
                                 self._request_object_name(route, args_data))
        if route.version > 1:
            name = '{}V{}'.format(name, route.version)
        return name

    def _route_objc_result_type(self, route, args_data):
        data_type = route.result_data_type
        error_data_type = route.error_data_type
        error_type = 'DBXCallError?'
        if error_data_type.name != 'Void':
            error_type = 'DBX{}{}?, {}'.format(fmt_class(error_data_type.namespace.name),
                                              fmt_class(error_data_type.name),
                                              error_type)

        if data_type.name == 'Void':
            return error_type
        else:
            result_type = '{}?'.format(fmt_objc_type(data_type))

            request_object_name = self._request_object_name(route, args_data)

            if request_object_name == 'DownloadRequestFile':
                result_type = '{}, URL?'.format(result_type)
            elif request_object_name == 'DownloadRequestMemory':
                result_type = '{}, Data?'.format(result_type)

            result_type = '{}, {}'.format(result_type, error_type)
            return result_type

    def _background_compatible_routes_for_objc_requests(self, api):
        namespaces = api.namespaces.values()
        objc_class_to_route = {}
        for namespace in namespaces:
            for route in namespace.routes:
                bg_route_style = self._background_session_route_style(route)
                if bg_route_style is not None and self._valid_route_for_auth_type(route):
                    args_data = self._route_client_args(route)[0]
                    objc_class = self._fmt_route_objc_class(namespace, route, args_data)
                    objc_class_to_route[objc_class] = [namespace, route, args_data]
        return list(objc_class_to_route.values())

    def _routes_for_objc_requests(self, namespace):
        objc_class_to_route = {}
        for route in namespace.routes:
            for args_data in self._route_client_args(route):
                objc_class = self._fmt_route_objc_class(namespace, route, args_data)
                objc_class_to_route[objc_class] = [route, args_data]

        return list(objc_class_to_route.values())

    def _route_objc_func_suffix(self, args_data):
        if args_data is not None:
            _, type_data_list = tuple(args_data)
            if type_data_list:
                extra_args = tuple(type_data_list[-1])
                return extra_args[-2]
            else:
                return ''
        else:
            return ''

    def _objc_result_from_swift(self, result_data_type, swift_var_name='swift'):
        data_type, _ = unwrap_nullable(result_data_type)

        if is_list_type(data_type):
            _, prefix, suffix, list_data_type, list_nullable = mapped_list_info(data_type)

            value = swift_var_name

            if is_user_defined_type(list_data_type):
                objc_type = fmt_objc_type(list_data_type, False)
                factory_func = '.factory' if is_union_type(list_data_type) else ''
                factory_func = '.wrapPreservingSubtypes' if datatype_has_subtypes(data_type) \
                    else factory_func
                value = '{}.map {}{{ {}{}(swift: $0) }}'.format(value,
                                                                prefix,
                                                                objc_type,
                                                                factory_func)
            elif is_numeric_type(list_data_type):
                map_func = 'compactMap' if list_nullable else 'map'
                value = '{}.{} {}{{ $0 as NSNumber{} }}'.format(value,
                                                                map_func,
                                                                prefix,
                                                                '?' if list_nullable else '')
            else:
                return value

            value = '{}{}'.format(value,
                                  suffix)
            return value
        else:
            objc_data_type = fmt_objc_type(data_type)
            factory_func = '.factory' if is_union_type(data_type) else ''
            factory_func = '.wrapPreservingSubtypes' if datatype_has_subtypes(data_type) \
                else factory_func
            return '{}{}(swift: {})'.format(objc_data_type,
                                            factory_func,
                                            swift_var_name)
