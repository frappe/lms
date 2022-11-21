import frappe
from lms.lms.utils import has_course_moderator_role
from frappe import _


def get_context(context):
	context.no_cache = 1
	assignment = frappe.form_dict["assignment"]

	if not has_course_moderator_role():
		message = "Only Moderators have access to this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	context.assignment = frappe.db.get_value(
		"Lesson Assignment",
		assignment,
		["assignment", "comments", "status", "name", "member_name", "course", "lesson"],
		as_dict=True,
	)
