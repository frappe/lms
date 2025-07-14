import argparse
import os
import sys
from distutils.spawn import find_executable
from importlib.util import find_spec
from pathlib import Path
from typing import List, Optional, NoReturn, Tuple

from traceback_with_variables.print import printing_exc, Format


def run_script(
    path: Path,
    argv: List[str],
    fmt: Format,
) -> int:
    sys.path[0] = str(path.parent)
    sys.argv = [str(path)] + argv
    globals_ = {k: v for k, v in globals().items() if k in {
        '__builtins__', '__loader__',
    }}
    globals_.update({k: None for k in globals().keys() if k in {
        '__cached__', '__package__', '__annotations__', '__spec__',
    }})
    globals_.update({
        '__name__': '__main__',
        '__file__': str(path),
    })

    with printing_exc(
        reraise=False,
        skip_cur_frame=True,
        fmt=fmt,
    ):
        exec(compile(path.read_text(), str(path), 'exec'), globals_, globals_)

        return 0

    return 1  # noqa # actually 'this code is unreachable' is wrong


# - parse args - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


class ParseError(RuntimeError):
    pass


def raising_error_func(message: str) -> NoReturn:
    raise ParseError(message)


def split_argv_to_own_and_script(
    raising_noabbrev_parser: argparse.ArgumentParser,  # with raising .error, no abbrev
    argv: Optional[List[str]] = None,
) -> Tuple[List[str], List[str]]:
    _argv = (argv or sys.argv)[1:]

    for num_args in range(1, len(_argv) + 1):
        try:
            raising_noabbrev_parser.parse_args(_argv[:num_args])

        except ParseError as e:
            if e.args[0].startswith("unrecognized arguments"):
                return _argv[: num_args - 1], _argv[num_args - 1:]

    return _argv, []


def parse_args_and_script_cmd(
    raising_nohelp_noabbrev_parser: argparse.ArgumentParser,  # with raising .error, no help, no abbrev
) -> Tuple[argparse.Namespace, Path, List[str]]:
    # public_parser is only for help messages and complaints, it is always called with wrong arguments or '--help'
    # so it terminates the program and exits with status 1 (or 0 if called with '--help')
    public_parser = argparse.ArgumentParser(parents=[raising_nohelp_noabbrev_parser])
    public_parser.add_argument("script")
    public_parser.add_argument("script-arg", nargs="*")

    own_argv, script_argv = split_argv_to_own_and_script(
        raising_nohelp_noabbrev_parser, sys.argv
    )

    args = argparse.Namespace()  # make linter happy
    try:
        args = raising_nohelp_noabbrev_parser.parse_args(own_argv)
    except ParseError:
        public_parser.parse_args(own_argv)

    if not script_argv:
        public_parser.parse_args(own_argv)

    if script_argv[0].startswith('-'):
        public_parser.parse_args(own_argv + script_argv[:1] + ['some_cmd'])

    if os.path.isfile(script_argv[0]):
        script_path_str = script_argv[0]
    else:
        script_path_str = find_executable(script_argv[0])

    if not script_path_str:
        module_spec = find_spec(script_argv[0])

        if not module_spec:
            public_parser.error(f"No such file or command or module: {script_argv[0]}")

        script_path_str = module_spec.origin

    return args, Path(script_path_str), script_argv[1:]


def parse_args() -> Tuple[argparse.Namespace, Path, List[str]]:
    parser = argparse.ArgumentParser(add_help=False, allow_abbrev=False)
    parser.error = raising_error_func

    Format.add_arguments(parser)

    return parse_args_and_script_cmd(parser)


def main():
    ns, script_path, script_argv = parse_args()

    return run_script(
        path=script_path,
        argv=script_argv,
        fmt=Format.parse(ns)
    )


if __name__ == "__main__":
    sys.exit(main())
