# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from lms.lms.utils import get_course_progress


class LMSCourseProgress(Document):
	def after_delete(self):
		progress = get_course_progress(self.course, self.member)
		membership = frappe.db.get_value(
			"LMS Enrollment",
			{
				"member": self.member,
				"course": self.course,
			},
			"name",
		)
		frappe.db.set_value("LMS Enrollment", membership, "progress", progress)
