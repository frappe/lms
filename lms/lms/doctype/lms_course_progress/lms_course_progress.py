# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.utils import PRIVILEGED_ROLES, recalculate_course_progress


class LMSCourseProgress(Document):
	def validate(self):
		# Guards updates too; before_insert also calls it so member is bound before the
		# insert-time duplicate check below. The call is idempotent.
		self.enforce_member_ownership()

	def before_insert(self):
		self.enforce_member_ownership()
		if (
			self.member
			and self.lesson
			and frappe.db.exists("LMS Course Progress", {"member": self.member, "lesson": self.lesson})
		):
			frappe.throw(
				_("Progress is already recorded for this lesson."),
				frappe.UniqueValidationError,
			)

	def enforce_member_ownership(self):
		"""A non-privileged user may only record progress for their own account.

		Prevents mass-assignment IDOR via the generic REST API, where a student could
		POST a progress row for an arbitrary member and inflate that member's course
		completion. Privileged roles (instructors/moderators, and the server-side
		save_progress flow which runs with ignore_permissions) are exempt.
		"""
		if PRIVILEGED_ROLES & set(frappe.get_roles()):
			return
		if self.member and self.member != frappe.session.user:
			frappe.throw(
				_("You can only record progress for your own account."),
				frappe.PermissionError,
			)
		self.member = frappe.session.user

	def on_update(self):
		recalculate_course_progress(self.course, self.member)

	def after_delete(self):
		recalculate_course_progress(self.course, self.member)
