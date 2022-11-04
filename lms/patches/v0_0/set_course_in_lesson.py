import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "course_lesson")
	lessons = frappe.get_all("Course Lesson", fields=["name", "chapter"])
	for lesson in lessons:
		course = frappe.db.get_value("Course Chapter", lesson.chapter, "course")
		frappe.db.set_value("Course Lesson", lesson.name, "course", course)
