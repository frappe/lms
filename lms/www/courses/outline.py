import frappe
from frappe import _
from lms.lms.utils import get_chapters, can_create_courses


def get_context(context):
	context.no_cache = 1

	if not can_create_courses():
		message = "You do not have permission to access this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	context.course = frappe.db.get_value(
		"LMS Course", frappe.form_dict["course"], ["name", "title"], as_dict=True
	)
	context.chapters = get_chapters(context.course.name)
