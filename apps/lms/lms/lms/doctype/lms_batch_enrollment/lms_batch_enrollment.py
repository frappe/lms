# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
import json
from frappe import _
from frappe.model.document import Document
from frappe.email.doctype.email_template.email_template import get_email_template


class LMSBatchEnrollment(Document):
	def after_insert(self):
		send_confirmation_email(self)
		self.add_member_to_live_class()

	def validate(self):
		self.validate_duplicate_members()
		self.validate_course_enrollment()

	def validate_duplicate_members(self):
		if frappe.db.exists(
			"LMS Batch Enrollment",
			{"batch": self.batch, "member": self.member, "name": ["!=", self.name]},
		):
			frappe.throw(_("Member already enrolled in this batch"))

	def validate_course_enrollment(self):
		courses = frappe.get_all(
			"Batch Course", filters={"parent": self.batch}, fields=["course"]
		)

		for course in courses:
			if not frappe.db.exists(
				"LMS Enrollment",
				{"course": course.course, "member": self.member},
			):
				enrollment = frappe.new_doc("LMS Enrollment")
				enrollment.course = course.course
				enrollment.member = self.member
				enrollment.save()

	def add_member_to_live_class(self):
		live_classes = frappe.get_all(
			"LMS Live Class", {"batch_name": self.batch}, ["name", "event"]
		)

		for live_class in live_classes:
			if live_class.event:
				frappe.get_doc(
					{
						"doctype": "Event Participants",
						"reference_doctype": "User",
						"reference_docname": self.member,
						"email": self.member,
						"parent": live_class.event,
						"parenttype": "Event",
						"parentfield": "event_participants",
					}
				).save()


@frappe.whitelist()
def send_confirmation_email(doc):
	if isinstance(doc, str):
		doc = frappe._dict(json.loads(doc))

	if not doc.confirmation_email_sent:
		outgoing_email_account = frappe.get_cached_value(
			"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
		)
		if not doc.confirmation_email_sent and (
			outgoing_email_account or frappe.conf.get("mail_login")
		):
			send_mail(doc)
			frappe.db.set_value(doc.doctype, doc.name, "confirmation_email_sent", 1)


def send_mail(doc):
	batch = frappe.db.get_value(
		"LMS Batch",
		doc.batch,
		[
			"name",
			"title",
			"start_date",
			"start_time",
			"medium",
			"confirmation_email_template",
		],
		as_dict=1,
	)

	subject = _("Enrollment Confirmation for {0}").format(batch.title)
	template = "batch_confirmation"
	custom_template = batch.confirmation_email_template or frappe.db.get_single_value(
		"LMS Settings", "batch_confirmation_template"
	)

	args = {
		"title": batch.title,
		"student_name": doc.member_name,
		"start_time": batch.start_time,
		"start_date": batch.start_date,
		"medium": batch.medium,
		"name": batch.name,
	}

	if custom_template:
		email_template = get_email_template(custom_template, args)
		subject = email_template.get("subject")
		content = email_template.get("message")

	frappe.sendmail(
		recipients=doc.member,
		subject=subject,
		template=template if not custom_template else None,
		content=content if custom_template else None,
		args=args,
		header=[_(batch.title), "green"],
		retry=3,
	)
