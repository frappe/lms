# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class LMSQuizSubmission(Document):
	def before_insert(self):
		if not self.percentage:
			self.set_percentage()

	def set_percentage(self):
		if self.score and self.score_out_of:
			self.percentage = (self.score / self.score_out_of) * 100
