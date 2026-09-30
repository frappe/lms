# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.doctype.lms_content_author.lms_content_author import AuthoredDocument
from lms.lms.utils import generate_slug


class LMSProgrammingExercise(AuthoredDocument, Document):
	def autoname(self):
		# See LMSAssignment.autoname. Older exercises keep their hash names.
		if not self.name:
			self.name = generate_slug(self.title, "LMS Programming Exercise", reserved=frozenset({"new"}))

	def validate(self):
		self.validate_test_cases()

	def validate_test_cases(self):
		if not self.test_cases:
			frappe.throw(_("At least one test case is required for the programming exercise."))
