import json

from stone.backends.obj_c import (
    base_file_comment,
    comment_prefix,
    ObjCBaseBackend,
    stone_warning,
    undocumented, )
from stone.backends.obj_c_helpers import (
    fmt_alloc_call,
    fmt_camel_upper,
    fmt_class,
    fmt_class_prefix,
    fmt_func,
    fmt_func_args,
    fmt_func_args_declaration,
    fmt_func_call,
    fmt_import,
    fmt_property_str,
    fmt_route_obj_class,
    fmt_route_func,
    fmt_route_var,
    fmt_routes_class,
    fmt_signature,
    fmt_type,
    fmt_var, )
from stone.ir import (
    is_nullable_type,
    is_struct_type,
    is_union_type,
    is_void_type,
    unwrap_nullable, )

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

import argparse

_cmdline_parser = argparse.ArgumentParser(
    prog='objc-client-backend',
    description=(
        'Generates a ObjC class with an object for each namespace, and in each '
        'namespace object, a method for each route. This class assumes that the '
        'obj_c_types backend was used with the same output directory.'), )
_cmdline_parser.add_argument(
    '-m',
    '--module-name',
    required=True,
    type=str,
    help=(
        'The name of the ObjC module to generate. Please exclude the {.h,.m} '
        'file extension.'), )
_cmdline_parser.add_argument(
    '-c',
    '--class-name',
    required=True,
    type=str,
    help=(
        'The name of the ObjC class that contains an object for each namespace, '
        'and in each namespace object, a method for each route.'))
_cmdline_parser.add_argument(
    '-t',
    '--transport-client-name',
    required=True,
    type=str,
    help='The name of the ObjC class that manages network API calls.', )
_cmdline_parser.add_argument(
    '-w',
    '--auth-type',
    type=str,
    help='The auth type of the client to generate.', )
_cmdline_parser.add_argument(
    '-y',
    '--client-args',
    required=True,
    type=str,
    help='The client-side route arguments to append to each route by style type.', )
_cmdline_parser.add_argument(
    '-z',
    '--style-to-request',
    required=True,
    type=str,
    help='The dict that maps a style type to a ObjC request object name.', )


class ObjCBackend(ObjCBaseBackend):
    """Generates ObjC client base that implements route interfaces."""
    cmdline_parser = _cmdline_parser

    obj_name_to_namespace = {}  # type: typing.Dict[str, int]
    namespace_to_has_routes = {}  # type: typing.Dict[typing.Any, bool]

    def generate(self, api):
        for namespace in api.namespaces.values():
            self.namespace_to_has_routes[namespace] = False
            if namespace.routes:
                for route in namespace.routes:
                    if self._should_generate_route(route):
                        self.namespace_to_has_routes[namespace] = True
                        break

        for namespace in api.namespaces.values():
            for data_type in namespace.linearize_data_types():
                self.obj_name_to_namespace[data_type.name] = fmt_class_prefix(
                    data_type)

        for namespace in api.namespaces.values():
            if namespace.routes and self.namespace_to_has_routes[namespace]:
                import_classes = [
                    fmt_routes_class(namespace.name, self.args.auth_type),
                    fmt_route_obj_class(namespace.name),
                    '{}Protocol'.format(self.args.transport_client_name),
                    'DBStoneBase',
                    'DBRequestErrors',
                ]

                with self.output_to_relative_path('Routes/{}.m'.format(
                        fmt_routes_class(namespace.name,
                                         self.args.auth_type))):
                    self.emit_raw(stone_warning)

                    imports_classes_m = import_classes + \
                        self._get_imports_m(
                            self._get_namespace_route_imports(namespace), [])
                    self._generate_imports_m(imports_classes_m)

                    self._generate_routes_m(namespace)

                with self.output_to_relative_path('Routes/{}.h'.format(
                        fmt_routes_class(namespace.name,
                                         self.args.auth_type))):
                    self.emit_raw(base_file_comment)
                    self.emit('#import <Foundation/Foundation.h>')
                    self.emit()
                    self.emit(fmt_import('DBTasks'))
                    self.emit()
                    import_classes_h = [
                        'DBNilObject',
                    ]
                    import_classes_h = (import_classes_h + self._get_imports_h(
                        self._get_namespace_route_imports(
                            namespace,
                            include_route_args=False,
                            include_route_deep_args=True)))
                    self._generate_imports_h(import_classes_h)
                    self.emit(
                        '@protocol {};'.format(
                            self.args.transport_client_name), )
                    self.emit()
                    self._generate_routes_h(namespace)

        with self.output_to_relative_path(
                'Client/{}.m'.format(self.args.module_name)):
            self._generate_client_m(api)

        with self.output_to_relative_path(
                'Client/{}.h'.format(self.args.module_name)):
            self._generate_client_h(api)

    def _generate_client_m(self, api):
        """Generates client base implementation file. For each namespace, the client will
        have an object field that encapsulates each route in the particular namespace."""
        self.emit_raw(base_file_comment)

        import_classes = [self.args.module_name]
        import_classes += [
            fmt_routes_class(ns.name, self.args.auth_type)
            for ns in api.namespaces.values()
            if ns.routes and self.namespace_to_has_routes[ns]
        ]
        import_classes.append(
            '{}Protocol'.format(self.args.transport_client_name))
        self._generate_imports_m(import_classes)

        with self.block_m(self.args.class_name):
            client_args = fmt_func_args_declaration(
                [('client',
                  'id<{}>'.format(self.args.transport_client_name))])
            with self.block_func(
                    func='initWithTransportClient',
                    args=client_args,
                    return_type='instancetype'):
                self.emit('self = [super init];')

                with self.block_init():
                    self.emit('_transportClient = client;')
                    for namespace in api.namespaces.values():
                        if namespace.routes and self.namespace_to_has_routes[namespace]:
                            base_string = '_{}Routes = [[{} alloc] init:client];'
                            self.emit(
                                base_string.format(
                                    fmt_var(namespace.name),
                                    fmt_routes_class(namespace.name,
                                                     self.args.auth_type)))

    def _generate_client_h(self, api):
        """Generates client base header file. For each namespace, the client will
        have an object field that encapsulates each route in the particular namespace."""
        self.emit_raw(stone_warning)

        self.emit('#import <Foundation/Foundation.h>')

        import_classes = [
            fmt_routes_class(ns.name, self.args.auth_type)
            for ns in api.namespaces.values()
            if ns.routes and self.namespace_to_has_routes[ns]
        ]
        import_classes.append('DBRequestErrors')
        import_classes.append('DBTasks')

        self._generate_imports_m(import_classes)
        self.emit()
        self.emit('NS_ASSUME_NONNULL_BEGIN')
        self.emit()
        self.emit('@protocol {};'.format(self.args.transport_client_name))
        self.emit()

        self.emit(comment_prefix)
        description_str = (
            'Base client object that contains an instance field for '
            'each namespace, each of which contains references to all routes within '
            'that namespace. Fully-implemented API clients will inherit this class.'
        )
        self.emit_wrapped_text(description_str, prefix=comment_prefix)
        self.emit(comment_prefix)
        with self.block_h(
                self.args.class_name,
                protected=[
                    ('transportClient',
                     'id<{}>'.format(self.args.transport_client_name))
                ]):
            self.emit()
            for namespace in api.namespaces.values():
                if namespace.routes and self.namespace_to_has_routes[namespace]:
                    class_doc = 'Routes within the `{}` namespace.'.format(
                        fmt_var(namespace.name))
                    self.emit_wrapped_text(class_doc, prefix=comment_prefix)
                    prop = '{}Routes'.format(fmt_var(namespace.name))
                    typ = '{} *'.format(
                        fmt_routes_class(namespace.name, self.args.auth_type))
                    self.emit(fmt_property_str(prop=prop, typ=typ))
                    self.emit()

            client_args = fmt_func_args_declaration(
                [('client',
                  'id<{}>'.format(self.args.transport_client_name))])

            description_str = (
                'Initializes the `{}` object with a networking client.')
            self.emit_wrapped_text(
                description_str.format(self.args.class_name),
                prefix=comment_prefix)
            init_signature = fmt_signature(
                func='initWithTransportClient',
                args=client_args,
                return_type='instancetype')
            self.emit('{};'.format(init_signature))
            self.emit()

        self.emit()
        self.emit('NS_ASSUME_NONNULL_END')

    def _auth_type_in_route(self, route, desired_auth_type):
        for auth_type in route.attrs.get('auth').split(','):
            if auth_type.strip() == desired_auth_type:
                return True
        return False

    def _route_is_special_noauth_case(self, route):
        return self._auth_type_in_route(route, 'noauth') and self.args.auth_type == 'user'

    def _should_generate_route(self, route):
        return (self._auth_type_in_route(route, self.args.auth_type) or
                self._route_is_special_noauth_case(route))

    def _generate_routes_m(self, namespace):
        """Generates implementation file for namespace object that has as methods
        all routes within the namespace."""
        with self.block_m(
                fmt_routes_class(namespace.name, self.args.auth_type)):
            init_args = fmt_func_args_declaration([(
                'client', 'id<{}>'.format(self.args.transport_client_name))])

            with self.block_func(
                    func='init', args=init_args, return_type='instancetype'):
                self.emit('self = [super init];')
                with self.block_init():
                    self.emit('_client = client;')
            self.emit()
            style_to_request = json.loads(self.args.style_to_request)

            for route in namespace.routes:
                if not self._should_generate_route(route):
                    continue

                route_type = route.attrs.get('style')
                client_args = json.loads(self.args.client_args)

                if route_type in client_args.keys():
                    for args_data in client_args[route_type]:
                        task_type_key, type_data_dict = tuple(args_data)
                        task_type_name = style_to_request[task_type_key]

                        func_suffix = type_data_dict[0]
                        extra_args = [
                            tuple(type_data[:-1])
                            for type_data in type_data_dict[1]
                        ]

                        if (is_struct_type(route.arg_data_type) and
                                self._struct_has_defaults(route.arg_data_type)):
                            route_args, _ = self._get_default_route_args(
                                namespace, route)
                            self._generate_route_m(route, namespace,
                                                   route_args, extra_args,
                                                   task_type_name, func_suffix)

                        route_args, _ = self._get_route_args(namespace, route)
                        self._generate_route_m(route, namespace, route_args,
                                               extra_args, task_type_name,
                                               func_suffix)
                else:
                    task_type_name = style_to_request[route_type]
                    if (is_struct_type(route.arg_data_type) and
                            self._struct_has_defaults(route.arg_data_type)):
                        route_args, _ = self._get_default_route_args(
                            namespace, route)
                        self._generate_route_m(route, namespace, route_args,
                                               [], task_type_name, '')

                    route_args, _ = self._get_route_args(namespace, route)
                    self._generate_route_m(route, namespace, route_args, [],
                                           task_type_name, '')

    def _generate_route_m(self, route, namespace, route_args, extra_args,
                          task_type_name, func_suffix):
        """Generates route method implementation for the given route."""
        user_args = list(route_args)

        transport_args = [
            ('route', 'route'),
            ('arg', 'arg' if not is_void_type(route.arg_data_type) else 'nil'),
        ]

        for name, value, typ in extra_args:
            user_args.append((name, typ))
            transport_args.append((name, value))

        with self.block_func(
                func='{}{}'.format(fmt_route_func(route), func_suffix),
                args=fmt_func_args_declaration(user_args),
                return_type='{} *'.format(task_type_name)):
            self.emit('DBRoute *route = {}.{};'.format(
                fmt_route_obj_class(namespace.name),
                fmt_route_var(namespace.name, route)))
            if is_union_type(route.arg_data_type):
                self.emit('{} *arg = {};'.format(
                    fmt_class_prefix(route.arg_data_type),
                    fmt_var(route.arg_data_type.name)))
            elif not is_void_type(route.arg_data_type):
                init_call = fmt_func_call(
                    caller=fmt_alloc_call(
                        caller=fmt_class_prefix(route.arg_data_type)),
                    callee=self._cstor_name_from_fields_names(route_args),
                    args=fmt_func_args([(f[0], f[0]) for f in route_args]))
                self.emit('{} *arg = {};'.format(
                    fmt_class_prefix(route.arg_data_type), init_call))
            request_call = fmt_func_call(
                caller='self.client',
                callee='request{}'.format(
                    fmt_camel_upper(route.attrs.get('style'))),
                args=fmt_func_args(transport_args))
            self.emit('return {};'.format(request_call))
        self.emit()

    def _generate_routes_h(self, namespace):
        """Generates header file for namespace object that has as methods
        all routes within the namespace."""
        self.emit(comment_prefix)
        self.emit_wrapped_text(
            'Routes for the `{}` namespace'.format(fmt_class(namespace.name)),
            prefix=comment_prefix)
        self.emit(comment_prefix)

        self.emit()
        self.emit('NS_ASSUME_NONNULL_BEGIN')
        self.emit()

        with self.block_h(
                fmt_routes_class(namespace.name, self.args.auth_type)):
            description_str = (
                'An instance of the networking client that each '
                'route will use to submit a request.')
            self.emit_wrapped_text(description_str, prefix=comment_prefix)
            self.emit(
                fmt_property_str(
                    prop='client',
                    typ='id<{}>'.format(
                        self.args.transport_client_name)))
            self.emit()

            routes_obj_args = fmt_func_args_declaration(
                [('client',
                  'id<{}>'.format(self.args.transport_client_name))])

            init_signature = fmt_signature(
                func='init',
                args=routes_obj_args,
                return_type='instancetype')
            description_str = (
                'Initializes the `{}` namespace container object '
                'with a networking client.')
            self.emit_wrapped_text(
                description_str.format(
                    fmt_routes_class(namespace.name, self.args.auth_type)),
                prefix=comment_prefix)
            self.emit('{};'.format(init_signature))
            self.emit()

            style_to_request = json.loads(self.args.style_to_request)

            for route in namespace.routes:
                if not self._should_generate_route(route):
                    continue

                route_type = route.attrs.get('style')
                client_args = json.loads(self.args.client_args)

                if route_type in client_args.keys():
                    for args_data in client_args[route_type]:
                        task_type_key, type_data_dict = tuple(args_data)
                        task_type_name = style_to_request[task_type_key]

                        func_suffix = type_data_dict[0]
                        extra_args = [
                            tuple(type_data[:-1])
                            for type_data in type_data_dict[1]
                        ]
                        extra_docs = [(type_data[0], type_data[-1])
                                      for type_data in type_data_dict[1]]

                        if (is_struct_type(route.arg_data_type) and
                                self._struct_has_defaults(route.arg_data_type)):
                            route_args, doc_list = self._get_default_route_args(
                                namespace, route, tag=True)
                            self._generate_route_signature(
                                route, namespace, route_args, extra_args,
                                doc_list + extra_docs, task_type_name,
                                func_suffix)

                        route_args, doc_list = self._get_route_args(
                            namespace, route, tag=True)
                        self._generate_route_signature(
                            route, namespace, route_args, extra_args,
                            doc_list + extra_docs, task_type_name, func_suffix)
                else:
                    task_type_name = style_to_request[route_type]
                    if (is_struct_type(route.arg_data_type) and
                            self._struct_has_defaults(route.arg_data_type)):
                        route_args, doc_list = self._get_default_route_args(
                            namespace, route, tag=True)
                        self._generate_route_signature(
                            route, namespace, route_args, [], doc_list,
                            task_type_name, '')

                    route_args, doc_list = self._get_route_args(
                        namespace, route, tag=True)
                    self._generate_route_signature(route, namespace,
                                                   route_args, [], doc_list,
                                                   task_type_name, '')
        self.emit()
        self.emit('NS_ASSUME_NONNULL_END')
        self.emit()

    def _generate_route_signature(
            self,
            route,
            namespace,  # pylint: disable=unused-argument
            route_args,
            extra_args,
            doc_list,
            task_type_name,
            func_suffix):
        """Generates route method signature for the given route."""
        for name, _, typ in extra_args:
            route_args.append((name, typ))

        deprecated = 'DEPRECATED: ' if route.deprecated else ''

        func_name = '{}{}'.format(fmt_route_func(route), func_suffix)

        self.emit(comment_prefix)
        if route.doc:
            route_doc = self.process_doc(route.doc, self._docf)
        else:
            route_doc = 'The {} route'.format(func_name)
        self.emit_wrapped_text(
            deprecated + route_doc, prefix=comment_prefix, width=120)
        self.emit(comment_prefix)

        for name, doc in doc_list:
            self.emit_wrapped_text(
                '@param {} {}'.format(name, doc if doc else undocumented),
                prefix=comment_prefix,
                width=120)
        self.emit(comment_prefix)
        output = (
            '@return Through the response callback, the caller will ' +
            'receive a `{}` object on success or a `{}` object on failure.')
        output = output.format(
            fmt_type(route.result_data_type, tag=False, no_ptr=True),
            fmt_type(route.error_data_type, tag=False, no_ptr=True))
        self.emit_wrapped_text(output, prefix=comment_prefix, width=120)
        self.emit(comment_prefix)

        result_type_str = fmt_type(route.result_data_type) if not is_void_type(
            route.result_data_type) else 'DBNilObject *'
        error_type_str = fmt_type(route.error_data_type) if not is_void_type(
            route.error_data_type) else 'DBNilObject *'

        return_type = '{}<{}, {}> *'.format(task_type_name, result_type_str,
                                            error_type_str)

        deprecated = self._get_deprecation_warning(route)
        route_signature = fmt_signature(
            func=func_name,
            args=fmt_func_args_declaration(route_args),
            return_type='{}'.format(return_type))
        self.emit('{}{};'.format(route_signature, deprecated))
        self.emit()

    def _get_deprecation_warning(self, route):
        """Returns a deprecation tag / message, if route is deprecated."""
        result = ''
        if route.deprecated:
            msg = '{} is deprecated.'.format(fmt_route_func(route))
            if route.deprecated.by:
                msg += ' Use {}.'.format(fmt_var(route.deprecated.by.name))
            result = ' __deprecated_msg("{}")'.format(msg)
        return result

    def _get_route_args(self, namespace, route, tag=False):  # pylint: disable=unused-argument
        """Returns a list of name / value string pairs representing the arguments for
        a particular route."""
        data_type, _ = unwrap_nullable(route.arg_data_type)
        if is_struct_type(data_type):
            arg_list = []
            for field in data_type.all_fields:
                arg_list.append((fmt_var(field.name), fmt_type(
                    field.data_type, tag=tag, has_default=field.has_default)))

            doc_list = [(fmt_var(f.name), self.process_doc(f.doc, self._docf))
                        for f in data_type.fields if f.doc]
        elif is_union_type(data_type):
            arg_list = [(fmt_var(data_type.name), fmt_type(
                route.arg_data_type, tag=tag))]

            doc_list = [(fmt_var(data_type.name),
                self.process_doc(data_type.doc,
                    self._docf) if data_type.doc
                else 'The {} union'.format(
                    fmt_class(data_type
                        .name)))]
        else:
            arg_list = []
            doc_list = []

        return arg_list, doc_list

    def _get_default_route_args(
            self,
            namespace,  # pylint: disable=unused-argument
            route,
            tag=False):
        """Returns a list of name / value string pairs representing the default arguments for
        a particular route."""
        data_type, _ = unwrap_nullable(route.arg_data_type)
        if is_struct_type(data_type):
            arg_list = []
            for field in data_type.all_fields:
                if not field.has_default and not is_nullable_type(
                        field.data_type):
                    arg_list.append((fmt_var(field.name), fmt_type(
                        field.data_type, tag=tag)))

            doc_list = ([(fmt_var(f.name), self.process_doc(f.doc, self._docf))
                         for f in data_type.fields
                         if f.doc and not f.has_default and
                         not is_nullable_type(f.data_type)])
        else:
            arg_list = []
            doc_list = []

        return arg_list, doc_list

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
