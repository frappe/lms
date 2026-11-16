# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

SCALE_FIELDS = ("teaching", "roleplay", "voices")


class LMSAlphaFeedback(Document):
	"""What an alpha tester told the Learning team at the end of a skill. Written once per
	assignment through the finish page, read in Desk by the team."""

	def validate(self):
		for field in SCALE_FIELDS:
			value = cint(self.get(field))
			if value and not 1 <= value <= 5:
				frappe.throw(_("{0} is a score from 1 to 5.").format(_(self.meta.get_label(field))))
