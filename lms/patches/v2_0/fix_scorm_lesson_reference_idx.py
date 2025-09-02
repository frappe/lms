import frappe


def execute():
	scorm_lessons = frappe.get_all("Course Lesson", filters={"is_scorm_package": 1}, pluck="name")
	table = frappe.qb.DocType("Lesson Reference")

	q = frappe.qb.from_(table).select(table.name).where(table.lesson.isin(scorm_lessons) & table.idx == 0)
	wrong_idx_lesson_references = q.run(pluck=True)

	for lesson_reference in wrong_idx_lesson_references:
		# For SCORM, there is only 1 lesson per chapter, so directly setting 1 is fine
		frappe.db.set_value("Lesson Reference", lesson_reference, "idx", 1)
