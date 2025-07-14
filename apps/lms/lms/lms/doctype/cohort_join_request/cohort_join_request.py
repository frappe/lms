# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CohortJoinRequest(Document):
	def on_update(self):
		if self.status == "Accepted":
			self.ensure_student()

	def ensure_student(self):
		# case 1 - user is already a member
		q = {
			"doctype": "LMS Enrollment",
			"cohort": self.cohort,
			"subgroup": self.subgroup,
			"member": self.email,
			"member_type": "Student",
		}
		if frappe.db.exists(q):
			return

		# case 2 - user has signed up for this course, possibly not this cohort
		cohort = frappe.get_doc("Cohort", self.cohort)

		q = {
			"doctype": "LMS Enrollment",
			"course": cohort.course,
			"member": self.email,
			"member_type": "Student",
		}
		name = frappe.db.exists(q)
		if name:
			doc = frappe.get_doc("LMS Enrollment", name)
			doc.cohort = self.cohort
			doc.subgroup = self.subgroup
			doc.save(ignore_permissions=True)
		else:
			# case 3 - user has not signed up for this course yet
			data = {
				"doctype": "LMS Enrollment",
				"course": cohort.course,
				"cohort": self.cohort,
				"subgroup": self.subgroup,
				"member": self.email,
				"member_type": "Student",
				"role": "Member",
			}
			doc = frappe.get_doc(data)
			doc.insert(ignore_permissions=True)
