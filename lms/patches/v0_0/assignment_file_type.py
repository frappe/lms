import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "course_lesson")
	if not all(frappe.db.has_column("Course Lesson", column) for column in ("file_type", "question")):
		return

	assignment_lessons = frappe.get_all("Course Lesson", {"file_type": ["is", "set"]}, ["name", "question"])

	for lesson in assignment_lessons:
		if not lesson.question:
			frappe.db.set_value("Course Lesson", lesson.name, "file_type", "")
