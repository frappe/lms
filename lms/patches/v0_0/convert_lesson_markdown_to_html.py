import frappe
from lms.lms.md import markdown_to_html


def execute():
	lessons = frappe.get_all("Course Lesson", fields=["name", "body"])

	for lesson in lessons:
		html = markdown_to_html(lesson.body)
		frappe.db.set_value("Course Lesson", lesson.name, "body", html)

	frappe.reload_doc("lms", "doctype", "course_lesson")
