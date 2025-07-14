import inspect
import logging
import os
import shutil
import traceback

from stone.backend import (
    Backend,
    remove_aliases_from_api,
)


class BackendException(Exception):
    """Saves the traceback of an exception raised by a backend."""

    def __init__(self, backend_name, tb):
        """
        :type backend_name: str
        :type tb: str
        """
        super().__init__()
        self.backend_name = backend_name
        self.traceback = tb


class Compiler:
    """
    Applies a collection of backends found in a single backend module to an
    API specification.
    """

    backend_extension = '.stoneg'

    def __init__(self,
                 api,
                 backend_module,
                 backend_args,
                 build_path,
                 clean_build=False):
        """
        Creates a Compiler.

        :param stone.ir.Api api: A Stone description of the API.
        :param backend_module: Python module that contains at least one
            top-level class definition that descends from a
            :class:`stone.backend.Backend`.
        :param list(str) backend_args: A list of command-line arguments to
            pass to the backend.
        :param str build_path: Location to save compiled sources to. If None,
            source files are compiled into the same directories.
        :param bool clean_build: If True, the build_path is removed before
            source files are compiled into them.
        """
        self._logger = logging.getLogger('stone.compiler')

        self.api = api
        self.backend_module = backend_module
        self.backend_args = backend_args
        self.build_path = build_path

        # Remove existing build directory if it's a clean build
        if clean_build and os.path.exists(self.build_path):
            logging.info('Cleaning existing build directory %s...',
                         self.build_path)
            shutil.rmtree(self.build_path)

    def build(self):
        """Creates outputs. Outputs are files made by a backend."""
        if os.path.exists(self.build_path) and not os.path.isdir(self.build_path):
            self._logger.error('Output path must be a folder if it already exists')
            return
        Compiler._mkdir(self.build_path)
        self._execute_backend_on_spec()

    @staticmethod
    def _mkdir(path):
        """
        Creates a directory at path if it doesn't exist. If it does exist,
        this function does nothing. Note that if path is a file, it will not
        be converted to a directory.
        """
        try:
            os.makedirs(path)
        except OSError as e:
            if e.errno != 17:
                raise

    @classmethod
    def is_stone_backend(cls, path):
        """
        Returns True if the file name matches the format of a stone backend,
        ie. its inner extension of "stoneg". For example: xyz.stoneg.py
        """
        path_without_ext, _ = os.path.splitext(path)
        _, second_ext = os.path.splitext(path_without_ext)
        return second_ext == cls.backend_extension

    def _execute_backend_on_spec(self):
        """Renders a source file into its final form."""

        api_no_aliases_cache = None
        for attr_key in dir(self.backend_module):
            attr_value = getattr(self.backend_module, attr_key)
            if (inspect.isclass(attr_value) and
                    issubclass(attr_value, Backend) and
                    not inspect.isabstract(attr_value)):
                self._logger.info('Running backend: %s', attr_value.__name__)
                backend = attr_value(self.build_path, self.backend_args)

                if backend.preserve_aliases:
                    api = self.api
                else:
                    if not api_no_aliases_cache:
                        api_no_aliases_cache = remove_aliases_from_api(self.api)
                    api = api_no_aliases_cache

                try:
                    backend.generate(api)
                except Exception:
                    # Wrap this exception so that it isn't thought of as a bug
                    # in the stone parser, but rather a bug in the backend.
                    # Remove the last char of the traceback b/c it's a newline.
                    raise BackendException(
                        attr_value.__name__, traceback.format_exc()[:-1])
