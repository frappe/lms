import frappe
from lms.lms.utils import has_course_moderator_role
from frappe import _


def get_context(context):
	context.no_cache = 1

	if not has_course_moderator_role():
		message = "Only Moderators have access to this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	context.classes = frappe.get_all(
		"LMS Class", fields=["name", "title", "start_date", "end_date"]
	)
