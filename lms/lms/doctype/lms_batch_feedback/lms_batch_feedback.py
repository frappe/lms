# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.permissions import validate_filed_for_self


class LMSBatchFeedback(Document):
	def validate(self):
		validate_filed_for_self(self, "member")
		self.validate_member_is_enrolled()

	def validate_member_is_enrolled(self):
		if not frappe.db.exists("LMS Batch Enrollment", {"batch": self.batch, "member": self.member}):
			frappe.throw(
				_("{0} is not enrolled in batch {1}, so cannot give feedback on it.").format(
					frappe.bold(self.member), frappe.bold(self.batch)
				),
				frappe.PermissionError,
				title=_("Not enrolled in batch"),
			)
