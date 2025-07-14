# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CohortMentor(Document):
	def get_subgroup(self):
		return frappe.get_doc("Cohort Subgroup", self.subgroup)

	def get_user(self):
		return frappe.get_doc("User", self.email)
