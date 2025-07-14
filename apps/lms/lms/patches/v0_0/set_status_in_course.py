import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_course")
	courses = frappe.get_all(
		"LMS Course", {"status": ("is", "not set")}, ["name", "published"]
	)
	for course in courses:
		status = "Approved" if course.published else "In Progress"
		frappe.db.set_value("LMS Course", course.name, "status", status)
