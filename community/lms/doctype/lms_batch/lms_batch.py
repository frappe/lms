# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class LMSBatch(Document):
	def validate(self):
		if not self.code:
			self.generate_code()

	def generate_code(self):
		short_code = frappe.db.get_value("LMS Course", self.course, "short_code")
		course_batches = frappe.get_all("LMS Batch",{"course":self.course})
		self.code = short_code + str(len(course_batches) + 1)
