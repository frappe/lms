import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.utils import parse_addr, split_emails

from lms.install import load_install_data


def execute():
	"""Announcements are now told apart from other batch mail by a flag. Mail sent
	before it existed counts as one when the batch's staff sent it to every student
	of the batch in BCC, which is how each announcement went out. Mail that cannot
	be shown to be one stays unmarked, so students do not see it."""
	fields = load_install_data("custom_field.json")
	create_custom_fields({"Communication": fields["Communication"]}, update=False)

	from lms.lms.permissions import can_author_batch

	sent = frappe.get_all(
		"Communication",
		filters={
			"reference_doctype": "LMS Batch",
			"communication_type": "Communication",
			"communication_medium": "Email",
			"sent_or_received": "Sent",
			"bcc": ["is", "set"],
			"lms_batch_announcement": 0,
		},
		fields=["name", "reference_name", "user", "bcc", "communication_date"],
	)
	for row in sent:
		if not (row.user and can_author_batch(row.reference_name, user=row.user)):
			continue
		if reached_every_student(row):
			frappe.db.set_value("Communication", row.name, "lms_batch_announcement", 1, update_modified=False)


def reached_every_student(mail):
	"""Every student the batch had when the mail went out is in its BCC. Staff mail
	to one colleague, or to a few students, is not a broadcast."""
	if not mail.communication_date:
		return False
	bcc = {parse_addr(address)[1].lower() for address in split_emails(mail.bcc)}
	enrolled = frappe.get_all(
		"LMS Batch Enrollment",
		filters={"batch": mail.reference_name, "creation": ["<=", mail.communication_date]},
		pluck="member",
	)
	return bool(enrolled) and {member.lower() for member in enrolled} <= bcc
