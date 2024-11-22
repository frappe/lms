# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSProgram(Document):
	def validate(self):
		self.validate_program_courses()
		self.validate_program_members()

	def validate_program_courses(self):
		courses = [row.course for row in self.program_courses]
		duplicates = {course for course in courses if courses.count(course) > 1}
		if len(duplicates):
			frappe.throw(
				_("Course {0} has already been added to this batch.").format(
					frappe.bold(next(iter(duplicates)))
				)
			)

	def validate_program_members(self):
		members = [row.member for row in self.program_members]
		duplicates = {member for member in members if members.count(member) > 1}
		if len(duplicates):
			frappe.throw(
				_("Member {0} has already been added to this batch.").format(
					frappe.bold(next(iter(duplicates)))
				)
			)
