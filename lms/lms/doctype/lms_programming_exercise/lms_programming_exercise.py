# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSProgrammingExercise(Document):
	def validate(self):
		self.validate_test_cases()

	def validate_test_cases(self):
		if not self.test_cases:
			frappe.throw(_("At least one test case is required for the programming exercise."))
