import frappe
from frappe import _
from lms.lms.utils import get_chapters, can_create_courses, redirect_to_courses_list


def get_context(context):
	context.no_cache = 1
	course_name = frappe.form_dict["course"]

	if not frappe.db.exists("LMS Course", course_name):
		redirect_to_courses_list()

	if not can_create_courses(course_name):
		message = "You do not have permission to access this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	context.course = frappe.db.get_value(
		"LMS Course", course_name, ["name", "title"], as_dict=True
	)
	context.chapters = get_chapters(context.course.name)
