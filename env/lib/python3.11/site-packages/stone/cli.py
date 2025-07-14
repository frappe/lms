"""
A command-line interface for StoneAPI.
"""
import importlib.util
import importlib.machinery

import io
import json
import logging
import os
import sys
import traceback

from .cli_helpers import parse_route_attr_filter
from .compiler import (
    BackendException,
    Compiler,
)
from .frontend.exception import InvalidSpec
from .frontend.frontend import specs_to_ir

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression

import argparse

# These backends come by default
_builtin_backends = (
    'obj_c_client',
    'obj_c_types',
    'obj_c_tests',
    'js_client',
    'js_types',
    'tsd_client',
    'tsd_types',
    'python_types',
    'python_type_stubs',
    'python_client',
    'swift_types',
    'swift_client',
)

# The parser for command line arguments
_cmdline_description = (
    'Write your APIs in Stone. Use backends to translate your specification '
    'into a target language or format. The following describes arguments to '
    'the Stone CLI. To specify arguments that are specific to a backend, '
    'add "--" followed by arguments. For example, "stone python_client . '
    'example.spec -- -h".'
)
_cmdline_parser = argparse.ArgumentParser(description=_cmdline_description)
_cmdline_parser.add_argument(
    '-v',
    '--verbose',
    action='count',
    help='Print debugging statements.',
)
_backend_help = (
    'Either the name of a built-in backend or the path to a backend '
    'module. Paths to backend modules must end with a .stoneg.py extension. '
    'The following backends are built-in: ' + ', '.join(_builtin_backends))
_cmdline_parser.add_argument(
    'backend',
    type=str,
    help=_backend_help,
)
_cmdline_parser.add_argument(
    'output',
    type=str,
    help='The folder to save generated files to.',
)
_cmdline_parser.add_argument(
    'spec',
    nargs='*',
    type=str,
    help=('Path to API specifications. Each must have a .stone extension. '
          'If omitted or set to "-", the spec is read from stdin. Multiple '
          'namespaces can be provided over stdin by concatenating multiple '
          'specs together.'),
)
_cmdline_parser.add_argument(
    '--clean-build',
    action='store_true',
    help='The path to the template SDK for the target language.',
)
_cmdline_parser.add_argument(
    '-f',
    '--filter-by-route-attr',
    type=str,
    help=('Removes routes that do not match the expression. The expression '
          'must specify a route attribute on the left-hand side and a value '
          'on the right-hand side. Use quotes for strings and bytes. The only '
          'supported operators are "=" and "!=". For example, if "hide" is a '
          'route attribute, we can use this filter: "hide!=true". You can '
          'combine multiple expressions with "and"/"or" and use parentheses '
          'to enforce precedence.'),
)
_cmdline_parser.add_argument(
    '-r',
    '--route-whitelist-filter',
    type=str,
    help=('Restrict datatype generation to only the routes specified in the whitelist '
          'and their dependencies. Input should be a file containing a JSON dict with '
          'the following form: {"route_whitelist": {}, "datatype_whitelist": {}} '
          'where each object maps namespaces to lists of routes or datatypes to whitelist.'),
)
_cmdline_parser.add_argument(
    '-a',
    '--attribute',
    action='append',
    type=str,
    default=[],
    help=('Route attributes that the backend will have access to and '
          'presumably expose in generated code. Use ":all" to select all '
          'attributes defined in stone_cfg.Route. Note that you can filter '
          '(-f) by attributes that are not listed here.'),
)
_filter_ns_group = _cmdline_parser.add_mutually_exclusive_group()
_filter_ns_group.add_argument(
    '-w',
    '--whitelist-namespace-routes',
    action='append',
    type=str,
    default=[],
    help='If set, backends will only see the specified namespaces as having routes.',
)
_filter_ns_group.add_argument(
    '-b',
    '--blacklist-namespace-routes',
    action='append',
    type=str,
    default=[],
    help='If set, backends will not see any routes for the specified namespaces.',
)

def main():
    """The entry point for the program."""
    if '--' in sys.argv:
        cli_args = sys.argv[1:sys.argv.index('--')]
        backend_args = sys.argv[sys.argv.index('--') + 1:]
    else:
        cli_args = sys.argv[1:]
        backend_args = []

    args = _cmdline_parser.parse_args(cli_args)
    debug = False
    if args.verbose is None:
        logging_level = logging.WARNING
    elif args.verbose == 1:
        logging_level = logging.INFO
    elif args.verbose == 2:
        logging_level = logging.DEBUG
        debug = True
    else:
        print('error: I can only be so garrulous, try -vv.', file=sys.stderr)
        sys.exit(1)

    logging.basicConfig(level=logging_level)

    if args.spec and args.spec[0].startswith('+') and args.spec[0].endswith('.py'):
        # Hack: Special case for defining a spec in Python for testing purposes
        # Use this if you want to define a Stone spec using a Python module.
        # The module should should contain an api variable that references a
        # :class:`stone.api.Api` object.
        try:
            api_module = _load_module(args.api[0])
            api = api_module.api  # pylint: disable=redefined-outer-name
        except ImportError as e:
            print('error: Could not import API description due to:',
                  e, file=sys.stderr)
            sys.exit(1)
    else:
        if args.spec:
            specs = []
            read_from_stdin = False
            for spec_path in args.spec:
                if spec_path == '-':
                    read_from_stdin = True
                elif not spec_path.endswith('.stone'):
                    print("error: Specification '%s' must have a .stone extension."
                          % spec_path,
                          file=sys.stderr)
                    sys.exit(1)
                elif not os.path.exists(spec_path):
                    print("error: Specification '%s' cannot be found." % spec_path,
                          file=sys.stderr)
                    sys.exit(1)
                else:
                    with open(spec_path, encoding='utf-8') as f:
                        specs.append((spec_path, f.read()))
            if read_from_stdin and specs:
                print("error: Do not specify stdin and specification files "
                      "simultaneously.", file=sys.stderr)
                sys.exit(1)

        if not args.spec or read_from_stdin:
            specs = []
            if debug:
                print('Reading specification from stdin.')

            stdin_buffer = sys.stdin.buffer  # pylint: disable=no-member,useless-suppression
            stdin_text = io.TextIOWrapper(stdin_buffer, encoding='utf-8').read()

            parts = stdin_text.split('namespace')
            if len(parts) == 1:
                specs.append(('stdin.1', parts[0]))
            else:
                specs.append(
                    ('stdin.1', '{}namespace{}'.format(parts.pop(0), parts.pop(0))))
                while parts:
                    specs.append(('stdin.%s' % (len(specs) + 1),
                                  'namespace%s' % parts.pop(0)))

        if args.filter_by_route_attr:
            route_filter, route_filter_errors = parse_route_attr_filter(
                args.filter_by_route_attr, debug)
            if route_filter_errors:
                print('Error(s) in route filter:', file=sys.stderr)
                for err in route_filter_errors:
                    print(err, file=sys.stderr)
                sys.exit(1)

        else:
            route_filter = None

        if args.route_whitelist_filter:
            with open(args.route_whitelist_filter, encoding='utf-8') as f:
                route_whitelist_filter = json.loads(f.read())
        else:
            route_whitelist_filter = None

        try:
            # TODO: Needs version
            api = specs_to_ir(specs, debug=debug,
                              route_whitelist_filter=route_whitelist_filter)
        except InvalidSpec as e:
            print('{}:{}: error: {}'.format(e.path, e.lineno, e.msg), file=sys.stderr)
            if debug:
                print('A traceback is included below in case this is a bug in '
                      'Stone.\n', traceback.format_exc(), file=sys.stderr)
            sys.exit(1)
        if api is None:
            print('You must fix the above parsing errors for generation to '
                  'continue.', file=sys.stderr)
            sys.exit(1)

        if args.whitelist_namespace_routes:
            for namespace_name in args.whitelist_namespace_routes:
                if namespace_name not in api.namespaces:
                    print('error: Whitelisted namespace missing from spec: %s' %
                          namespace_name, file=sys.stderr)
                    sys.exit(1)
            for namespace in api.namespaces.values():
                if namespace.name not in args.whitelist_namespace_routes:
                    namespace.routes = []
                    namespace.route_by_name = {}
                    namespace.routes_by_name = {}

        if args.blacklist_namespace_routes:
            for namespace_name in args.blacklist_namespace_routes:
                if namespace_name not in api.namespaces:
                    print('error: Blacklisted namespace missing from spec: %s' %
                          namespace_name, file=sys.stderr)
                    sys.exit(1)
                else:
                    namespace = api.namespaces[namespace_name]
                    namespace.routes = []
                    namespace.route_by_name = {}
                    namespace.routes_by_name = {}

        if route_filter:
            for namespace in api.namespaces.values():
                filtered_routes = []
                for route in namespace.routes:
                    if route_filter.eval(route):
                        filtered_routes.append(route)

                namespace.routes = []
                namespace.route_by_name = {}
                namespace.routes_by_name = {}
                for route in filtered_routes:
                    namespace.add_route(route)

        if args.attribute:
            attrs = set(args.attribute)
            if ':all' in attrs:
                attrs = {field.name for field in api.route_schema.fields}
        else:
            attrs = set()

        for namespace in api.namespaces.values():
            for route in namespace.routes:
                for k in list(route.attrs.keys()):
                    if k not in attrs:
                        del route.attrs[k]

        # Remove attrs that weren't specified from the route schema
        for field in api.route_schema.fields[:]:
            if field.name not in attrs:
                api.route_schema.fields.remove(field)
                del api.route_schema._fields_by_name[field.name]
            else:
                attrs.remove(field.name)

        # Error if specified attr isn't even a field in the route schema
        if attrs:
            attr = attrs.pop()
            print('error: Attribute not defined in stone_cfg.Route: %s' %
                  attr, file=sys.stderr)
            sys.exit(1)

    if args.backend in _builtin_backends:
        backend_module = __import__(
            'stone.backends.%s' % args.backend, fromlist=[''])
    elif not os.path.exists(args.backend):
        print("error: Backend '%s' cannot be found." % args.backend,
              file=sys.stderr)
        sys.exit(1)
    elif not os.path.isfile(args.backend):
        print("error: Backend '%s' must be a file." % args.backend,
              file=sys.stderr)
        sys.exit(1)
    elif not Compiler.is_stone_backend(args.backend):
        print("error: Backend '%s' must have a .stoneg.py extension." %
              args.backend, file=sys.stderr)
        sys.exit(1)
    else:
        # A bit hacky, but we add the folder that the backend is in to our
        # python path to support the case where the backend imports other
        # files in its local directory.
        new_python_path = os.path.dirname(args.backend)
        if new_python_path not in sys.path:
            sys.path.append(new_python_path)
        try:
            backend_module = _load_module(args.backend)
        except Exception:
            print("error: Importing backend '%s' module raised an exception:" %
                  args.backend, file=sys.stderr)
            raise

    c = Compiler(
        api,
        backend_module,
        backend_args,
        args.output,
        clean_build=args.clean_build,
    )
    try:
        c.build()
    except BackendException as e:
        print('%s: error: %s raised an exception:\n%s' %
              (args.backend, e.backend_name, e.traceback),
              file=sys.stderr)
        sys.exit(1)

    if not sys.argv[0].endswith('stone'):
        # If we aren't running from an entry_point, then return api to make it
        # easier to do debugging.
        return api

def _load_module(path):
    file_name = os.path.basename(path)
    module_name = file_name.replace('.', '_')

    if sys.version_info[0] == 3 and sys.version_info[1] >= 5:
        module_specs = importlib.util.spec_from_file_location(module_name, path)
        module = importlib.util.module_from_spec(module_specs)
        module_specs.loader.exec_module(module)
    else:
        loader = importlib.machinery.SourceFileLoader(module_name, path)
        module = loader.load_module()  # pylint: disable=deprecated-method,no-value-for-parameter

    sys.modules[module_name] = module
    logging.info("Loading module: %s", module_name)
    return module

if __name__ == '__main__':
    # Assign api variable for easy debugging from a Python console
    api = main()
