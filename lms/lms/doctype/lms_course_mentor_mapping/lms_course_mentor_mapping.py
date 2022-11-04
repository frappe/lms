# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSCourseMentorMapping(Document):
	def validate(self):
		duplicate_mapping = frappe.get_all(
			"LMS Course Mentor Mapping", filters={"course": self.course, "mentor": self.mentor}
		)
		if len(duplicate_mapping):
			frappe.throw(
				_("{0} is already a mentor for course {1}").format(self.mentor_name, self.course)
			)
