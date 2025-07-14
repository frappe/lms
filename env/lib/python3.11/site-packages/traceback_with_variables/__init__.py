"""
Python Traceback (Error Message) Printing Variables

README.md and examples: https://pypi.org/project/traceback-with-variables
"""

from .color import ColorScheme, ColorSchemes, supports_ansi  # noqa
from .core import Format, format_exc, iter_exc_lines, format_cur_tb, iter_cur_tb_lines, default_format  # noqa
from .print import print_exc, print_cur_tb, printing_exc, prints_exc, LoggerAsFile  # noqa
from .global_hooks import global_print_exc, global_print_exc_in_ipython, is_ipython_global  # noqa


__version__ = '2.0.4'
