import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_quiz_submission")
	frappe.reload_doc("lms", "doctype", "lms_quiz_result")
	results = frappe.get_all("LMS Quiz Result", fields=["name", "result"])

	for result in results:
		value = 1 if result.result == "Right" else 0
		frappe.db.set_value("LMS Quiz Result", result.name, "is_correct", value)
