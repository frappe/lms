import frappe
from lms.lms.utils import redirect_to_courses_list, can_create_courses
from frappe import _


def get_context(context):
	context.no_cache = 1

	try:
		course_name = frappe.form_dict["course"]
	except KeyError:
		redirect_to_courses_list()

	if not can_create_courses():
		message = "You do not have permission to access this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	if course_name == "new-course":
		context.course = frappe._dict()
		context.course.edit_mode = True
		context.membership = None
	elif not frappe.db.exists("LMS Course", course_name):
		redirect_to_courses_list()
	else:
		set_course_context(context, course_name)

	context.member = frappe.db.get_value(
		"User", frappe.session.user, ["full_name", "username"], as_dict=True
	)


def set_course_context(context, course_name):
	fields = [
		"name",
		"title",
		"short_introduction",
		"description",
		"image",
		"published",
		"upcoming",
		"disable_self_learning",
		"status",
		"video_link",
		"enable_certification",
		"grant_certificate_after",
		"paid_certificate",
		"price_certificate",
		"currency",
		"max_attempts",
	]
	context.course = frappe.db.get_value("LMS Course", course_name, fields, as_dict=True)
