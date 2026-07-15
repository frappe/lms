# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.desk.doctype.notification_log.notification_log import make_notification_logs
from frappe.model.document import Document
from frappe.utils import validate_url

from lms.lms.utils import PRIVILEGED_ROLES, get_lms_route


class LMSAssignmentSubmission(Document):
	def validate(self):
		self.enforce_member_ownership()
		self.enforce_grading_permission()
		self.validate_duplicates()
		self.validate_url()
		self.validate_status()

	def enforce_grading_permission(self):
		"""Only evaluators/instructors may set the grading fields.

		Prevents a student from grading their own submission (e.g. flipping status from
		"Not Graded" to "Pass" via frappe.client.set_value). On create the grading fields
		are reset to their defaults; on update they are reverted to the stored values.
		"""
		if PRIVILEGED_ROLES & set(frappe.get_roles()):
			return

		# Revert grading fields to their stored values on update, or to safe defaults on
		# create / when no baseline is available (fail closed, never fail open).
		previous = None if self.is_new() else self.get_doc_before_save()
		defaults = {"status": "Not Graded", "comments": None, "evaluator": None}
		for field, default in defaults.items():
			setattr(self, field, previous.get(field) if previous else default)

	def enforce_member_ownership(self):
		if PRIVILEGED_ROLES & set(frappe.get_roles()):
			return
		if self.member and self.member != frappe.session.user:
			frappe.throw(
				_("You can only submit assignments for your own account."),
				frappe.PermissionError,
			)
		self.member = frappe.session.user

	def on_update(self):
		self.validate_private_attachments()

	def validate_duplicates(self):
		if frappe.db.exists(
			"LMS Assignment Submission",
			{"assignment": self.assignment, "member": self.member, "name": ["!=", self.name]},
		):
			title = (
				frappe.db.get_value("Course Lesson", self.lesson, "title")
				if self.lesson
				else frappe.db.get_value("LMS Assignment", self.assignment, "title")
			)
			frappe.throw(_("A submission for {0} by {1} already exists.").format(title, self.member_name))

	def validate_url(self):
		if self.type == "URL" and not validate_url(self.answer, True, ["http", "https"]):
			frappe.throw(_("Please enter a valid URL."))

	def validate_status(self):
		if self.is_new():
			return
		doc_before_save = self.get_doc_before_save()
		if not doc_before_save:
			return
		if doc_before_save.status != self.status or doc_before_save.comments != self.comments:
			self.trigger_update_notification()

	def validate_private_attachments(self):
		if self.type == "Text":
			from bs4 import BeautifulSoup

			soup = BeautifulSoup(self.answer, "html.parser")
			images = soup.find_all("img")
			self.attach_images_to_document(images)

	def attach_images_to_document(self, images):
		for img in images:
			src = img.get("src", "")
			if src.startswith("/private/files/"):
				file_name = frappe.db.get_value("File", {"file_url": src}, "name")
				if file_name:
					frappe.db.set_value(
						"File",
						file_name,
						{
							"attached_to_doctype": self.doctype,
							"attached_to_name": self.name,
							"attached_to_field": "answer",
						},
					)

	def trigger_update_notification(self):
		notification = frappe._dict(
			{
				"subject": _("The instructor has left a comment on your assignment {0}").format(
					frappe.bold(self.assignment_title)
				),
				"email_content": self.comments,
				"document_type": self.doctype,
				"document_name": self.name,
				"from_user": self.evaluator,
				"type": "Alert",
				"link": get_lms_route(f"assignment-submission/{self.assignment}/{self.name}"),
			}
		)
		make_notification_logs(notification, [self.member])
