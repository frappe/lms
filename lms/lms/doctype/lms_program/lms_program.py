# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSProgram(Document):
	def validate(self):
		self.validate_program_courses()
		self.validate_program_members()

	def on_update(self):
		self.manage_acccess()

	def manage_acccess(self):
		old_doc = self.get_doc_before_save()

		if not old_doc:
			return

		previous_courses = [row.course for row in old_doc.program_courses]
		current_courses = [row.course for row in self.program_courses]

		print("previous_courses", previous_courses)
		print("current_courses", current_courses)

		previous_members = [row.member for row in old_doc.program_members]
		current_members = [row.member for row in self.program_members]

		print("previous_members", previous_members)
		print("current_members", current_members)

		courses_added = [
			course for course in current_courses if course not in previous_courses
		]
		courses_removed = [
			course for course in previous_courses if course not in current_courses
		]

		members_added = [
			member for member in current_members if member not in previous_members
		]
		members_removed = [
			member for member in previous_members if member not in current_members
		]

		print(courses_removed)
		print(members_removed)

		if len(courses_added) > 0:
			self.grant_program_access(current_members, courses_added)

		if len(courses_removed) > 0:
			print(courses_removed)
			self.revoke_program_access(current_members, courses_removed)

		if len(members_added) > 0:
			self.grant_program_access(members_added, current_courses)

		if len(members_removed) > 0:
			print(members_removed)
			self.revoke_program_access(members_removed, current_courses)

	def grant_program_access(self, members, courses):
		for course in courses:
			for member in members:
				enrollment = frappe.db.exists(
					"LMS Enrollment", {"course": course, "member": member}
				)
				if not enrollment:
					enrollment = frappe.new_doc("LMS Enrollment")
					enrollment.course = course
					enrollment.member = member
					enrollment.insert()

	def revoke_program_access(self, members, courses):
		for course in courses:
			print(course)
			for member in members:
				print(member)
				enrollment = frappe.db.exists(
					"LMS Enrollment", {"course": course, "member": member}
				)
				print(enrollment)
				if enrollment:
					frappe.delete_doc("LMS Enrollment", enrollment)

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
