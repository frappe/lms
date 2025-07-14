"""The widgets provides access to HTML widgets
provided in each frappe module.

Widgets are simple moduler templates that can reused
in multiple places. These are like macros, but accessing
them will be a lot easier.

The widgets will be provided
"""
import frappe
from frappe.utils.jinja import get_jenv

# search path for widgets.
# When {{widgets.SomeWidget()}} is called, it looks for
# widgets/SomeWidgets.html in each of these modules.
MODULES = [
	"lms",
]


def update_website_context(context):
	"""Adds widgets to the context.

	Called from hooks.
	"""
	context.widgets = Widgets()


class Widgets:
	"""The widget collection.

	This is just a placeholder object and returns the appropriate
	widget when accessed using attribute.

	    >>> widgets = Widgets()
	    >>> widgets.HelloWorld(name="World!")
	    '<div>Hello, World!</div>'
	"""

	def __getattr__(self, name):
		widget_globals = {"widgets": self}
		if not name.startswith("__"):
			return Widget(name, widget_globals)
		else:
			raise AttributeError(name)


class Widget:
	"""The Widget class renders a widget.

	Widget is a reusable template defined in widgets/ directory in
	each frappe module.

	    >>> w = Widget("HelloWorld")
	    >>> w(name="World!")
	    '<div>Hello, World!</div>'
	"""

	def __init__(self, name, widget_globals):
		if not widget_globals:
			widget_globals = {}

		self.widget_globals = widget_globals
		self.name = name

	def __call__(self, **kwargs):
		# the widget could be in any of the modules
		paths = [f"{module}/widgets/{self.name}.html" for module in MODULES]
		env = get_jenv()
		kwargs.update(self.widget_globals)
		return env.get_or_select_template(paths).render(kwargs)
