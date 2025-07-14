import frappe
from lms.lms.md import markdown_to_html


def execute():
	courses = frappe.get_all("LMS Course", fields=["name", "description"])

	for course in courses:
		html = markdown_to_html(course.description)
		frappe.db.set_value("LMS Course", course.name, "description", html)

	frappe.reload_doc("lms", "doctype", "lms_course")
