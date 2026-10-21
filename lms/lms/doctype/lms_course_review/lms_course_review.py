# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

from lms.lms.html_sanitizer import to_plain_text


class LMSCourseReview(Document):
	def validate(self):
		# A review is plain text: the app shows it as text, and the testimonials web
		# template prints it into a page.
		self.review = to_plain_text(self.review)
		self.validate_enrollment()
		self.validate_if_already_reviewed()

	def validate_enrollment(self):
		enrollment = frappe.db.exists("LMS Enrollment", {"course": self.course, "member": self.owner})
		if not enrollment:
			frappe.throw(_("You must be enrolled in the course to submit a review"))

	def validate_if_already_reviewed(self):
		if frappe.db.exists("LMS Course Review", {"course": self.course, "owner": self.owner}):
			frappe.throw(_("You have already reviewed this course"))
