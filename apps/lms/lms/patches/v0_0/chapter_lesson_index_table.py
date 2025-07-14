import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_course")
	frappe.reload_doc("lms", "doctype", "chapter")
	frappe.reload_doc("lms", "doctype", "lesson")
	frappe.reload_doc("lms", "doctype", "lessons")
	frappe.reload_doc("lms", "doctype", "chapters")

	update_chapters()
	update_lessons()


def update_chapters():
	courses = frappe.get_all("LMS Course", pluck="name")
	for course in courses:
		course_details = frappe.get_doc("LMS Course", course)
		chapters = frappe.get_all("Chapter", {"course": course}, ["name"], order_by="index_")
		for chapter in chapters:
			course_details.append("chapters", {"chapter": chapter.name})

		course_details.save()


def update_lessons():
	chapters = frappe.get_all("Chapter", pluck="name")
	for chapter in chapters:
		chapter_details = frappe.get_doc("Chapter", chapter)
		lessons = frappe.get_all("Lesson", {"chapter": chapter}, ["name"], order_by="index_")
		for lesson in lessons:
			chapter_details.append("lessons", {"lesson": lesson.name})

		chapter_details.save()
