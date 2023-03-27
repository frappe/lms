import frappe


def execute():
	questions = frappe.get_all("LMS Quiz Question", pluck="name")

	for question in questions:
		frappe.db.set_value("LMS Quiz Question", question, "type", "Choices")
