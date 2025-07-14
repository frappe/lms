"""
For the simplest usage possible. Just import it
"""

from traceback_with_variables.global_hooks import global_print_exc
from traceback_with_variables import core


core.default_format = core.default_format.replace(
    custom_var_printers=[((lambda n, t, fn, is_global: is_global), lambda v: None)]
)
global_print_exc()
