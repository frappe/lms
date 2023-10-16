import frappe
from frappe import _
from lms.lms.utils import has_course_moderator_role, has_course_instructor_role


def get_context(context):
	context.no_cache = 1

	if not has_course_moderator_role() or not has_course_instructor_role():
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
