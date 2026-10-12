# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class LMSCourseReview(Document):
	def validate(self):
		if self.is_new() or self.has_value_changed("course"):
			self.validate_enrollment()
		self.validate_if_already_reviewed()

	def validate_enrollment(self):
		enrollment = frappe.db.exists("LMS Enrollment", {"course": self.course, "member": self.owner})
		if not enrollment:
			frappe.throw(_("You must be enrolled in the course to submit a review"))

	def validate_if_already_reviewed(self):
		filters = {"course": self.course, "owner": self.owner}
		if not self.is_new():
			filters["name"] = ["!=", self.name]

		if frappe.db.exists("LMS Course Review", filters):
			frappe.throw(_("You have already reviewed this course"))
