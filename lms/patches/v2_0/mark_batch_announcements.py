import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from lms.install import load_install_data


def execute():
	"""Announcements are now told apart from other batch mail by a flag. Mail sent
	before it existed counts as one when the batch's staff sent it to the students
	in BCC, which is how every announcement went out; one-to-one mail has none."""
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
		fields=["name", "reference_name", "user"],
	)
	for row in sent:
		if row.user and can_author_batch(row.reference_name, user=row.user):
			frappe.db.set_value("Communication", row.name, "lms_batch_announcement", 1, update_modified=False)
