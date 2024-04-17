import frappe


def execute():
	courses = frappe.get_all(
		"LMS Course", filters={"published": 1}, fields=["name", "creation"]
	)

	for course in courses:
		frappe.db.set_value("LMS Course", course.name, "published_on", course.creation)
