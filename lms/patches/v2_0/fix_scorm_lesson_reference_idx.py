import frappe


def execute():
	scorm_chapters = frappe.get_all("Course Chapter", filters={"is_scorm_package": 1}, pluck="name")

	wrong_idx_lesson_references = frappe.get_all(
		"Lesson Reference",
		filters={"parenttype": "Course Chapter", "parent": ("in", scorm_chapters), "idx": 0},
		pluck="name",
	)

	for lesson_reference in wrong_idx_lesson_references:
		# For SCORM, there is only 1 lesson per chapter, so directly setting 1 is fine
		frappe.db.set_value("Lesson Reference", lesson_reference, "idx", 1)
