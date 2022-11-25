import frappe
from lms.lms.utils import has_course_moderator_role
from frappe import _


def get_context(context):
	context.no_cache = 1
	assignment = frappe.form_dict["assignment"]

	context.assignment = frappe.db.get_value(
		"Lesson Assignment",
		assignment,
		[
			"assignment",
			"comments",
			"status",
			"name",
			"member",
			"member_name",
			"course",
			"lesson",
		],
		as_dict=True,
	)
	context.is_moderator = has_course_moderator_role()

	if (
		not has_course_moderator_role()
		and not frappe.session.user == context.assignment.member
	):
		message = "You don't have the permissions to access this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))
