# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ExerciseSubmission(Document):
	def on_update(self):
		self.update_latest_submission()

	def update_latest_submission(self):
		names = frappe.get_all(
			"Exercise Latest Submission", {"exercise": self.exercise, "member": self.member}
		)
		if names:
			doc = frappe.get_doc("Exercise Latest Submission", names[0])
			doc.latest_submission = self.name
			doc.save(ignore_permissions=True)
		else:
			doc = frappe.get_doc(
				{
					"doctype": "Exercise Latest Submission",
					"exercise": self.exercise,
					"member": self.member,
					"latest_submission": self.name,
				}
			)
			doc.insert(ignore_permissions=True)
