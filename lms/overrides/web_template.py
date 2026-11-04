import json

import frappe
from frappe.website.doctype.web_template.web_template import WebTemplate

from lms.widgets import Widgets


class CustomWebTemplate(WebTemplate):
	"""Same as WebTemplate.render in frappe, with `widgets` added to the context."""

	def render(self, values=None):
		if not values:
			values = {}
		values = frappe.parse_json(values)
		values.update({"values": values})
		values.update({"widgets": Widgets()})
		template = self.get_template(self.standard)
		# The template is the Web Template record's own, as in frappe core.
		return frappe.render_template(template, values)  # nosemgrep
