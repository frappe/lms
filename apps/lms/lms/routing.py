"""Utilities for making custom routing.
"""

from werkzeug.datastructures import ImmutableDict
from werkzeug.routing import BaseConverter, Map


class RegexConverter(BaseConverter):
	"""werkzeug converter that supports custom regular expression.

	The `install_regex_converter` function must be called before using
	regex converter in rules.
	"""

	def __init__(self, map, regex):
		super().__init__(map)
		self.regex = regex


def install_regex_converter():
	"""Installs the RegexConvetor to the default converters supported by werkzeug.

	This allows specifing rules using regex. For example:

	    /profiles/<regex("[a-z0-9]{5,}"):username>
	"""
	default_converters = dict(Map.default_converters, regex=RegexConverter)
	Map.default_converters = ImmutableDict(default_converters)
