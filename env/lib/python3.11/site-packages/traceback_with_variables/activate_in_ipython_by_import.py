"""
For the simplest usage possible. Jupyter or IPython. Just import it
"""

from traceback_with_variables.color import ColorSchemes
from traceback_with_variables.global_hooks import global_print_exc_in_ipython, is_ipython_global
from traceback_with_variables import core


core.default_format = core.default_format.replace(
    custom_var_printers=[(is_ipython_global, lambda v: None)],
    color_scheme=ColorSchemes.common
)
global_print_exc_in_ipython()
