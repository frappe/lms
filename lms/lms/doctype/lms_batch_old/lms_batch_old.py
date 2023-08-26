# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.doctype.lms_enrollment.lms_enrollment import create_membership
from lms.lms.utils import is_mentor


class LMSBatchOld(Document):
	def validate(self):
		pass
		# self.validate_if_mentor()

	def validate_if_mentor(self):
		if not is_mentor(self.course, frappe.session.user):
			course_title = frappe.db.get_value("LMS Course", self.course, "title")
			frappe.throw(_("You are not a mentor of the course {0}").format(course_title))

	def after_insert(self):
		create_membership(batch=self.name, course=self.course, member_type="Mentor")

	def is_member(self, email, member_type=None):
		"""Checks if a person is part of a batch.

		If member_type is specified, checks if the person is a Student/Mentor.
		"""

		filters = {"batch_old": self.name, "member": email}
		if member_type:
			filters["member_type"] = member_type
		return frappe.db.exists("LMS Enrollment", filters)

	def get_membership(self, email):
		"""Returns the membership document of given user."""
		name = frappe.get_value(
			doctype="LMS Enrollment",
			filters={"batch_old": self.name, "member": email},
			fieldname="name",
		)
		return frappe.get_doc("LMS Enrollment", name)

	def get_current_lesson(self, user):
		"""Returns the name of the current lesson for the given user."""
		membership = self.get_membership(user)
		return membership and membership.current_lesson


@frappe.whitelist()
def save_message(message, batch):
	doc = frappe.get_doc(
		{
			"doctype": "LMS Message",
			"batch_old": batch,
			"author": frappe.session.user,
			"message": message,
		}
	)
	doc.save(ignore_permissions=True)


def switch_batch(course_name, email, batch_name):
	"""Switches the user from the current batch of the course to a new batch."""
	membership = frappe.get_last_doc(
		"LMS Enrollment", filters={"course": course_name, "member": email}
	)

	batch = frappe.get_doc("LMS Batch Old", batch_name)
	if not batch:
		raise ValueError(f"Invalid Batch: {batch_name}")

	if batch.course != course_name:
		raise ValueError("Can not switch batches across courses")

	if batch.is_member(email):
		print(f"{email} is already a member of {batch.title}")
		return

	old_batch = frappe.get_doc("LMS Batch Old", membership.batch_old)

	membership.batch_old = batch_name
	membership.save()

	# update exercise submissions
	filters = {"owner": email, "batch_old": old_batch.name}
	for name in frappe.db.get_all("Exercise Submission", filters=filters, pluck="name"):
		doc = frappe.get_doc("Exercise Submission", name)
		print("updating exercise submission", name)
		doc.batch_old = batch_name
		doc.save()
