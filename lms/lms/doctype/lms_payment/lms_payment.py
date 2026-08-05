# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.email.doctype.email_template.email_template import get_email_template
from frappe.model.document import Document
from frappe.utils import add_days, flt, nowdate
from pypika import functions as fn

from lms.lms.utils import get_lms_route


class LMSPayment(Document):
	pass


UNIQUE_PAYMENT_ID = "unique_payment_id"


def on_doctype_update():
	add_unique_payment_id_constraint()


def add_unique_payment_id_constraint():
	"""One gateway payment belongs to one LMS Payment. Two callbacks for the same
	payment id can be resolved to different rows, which do not lock each other,
	so the constraint is what stops both being credited.

	A site that already carries duplicates (the very bug this prevents) keeps
	its rows and is told, rather than having a migration decide which payment was
	really charged. It gets a plain index for the duplicate lookup, and
	update_payment_record falls back to serializing callbacks until the
	constraint can be added. Runs on every migrate, so cleaning the duplicates up
	is all an operator has to do."""
	if has_unique_payment_id():
		return

	duplicates = get_duplicate_payment_ids()

	if duplicates:
		frappe.log_error(
			title="Duplicate payment ids block a unique constraint on LMS Payment",
			message="More than one LMS Payment row shares a payment id: "
			+ ", ".join(duplicates)
			+ ".\nUntil the duplicates are removed, every payment callback for a course or batch "
			"is serialized to keep one gateway payment from crediting two of them. Keep the "
			"payment that was really charged and the next migrate will add the constraint.",
			defer_insert=True,
		)
		frappe.db.add_index("LMS Payment", ["payment_id"])
		return

	frappe.db.add_unique("LMS Payment", ["payment_id"])


def has_unique_payment_id() -> bool:
	return bool(frappe.db.has_index("tabLMS Payment", UNIQUE_PAYMENT_ID))


def get_duplicate_payment_ids() -> list[str]:
	payment = frappe.qb.DocType("LMS Payment")
	return (
		frappe.qb.from_(payment)
		.select(payment.payment_id)
		.where(payment.payment_id.notnull() & (payment.payment_id != ""))
		.groupby(payment.payment_id)
		.having(fn.Count(payment.name) > 1)
	).run(pluck=True)


def send_payment_reminder():
	outgoing_email_account = frappe.get_cached_value(
		"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
	)

	if not (outgoing_email_account or frappe.conf.get("mail_login")):
		return

	incomplete_payments = frappe.get_all(
		"LMS Payment",
		{
			"payment_received": 0,
			"creation": [">", add_days(nowdate(), -1)],
			"payment_for_document_type": ["in", allowed_payment_types()],
		},
		[
			"name",
			"member",
			"payment_for_document",
			"payment_for_document_type",
			"billing_name",
		],
	)

	for payment in incomplete_payments:
		if has_paid_later(payment):
			continue

		if is_batch_sold_out(payment):
			continue

		send_mail(payment)


def allowed_payment_types():
	send_batch_reminders = frappe.db.get_single_value("LMS Settings", "send_payment_reminders_for_batch")
	send_course_reminders = frappe.db.get_single_value("LMS Settings", "send_payment_reminders_for_course")

	allowed_types = []
	if send_batch_reminders:
		allowed_types.append("LMS Batch")

	if send_course_reminders:
		allowed_types.append("LMS Course")

	return allowed_types


def has_paid_later(payment):
	return frappe.db.exists(
		"LMS Payment",
		{
			"member": payment.member,
			"payment_received": 1,
			"payment_for_document": payment.payment_for_document,
			"payment_for_document_type": payment.payment_for_document_type,
		},
	)


def is_batch_sold_out(payment):
	if payment.payment_for_document_type == "LMS Batch":
		seat_count = frappe.get_cached_value("LMS Batch", payment.payment_for_document, "seat_count")
		number_of_students = frappe.db.count("LMS Batch Enrollment", {"batch": payment.payment_for_document})

		if seat_count <= number_of_students:
			return True

	return False


def send_mail(payment):
	subject = _("Complete Your Enrollment - Don't miss out!")
	template = "payment_reminder"
	custom_template = frappe.db.get_single_value("LMS Settings", "payment_reminder_template")

	args = {
		"billing_name": payment.billing_name,
		"type": payment.payment_for_document_type.split(" ")[-1].lower(),
		"title": frappe.db.get_value(
			payment.payment_for_document_type, payment.payment_for_document, "title"
		),
		"link": get_lms_route(
			f"billing/{payment.payment_for_document_type.split(' ')[-1].lower()}/{payment.payment_for_document}"
		),
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
