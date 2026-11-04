# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.permissions import can_review_submission, is_site_administrator
from lms.lms.utils import has_moderator_role


class LMSProgrammingExerciseSubmission(Document):
	def validate(self):
		self.validate_grading_source()

	def validate_grading_source(self):
		"""A learner's row is written only by create_programming_exercise_submission,
		which runs the code on the server; staff who review the row may still edit it."""
		if self.flags.graded_on_server:
			return
		user = frappe.session.user
		if self.is_new():
			allowed = is_site_administrator(user) or has_moderator_role(user)
		else:
			allowed = can_review_submission("LMS Programming Exercise", self.exercise, self.member, user=user)
		if not allowed:
			frappe.throw(
				_("Save your code from the exercise page, which runs it and records the result."),
				frappe.PermissionError,
				title=_("Submission not saved"),
			)
