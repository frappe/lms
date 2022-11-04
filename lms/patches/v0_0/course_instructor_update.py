import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_course")
	courses = frappe.get_all("LMS Course", fields=["name", "owner"])
	for course in courses:
		frappe.db.set_value("LMS Course", course.name, "instructor", course.owner)
