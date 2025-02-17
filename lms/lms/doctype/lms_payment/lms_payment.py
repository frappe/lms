# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import add_days, nowdate
from frappe.email.doctype.email_template.email_template import get_email_template
from frappe.model.document import Document


class LMSPayment(Document):
	pass


def send_payment_reminder():
	outgoing_email_account = frappe.get_cached_value(
		"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
	)

	if not (outgoing_email_account or frappe.conf.get("mail_login")):
		return

	incomplete_payments = frappe.get_all(
		"LMS Payment",
		{"payment_received": 0, "creation": [">", add_days(nowdate(), -1)]},
		[
			"name",
			"member",
			"payment_for_document",
			"payment_for_document_type",
			"billing_name",
		],
	)

	for payment in incomplete_payments:
		send_mail(payment)


def send_mail(payment):
	subject = _("Complete Your Enrollment - Don't miss out!")
	template = "payment_reminder"
	custom_template = frappe.db.get_single_value(
		"LMS Settings", "payment_reminder_template"
	)

	args = {
		"billing_name": payment.billing_name,
		"type": payment.payment_for_document_type.split(" ")[-1].lower(),
		"title": frappe.db.get_value(
			payment.payment_for_document_type, payment.payment_for_document, "title"
		),
		"link": f"/lms/billing/{ payment.payment_for_document_type.split(' ')[-1].lower() }/{ payment.payment_for_document }",
	}

	if custom_template:
		email_template = get_email_template(custom_template, args)
		subject = email_template.get("subject")
		content = email_template.get("message")

	instructors = frappe.get_all(
		"Course Instructor",
		{
			"parenttype": payment.payment_for_document_type,
			"parent": payment.payment_for_document,
		},
		pluck="instructor",
	)

	frappe.sendmail(
		recipients=payment.member,
		cc=instructors,
		subject=subject,
		template=template if not custom_template else None,
		content=content if custom_template else None,
		args=args,
		header=[subject, "green"],
		retry=3,
	)
