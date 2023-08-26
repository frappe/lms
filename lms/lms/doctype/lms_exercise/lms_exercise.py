# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from lms.lms.utils import get_membership


class LMSExercise(Document):
	def get_user_submission(self):
		"""Returns the latest submission for this user."""
		user = frappe.session.user
		if not user or user == "Guest":
			return

		result = frappe.get_all(
			"Exercise Submission",
			fields="*",
			filters={"owner": user, "exercise": self.name},
			order_by="creation desc",
			page_length=1,
		)

		if result:
			return result[0]

	def submit(self, code):
		"""Submits the given code as solution to exercise."""
		user = frappe.session.user
		if not user or user == "Guest":
			return

		old_submission = self.get_user_submission()
		if old_submission and old_submission.solution == code:
			return old_submission

		member = get_membership(self.course, frappe.session.user)

		doc = frappe.get_doc(
			doctype="Exercise Submission",
			exercise=self.name,
			exercise_title=self.title,
			course=self.course,
			lesson=self.lesson,
			batch=member.batch_old,
			solution=code,
			member=member.name,
		)
		doc.insert(ignore_permissions=True)

		return doc
