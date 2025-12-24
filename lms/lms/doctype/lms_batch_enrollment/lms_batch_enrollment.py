# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.email.doctype.email_template.email_template import get_email_template
from frappe.model.document import Document


class LMSBatchEnrollment(Document):
	def after_insert(self):
		send_confirmation_email(self)
		self.add_member_to_live_class()

	def validate(self):
		self.validate_owner()
		self.validate_duplicate_members()
		self.validate_payment()
		self.validate_self_enrollment()
		self.validate_seat_availability()
		self.validate_course_enrollment()

	def validate_owner(self):
		if self.owner == self.member:
			return

		roles = frappe.get_roles(self.owner)
		if "Moderator" not in roles and "Batch Evaluator" not in roles:
			frappe.throw(_("You must be a Moderator or Batch Evaluator to enroll users in a batch."))

	def validate_payment(self):
		paid_batch = frappe.db.get_value("LMS Batch", self.batch, "paid_batch")
		if paid_batch:
			payment = frappe.db.exists(
				"LMS Payment",
				{
					"payment_for_document_type": "LMS Batch",
					"payment_for_document": self.batch,
					"member": self.member,
					"payment_received": True,
				},
			)
			if not payment:
				frappe.throw(_("Payment is required to enroll in this batch."))
			else:
				self.payment = payment

	def validate_self_enrollment(self):
		batch_details = frappe.db.get_value(
			"LMS Batch", self.batch, ["allow_self_enrollment", "paid_batch"], as_dict=True
		)
		if batch_details.paid_batch:
			return
		if not batch_details.allow_self_enrollment and not self.is_admin():
			frappe.throw(_("Enrollment in this batch is restricted. Please contact the Administrator."))

	def is_admin(self):
		roles = frappe.get_roles(frappe.session.user)
		return "Course Creator" in roles or "Moderator" in roles or "Batch Evaluator" in roles

	def validate_duplicate_members(self):
		if frappe.db.exists(
			"LMS Batch Enrollment",
			{"batch": self.batch, "member": self.member, "name": ["!=", self.name]},
		):
			frappe.throw(_("Member already enrolled in this batch"))

	def validate_seat_availability(self):
		seat_count = frappe.db.get_value("LMS Batch", self.batch, "seat_count")
		enrolled_count = frappe.db.count("LMS Batch Enrollment", {"batch": self.batch})
		if seat_count and enrolled_count >= seat_count:
			frappe.throw(_("There are no seats available in this batch."))

	def validate_course_enrollment(self):
		courses = frappe.get_all("Batch Course", filters={"parent": self.batch}, fields=["course"])

		for course in courses:
			if not frappe.db.exists(
				"LMS Enrollment",
				{"course": course.course, "member": self.member},
			):
				enrollment = frappe.new_doc("LMS Enrollment")
				enrollment.course = course.course
				enrollment.member = self.member
				enrollment.enrollment_from_batch = self.batch
				enrollment.save()

	def add_member_to_live_class(self):
		live_classes = frappe.get_all("LMS Live Class", {"batch_name": self.batch}, ["name", "event"])

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
		if not doc.confirmation_email_sent and (outgoing_email_account or frappe.conf.get("mail_login")):
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
