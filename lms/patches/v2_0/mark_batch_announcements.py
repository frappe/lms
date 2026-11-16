import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.utils import get_datetime, parse_addr, split_emails

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
	enrollments = get_enrollments()
	for row in sent:
		if not (row.user and can_author_batch(row.reference_name, user=row.user)):
			continue
		if reached_every_student(row, enrollments.get(row.reference_name, [])):
			frappe.db.set_value("Communication", row.name, "lms_batch_announcement", 1, update_modified=False)


def get_enrollments():
	"""(member, enrolled at, removed at) for every batch enrollment there has been.
	A removed one is read back from its Deleted Document: without it, mail to only
	some students would look like a broadcast once the others had left."""
	enrollments = {}
	for row in frappe.get_all("LMS Batch Enrollment", fields=["batch", "member", "creation"]):
		enrollments.setdefault(row.batch, []).append((row.member, row.creation, None))
	removed = frappe.get_all(
		"Deleted Document",
		filters={"deleted_doctype": "LMS Batch Enrollment"},
		fields=["data", "creation"],
	)
	for row in removed:
		data = frappe.parse_json(row.data)
		if data.get("batch") and data.get("member") and data.get("creation"):
			enrolled_at = get_datetime(data.creation)
			enrollments.setdefault(data.batch, []).append((data.member, enrolled_at, row.creation))
	return enrollments


def reached_every_student(mail, enrollments):
	"""Every student the batch had when the mail went out is in its BCC. Staff mail
	to one colleague, or to a few students, is not a broadcast."""
	if not mail.communication_date:
		return False
	sent_at = get_datetime(mail.communication_date)
	students = {
		member.lower()
		for member, enrolled_at, removed_at in enrollments
		if enrolled_at <= sent_at and (removed_at is None or removed_at > sent_at)
	}
	bcc = {parse_addr(address)[1].lower() for address in split_emails(mail.bcc)}
	return bool(students) and students <= bcc
