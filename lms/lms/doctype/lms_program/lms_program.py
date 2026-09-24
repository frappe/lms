# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.doctype.lms_content_author.lms_content_author import AuthoredDocument
from lms.lms.permissions import has_authored_content_permission
from lms.lms.utils import guest_access_allowed

# The roles this doctype has always treated as its authoring population. The role
# still admits them to the question; `authors` now decides the answer.
PROGRAM_AUTHORING_ROLES = ("Moderator", "Course Creator")

# The types the published-or-enrolled rule answers. Everything else -- `email` and
# `share` included -- is an authoring ask, exactly as before this change.
PROGRAM_READ_PTYPES = ("read", "select", "print")


class LMSProgram(AuthoredDocument, Document):
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


def has_authoring_role(user: str) -> bool:
	"""Whether `user` belongs to the population that authors programs at all.

	Read by both halves of this module: two copies of a role test is one that drifts.
	"""
	roles = frappe.get_roles(user)
	return any(role in roles for role in PROGRAM_AUTHORING_ROLES)


def has_program_authoring_permission(doc, ptype: str | None, user: str) -> bool:
	"""The authoring half, narrowed to the people named on the program.

	frappe takes one has_permission hook per doctype and this one already holds the
	read rule below, so the shared predicate is composed here rather than registered.
	The role test runs first on purpose: routing a bare System Manager into the shared
	predicate would readmit it through is_site_administrator, which is a widening.
	"""
	if not has_authoring_role(user):
		return False
	return has_authored_content_permission(doc, ptype, user)


def has_permission(doc, ptype="read", user=None):
	user = user or frappe.session.user

	if user == "Guest" and not guest_access_allowed():
		return False

	if ptype not in PROGRAM_READ_PTYPES:
		return has_program_authoring_permission(doc, ptype, user)

	if has_authoring_role(user):
		return True

	is_enrolled = frappe.db.exists("LMS Program Member", {"parent": doc.name, "member": user})
	if is_enrolled:
		return True

	is_program_published = frappe.db.get_value("LMS Program", doc.name, "published")
	if is_program_published:
		return True

	return False


def get_permission_query_conditions(user=None):
	"""List-read counterpart of has_permission above: published, or a member."""
	user = user or frappe.session.user
	if user == "Administrator":
		return ""

	if user == "Guest" and not guest_access_allowed():
		return "1 = 0"

	if has_authoring_role(user):
		return ""

	escaped = frappe.db.escape(user)
	return f"""(`tabLMS Program`.published = 1 or `tabLMS Program`.name in (
		select parent from `tabLMS Program Member` where member = {escaped}
	))"""
