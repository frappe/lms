import frappe
from lms.lms.utils import can_create_courses, has_course_moderator_role
from frappe import _


def get_context(context):
	context.no_cache = 1

	if not can_create_courses():
		message = "You do not have permission to access this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	filters = {} if has_course_moderator_role() else {"owner": frappe.session.user}
	context.quiz_list = frappe.get_all("LMS Quiz", filters, ["name", "title"])
