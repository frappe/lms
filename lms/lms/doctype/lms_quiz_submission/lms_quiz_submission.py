# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import cint
from frappe import _
from frappe.desk.doctype.notification_log.notification_log import make_notification_logs


class LMSQuizSubmission(Document):
	def validate(self):
		self.validate_marks()
		self.set_percentage()

	def on_update(self):
		self.notify_member()

	def validate_marks(self):
		self.score = 0
		for row in self.result:
			if cint(row.marks) > cint(row.marks_out_of):
				frappe.throw(
					_(
						"Marks for question number {0} cannot be greater than the marks allotted for that question."
					).format(row.idx)
				)
			else:
				self.score += cint(row.marks)

	def set_percentage(self):
		if self.score and self.score_out_of:
			self.percentage = (self.score / self.score_out_of) * 100

	def notify_member(self):
		if self.score != 0 and self.has_value_changed("score"):
			notification = frappe._dict(
				{
					"subject": _("You have got a score of {0} for the quiz {1}").format(
						self.score, self.quiz_title
					),
					"email_content": _(
						"There has been an update on your submission. You have got a score of {0} for the quiz {1}"
					).format(self.score, self.quiz_title),
					"document_type": self.doctype,
					"document_name": self.name,
					"for_user": self.member,
					"from_user": "Administrator",
					"type": "Alert",
					"link": "",
				}
			)

			make_notification_logs(notification, [self.member])
