import frappe
from frappe import _


def get_context(context):
	course_name = frappe.form_dict.course

	if not course_name:
		raise ValueError(_("Course is required."))

	if frappe.session.user == "Guest":
		raise frappe.PermissionError(_("You are not allowed to access this page."))

	membership = frappe.db.exists(
		"LMS Enrollment", {"member": frappe.session.user, "course": course_name}
	)

	if membership:
		raise frappe.PermissionError(_("You are already enrolled for this course"))

	context.course = frappe.db.get_value(
		"LMS Course", course_name, ["title", "name", "course_price", "currency"], as_dict=True
	)
