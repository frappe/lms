import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "course_chapter")
	frappe.reload_doc("lms", "doctype", "course_lesson")
	frappe.reload_doc("lms", "doctype", "chapter_reference")
	frappe.reload_doc("lms", "doctype", "lesson_reference")
	frappe.reload_doc("lms", "doctype", "exercise")
	frappe.reload_doc("lms", "doctype", "exercise_submission")
	frappe.reload_doc("lms", "doctype", "lms_batch_membership")
	frappe.reload_doc("lms", "doctype", "lms_course")
	frappe.reload_doc("lms", "doctype", "lms_course_progress")
	frappe.reload_doc("lms", "doctype", "lms_quiz")

	if not frappe.db.count("Course Chapter"):
		move_chapters()

	if not frappe.db.count("Course Lesson"):
		move_lessons()

	change_parent_for_lesson_reference()


def move_chapters():
	docs = frappe.get_all("Chapter", fields=["*"])
	for doc in docs:
		if frappe.db.exists("LMS Course", doc.course):
			name = doc.name
			doc.update({"doctype": "Course Chapter"})
			del doc["name"]
			new_doc = frappe.get_doc(doc)
			new_doc.save()
			frappe.rename_doc("Course Chapter", new_doc.name, name)


def move_lessons():
	docs = frappe.get_all("Lesson", fields=["*"])
	for doc in docs:
		if frappe.db.exists("Chapter", doc.chapter):
			name = doc.name
			doc.update({"doctype": "Course Lesson"})
			del doc["name"]
			new_doc = frappe.get_doc(doc)
			new_doc.save()
			frappe.rename_doc("Course Lesson", new_doc.name, name)


def change_parent_for_lesson_reference():
	lesson_reference = frappe.get_all("Lesson Reference", fields=["name", "parent"])
	for reference in lesson_reference:
		frappe.db.set_value(
			"Lesson Reference", reference.name, "parenttype", "Course Chapter"
		)
