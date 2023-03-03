# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class LMSSection(Document):
	def __repr__(self):
		return f"<LMSSection {self.label!r}>"

	def get_exercise(self):
		if self.type == "exercise":
			return frappe.get_doc("LMS Exercise", self.id)

	def get_quiz(self):
		if self.type == "quiz":
			return frappe.get_doc("LMS Quiz", self.id)

	def get_latest_code_for_user(self):
		"""Returns the latest code for the logged in user."""
		if not frappe.session.user or frappe.session.user == "Guest":
			return self.contents
		result = frappe.get_all(
			"Code Revision",
			fields=["code"],
			filters={"author": frappe.session.user, "section": self.name},
			order_by="creation desc",
			page_length=1,
		)
		if result:
			return result[0]["code"]
		else:
			return self.contents
