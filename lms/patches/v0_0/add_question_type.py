import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_quiz_question")
	questions = frappe.get_all("LMS Quiz Question", pluck="name")

	for question in questions:
		frappe.db.set_value("LMS Quiz Question", question, "type", "Choices")
