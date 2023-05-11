# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
from frappe.utils.telemetry import capture


class CourseChapter(Document):
	def after_insert(self):
		capture("chapter_created", "lms")
