import argparse
import io
import logging
import os
import textwrap
from abc import ABCMeta, abstractmethod
from contextlib import contextmanager

from stone.frontend.ir_generator import doc_ref_re
from stone.ir import (
    is_alias,
    resolve_aliases,
    strip_alias
)

_MYPY = False
if _MYPY:
    from stone.ir import Api
    import typing  # pylint: disable=import-error,useless-suppression

    # Generic Dict key-val types
    DelimTuple = typing.Tuple[str, str]
    K = typing.TypeVar('K')
    V = typing.TypeVar('V')


def remove_aliases_from_api(api):
    # Resolve nested aliases from each namespace first. This way, when we replace an alias with
    # its source later on, it too is alias free.
    for namespace in api.namespaces.values():
        for alias in namespace.aliases:
            # This loops through each alias type chain, resolving each (nested) alias
            # to its underlying type at the end of the chain (see resolve_aliases fn).
            #
            # It will continue until it no longer encounters a type
            # with a data_type attribute - this ensures it resolves aliases
            # that are subtypes of composites e.g. Lists
            curr_type = alias
            while hasattr(curr_type, 'data_type'):
                curr_type.data_type = resolve_aliases(curr_type.data_type)
                curr_type = curr_type.data_type
    # Remove alias layers from each data type
    for namespace in api.namespaces.values():
        for data_type in namespace.data_types:
            for field in data_type.fields:
                strip_alias(field)
        for route in namespace.routes:
            # Strip inner aliases
            strip_alias(route.arg_data_type)
            strip_alias(route.result_data_type)
            strip_alias(route.error_data_type)

            # Strip top-level aliases
            if is_alias(route.arg_data_type):
                route.arg_data_type = route.arg_data_type.data_type
            if is_alias(route.result_data_type):
                route.result_data_type = route.result_data_type.data_type
            if is_alias(route.error_data_type):
                route.error_data_type = route.error_data_type.data_type

        # Clear aliases
        namespace.aliases = []
        namespace.alias_by_name = {}

    return api


class Backend(metaclass=ABCMeta):
    """
    The parent class for all backends. All backends should extend this
    class to be recognized as such.

    You will want to implement the generate() function to do the generation
    that you need.

    Here's roughly what you need to do in generate().
    1. Use the context manager output_to_relative_path() to specify an output file.

        with output_to_relative_path('generated_code.py'):
            ...

    2. Use the family of emit*() functions to write to the output file.

    The target_folder_path attribute is the path to the folder where all
    generated files should be created.
    """

    # Can be overridden by a subclass
    tabs_for_indents = False

    # Can be overridden with an argparse.ArgumentParser object.
    cmdline_parser = None  # type: argparse.ArgumentParser

    # Can be overridden by a subclass. If true, stone.data_type.Alias
    # objects will be present in the API object. If false, aliases are masked
    # by replacing them with duplicate type definitions as the source type.
    # For backwards compatibility with existing backends defaults to false.
    preserve_aliases = False

    def __init__(self, target_folder_path, args):
        # type: (str, typing.Optional[typing.Sequence[str]]) -> None
        """
        Args:
            target_folder_path (str): Path to the folder where all generated
                files should be created.
        """
        self.logger = logging.getLogger('Backend<%s>' %
                                        self.__class__.__name__)
        self.target_folder_path = target_folder_path
        # Output is a list of strings that should be concatenated together for
        # the final output.
        self.output = []  # type: typing.List[typing.Text]
        self.lineno = 1
        self.cur_indent = 0
        self.positional_placeholders = []  # type: typing.List[typing.Text]
        self.named_placeholders = {}  # type: typing.Dict[typing.Text, typing.Text]

        self.args = None  # type: typing.Optional[argparse.Namespace]

        if self.cmdline_parser:
            assert isinstance(self.cmdline_parser, argparse.ArgumentParser), (
                'expected cmdline_parser to be ArgumentParser, got %r' %
                self.cmdline_parser)
            try:
                self.args = self.cmdline_parser.parse_args(args)
            except SystemExit:
                print('Note: This is for backend-specific arguments which '
                      'follow arguments to Stone after a "--" delimiter.')
                raise

    @abstractmethod
    def generate(self, api):
        # type: (Api) -> None
        """
        Subclasses should override this method. It's the entry point that is
        invoked by the rest of the toolchain.

        Args:
            api (stone.api.Api): The API specification.
        """
        raise NotImplementedError

    @contextmanager
    def output_to_relative_path(self, relative_path, mode='wb'):
        # type: (typing.Text, typing.Text) -> typing.Iterator[None]
        """
        Sets up backend so that all emits are directed towards the new file
        created at :param:`relative_path`.

        Clears the output buffer on enter and exit.
        """
        full_path = os.path.join(self.target_folder_path, relative_path)
        directory = os.path.dirname(full_path)
        if not os.path.exists(directory):
            self.logger.info('Creating %s', directory)
            os.makedirs(directory)

        self.logger.info('Generating %s', full_path)
        self.clear_output_buffer()
        yield
        with open(full_path, mode) as f:  # pylint: disable=unspecified-encoding
            f.write(self.output_buffer_to_string().encode('utf-8'))
        self.clear_output_buffer()

    def output_buffer_to_string(self):
        # type: () -> typing.Text
        """Returns the contents of the output buffer as a string."""
        return ''.join(self.output).format(
            *self.positional_placeholders,
            **self.named_placeholders)

    def clear_output_buffer(self):
        self.output = []
        self.positional_placeholders = []
        self.named_placeholders = {}

    def indent_step(self):
        # type: () -> int
        """
        Returns the size of a single indentation step.
        """
        return 1 if self.tabs_for_indents else 4

    @contextmanager
    def indent(self, dent=None):
        # type: (typing.Optional[int]) -> typing.Iterator[None]
        """
        For the duration of the context manager, indentation will be increased
        by dent. Dent is in units of spaces or tabs depending on the value of
        the class variable tabs_for_indents. If dent is None, indentation will
        increase by either four spaces or one tab.
        """
        assert dent is None or dent >= 0, 'dent must be >= 0.'
        if dent is None:
            dent = self.indent_step()
        self.cur_indent += dent
        yield
        self.cur_indent -= dent

    def make_indent(self):
        # type: () -> typing.Text
        """
        Returns a string representing the current indentation. Indents can be
        either spaces or tabs, depending on the value of the class variable
        tabs_for_indents.
        """
        if self.tabs_for_indents:
            return '\t' * self.cur_indent
        else:
            return ' ' * self.cur_indent

    @contextmanager
    def capture_emitted_output(self, output_buffer):
        # type: (io.StringIO) -> typing.Iterator[None]
        original_output = self.output
        self.output = []
        yield
        output_buffer.write(''.join(self.output))
        self.output = original_output

    def emit_raw(self, s):
        # type: (typing.Text) -> None
        """
        Adds the input string to the output buffer. The string must end in a
        newline. It may contain any number of newline characters. No
        indentation is generated.
        """
        self.lineno += s.count('\n')
        self._append_output(s.replace('{', '{{').replace('}', '}}'))
        if len(s) > 0 and s[-1] != '\n':
            raise AssertionError(
                'Input string to emit_raw must end with a newline.')

    def _append_output(self, s):
        # type: (typing.Text) -> None
        self.output.append(s)

    def emit(self, s=''):
        # type: (typing.Text) -> None
        """
        Adds indentation, then the input string, and lastly a newline to the
        output buffer. If s is an empty string (default) then an empty line is
        created with no indentation.
        """
        assert isinstance(s, str), 's must be a unicode string'
        assert '\n' not in s, \
            'String to emit cannot contain newline strings.'
        if s:
            self.emit_raw('{}{}\n'.format(self.make_indent(), s))
        else:
            self.emit_raw('\n')

    def emit_wrapped_text(
            self,
            s,                       # type: typing.Text
            prefix='',               # type: typing.Text
            initial_prefix='',       # type: typing.Text
            subsequent_prefix='',    # type: typing.Text
            width=80,                # type: int
            break_long_words=False,  # type: bool
            break_on_hyphens=False   # type: bool
    ):
        # type: (...) -> None
        """
        Adds the input string to the output buffer with indentation and
        wrapping. The wrapping is performed by the :func:`textwrap.fill` Python
        library function.

        Args:
            s (str): The input string to wrap.
            prefix (str): The string to prepend to *every* line.
            initial_prefix (str): The string to prepend to the first line of
                the wrapped string. Note that the current indentation is
                already added to each line.
            subsequent_prefix (str): The string to prepend to every line after
                the first. Note that the current indentation is already added
                to each line.
            width (int): The target width of each line including indentation
                and text.
            break_long_words (bool): Break words longer than width.  If false,
                those words will not be broken, and some lines might be longer
                than width.
            break_on_hyphens (bool): Allow breaking hyphenated words. If true,
                wrapping will occur preferably on whitespaces and right after
                hyphens part of compound words.
        """
        indent = self.make_indent()
        prefix = indent + prefix

        self.emit_raw(textwrap.fill(s,
                                    initial_indent=prefix + initial_prefix,
                                    subsequent_indent=prefix + subsequent_prefix,
                                    width=width,
                                    break_long_words=break_long_words,
                                    break_on_hyphens=break_on_hyphens,
                                    ) + '\n')

    def emit_placeholder(self, s=''):
        # type: (typing.Text) -> None
        """
        Emits replacements fields that can be used to format the output string later.
        """
        self._append_output('{%s}' % s)

    def add_positional_placeholder(self, s):
        # type: (typing.Text) -> None
        """
        Format replacement fields corresponding to empty calls to emit_placeholder.
        """
        self.positional_placeholders.append(s)

    def add_named_placeholder(self, name, s):
        # type: (typing.Text, typing.Text) -> None
        """
        Format replacement fields corresponding to non-empty calls to emit_placeholder.
        """
        self.named_placeholders[name] = s

    @classmethod
    def process_doc(cls, doc, handler):
        # type: (str, typing.Callable[[str, str], str]) -> typing.Text
        """
        Helper for parsing documentation references in Stone docstrings and
        replacing them with more suitable annotations for the generated output.

        Args:
            doc (str): A Stone docstring.
            handler: A function with the following signature:
                `(tag: str, value: str) -> str`. It will be called for every
                reference found in the docstring with the tag and value parsed
                for you. The returned string will be substituted in the
                docstring in place of the reference.
        """
        assert isinstance(doc, str), \
            'Expected string (unicode in PY2), got %r.' % type(doc)
        cur_index = 0
        parts = []
        for match in doc_ref_re.finditer(doc):
            # Append the part of the doc that is not part of any reference.
            start, end = match.span()
            parts.append(doc[cur_index:start])
            cur_index = end

            # Call the handler with the next tag and value.
            tag = match.group('tag')
            val = match.group('val')
            sub = handler(tag, val)
            parts.append(sub)
        parts.append(doc[cur_index:])
        return ''.join(parts)


class CodeBackend(Backend):
    """
    Extend this instead of :class:`Backend` when generating source code.
    Contains helper functions specific to code generation.
    """
    # pylint: disable=abstract-method

    def filter_out_none_valued_keys(self, d):
        # type: (typing.Dict[K, V]) -> typing.Dict[K, V]
        """Given a dict, returns a new dict with all the same key/values except
        for keys that had values of None."""
        new_d = {}
        for k, v in d.items():
            if v is not None:
                new_d[k] = v
        return new_d

    def generate_multiline_list(
        self,
        items,               # type: typing.List[typing.Text]
        before='',           # type: typing.Text
        after='',            # type: typing.Text
        delim=('(', ')'),    # type: DelimTuple
        compact=True,        # type: bool
        sep=',',             # type: typing.Text
        skip_last_sep=False  # type: bool
    ):
        # type: (...) -> None
        """
        Given a list of items, emits one item per line.

        This is convenient for function prototypes and invocations, as well as
        for instantiating arrays, sets, and maps in some languages.

        TODO(kelkabany): A backend that uses tabs cannot be used with this
            if compact is false.

        Args:
            items (list[str]): Should contain the items to generate a list of.
            before (str): The string to come before the list of items.
            after (str): The string to follow the list of items.
            delim (str, str): The first element is added immediately following
                `before`. The second element is added prior to `after`.
            compact (bool): In compact mode, the enclosing parentheses are on
                the same lines as the first and last list item.
            sep (str): The string that follows each list item when compact is
                true. If compact is false, the separator is omitted for the
                last item.
            skip_last_sep (bool): When compact is false, whether the last line
                should have a trailing separator. Ignored when compact is true.
        """
        assert len(delim) == 2 and isinstance(delim[0], str) and \
            isinstance(delim[1], str), 'delim must be a tuple of two unicode strings.'

        if len(items) == 0:
            self.emit(before + delim[0] + delim[1] + after)
            return
        if len(items) == 1:
            self.emit(before + delim[0] + items[0] + delim[1] + after)
            return

        if compact:
            self.emit(before + delim[0] + items[0] + sep)
            def emit_list(items):
                items = items[1:]
                for (i, item) in enumerate(items):
                    if i == len(items) - 1:
                        self.emit(item + delim[1] + after)
                    else:
                        self.emit(item + sep)
            if before or delim[0]:
                with self.indent(len(before) + len(delim[0])):
                    emit_list(items)
            else:
                emit_list(items)
        else:
            if before or delim[0]:
                self.emit(before + delim[0])
            with self.indent():
                for (i, item) in enumerate(items):
                    if i == len(items) - 1 and skip_last_sep:
                        self.emit(item)
                    else:
                        self.emit(item + sep)
            if delim[1] or after:
                self.emit(delim[1] + after)
            elif delim[1]:
                self.emit(delim[1])

    @contextmanager
    def block(
        self,
        before='',         # type: typing.Text
        after='',          # type: typing.Text
        delim=('{', '}'),  # type: DelimTuple
        dent=None,         # type: typing.Optional[int]
        allman=False       # type: bool
    ):
        # type: (...) -> typing.Iterator[None]
        """
        A context manager that emits configurable lines before and after an
        indented block of text.

        This is convenient for class and function definitions in some
        languages.

        Args:
            before (str): The string to be output in the first line which is
                not indented..
            after (str): The string to be output in the last line which is
                not indented.
            delim (str, str): The first element is added immediately following
                `before` and a space. The second element is added prior to a
                space and then `after`.
            dent (int): The amount to indent the block. If none, the default
                indentation increment is used (four spaces or one tab).
            allman (bool): Indicates whether to use `Allman` style indentation,
                or the default `K&R` style. If there is no `before` string this
                is ignored. For more details about indent styles see
                http://en.wikipedia.org/wiki/Indent_style
        """
        assert len(delim) == 2, 'delim must be a tuple of length 2'
        assert (isinstance(delim[0], (str, type(None))) and
                isinstance(delim[1], (str, type(None)))), (
            'delim must be a tuple of two optional strings.')

        if before and not allman:
            if delim[0] is not None:
                self.emit('{} {}'.format(before, delim[0]))
            else:
                self.emit(before)
        else:
            if before:
                self.emit(before)
            if delim[0] is not None:
                self.emit(delim[0])

        with self.indent(dent):
            yield

        if delim[1] is not None:
            self.emit(delim[1] + after)
        else:
            self.emit(after)
