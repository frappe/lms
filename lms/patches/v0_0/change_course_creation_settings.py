import frappe


def execute():
	value = frappe.db.get_single_value("LMS Settings", "portal_course_creation")
	if value == "Course Instructor Role":
		frappe.db.set_single_value("LMS Settings", "portal_course_creation", "Course Creator Role")
