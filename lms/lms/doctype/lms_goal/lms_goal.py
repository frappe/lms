# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document

from lms.lms.utils import generate_slug


class LMSGoal(Document):
	_DOCTYPE_NAME = "LMS Goal"

	def autoname(self):
		# Named like courses and batches, so /lms/skills/posh-2026 reads as a place.
		if not self.name and self.title:
			self.name = generate_slug(self.title, self._DOCTYPE_NAME)
