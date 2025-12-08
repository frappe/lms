# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class LMSCourseReview(Document):
	def validate(self):
		self.validate_enrollment()
		self.validate_if_already_reviewed()

	def validate_enrollment(self):
		enrollment = frappe.db.exists("LMS Enrollment", {"course": self.course, "member": self.owner})
		if not enrollment:
			frappe.throw(_("You must be enrolled in the course to submit a review"))

	def validate_if_already_reviewed(self):
		if frappe.db.exists("LMS Course Review", {"course": self.course, "owner": self.owner}):
			frappe.throw(_("You have already reviewed this course"))


@frappe.whitelist()
def submit_review(rating, review, course):
	out_of_ratings = frappe.db.get_all(
		"DocField", {"parent": "LMS Course Review", "fieldtype": "Rating"}, ["options"]
	)
	out_of_ratings = (len(out_of_ratings) and out_of_ratings[0].options) or 5
	rating = cint(rating) / out_of_ratings
	frappe.get_doc(
		{"doctype": "LMS Course Review", "rating": rating, "review": review, "course": course}
	).save(ignore_permissions=True)
	return "OK"
