# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.utils import guest_access_allowed


class LMSProgram(Document):
	def validate(self):
		self.validate_program_courses()
		self.validate_program_members()
		self.update_count()

	def validate_program_courses(self):
		courses = [row.course for row in self.program_courses]
		duplicates = {course for course in courses if courses.count(course) > 1}
		if len(duplicates):
			frappe.throw(
				_("Course {0} has already been added to this program.").format(
					frappe.bold(next(iter(duplicates)))
				)
			)

	def validate_program_members(self):
		members = [row.member for row in self.program_members]
		duplicates = {member for member in members if members.count(member) > 1}
		if len(duplicates):
			frappe.throw(
				_("Member {0} has already been added to this program.").format(
					frappe.bold(next(iter(duplicates)))
				)
			)

	def update_count(self):
		course_count = len(self.program_courses)
		member_count = len(self.program_members)

		if self.course_count != course_count:
			self.course_count = course_count

		if self.member_count != member_count:
			self.member_count = member_count


def has_permission(doc, ptype="read", user=None):
	user = user or frappe.session.user

	if user == "Guest" and not guest_access_allowed():
		return False

	roles = frappe.get_roles(user)
	if "Moderator" in roles or "Course Creator" in roles:
		return True

	if ptype not in ("read", "select", "print"):
		return False

	is_enrolled = frappe.db.exists("LMS Program Member", {"parent": doc.name, "member": user})
	if is_enrolled:
		return True

	is_program_published = frappe.db.get_value("LMS Program", doc.name, "published")
	if is_program_published:
		return True

	return False
