import frappe
from frappe import _
from lms.lms.utils import can_create_courses


def get_context(context):
	context.no_cache = 1

	if not can_create_courses():
		message = "You do not have permission to access this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	assignment = frappe.form_dict["assignment"]

	if assignment == "new-assignment":
		context.assignment = frappe._dict()
	else:
		context.assignment = frappe.db.get_value(
			"LMS Assignment", assignment, ["title", "name", "type", "question"], as_dict=1
		)
