import frappe
from frappe import _


def get_context(context):
	context.no_cache = 1
	submission = frappe.form_dict["submission"]
	assignment = frappe.form_dict["assignment"]
	context.assignment = frappe.db.get_value(
		"LMS Assignment", assignment, ["title", "name", "type", "question"], as_dict=1
	)

	if submission == "new-submission":
		context.submission = frappe._dict()
	else:
		context.submission = frappe.db.get_value(
			"LMS Assignment Submission",
			submission,
			["name", "assignment_attachment", "comments", "status"],
			as_dict=True,
		)

	if not context.assignment or not context.submission:
		raise frappe.PermissionError(_("Invalid Submission URL"))
