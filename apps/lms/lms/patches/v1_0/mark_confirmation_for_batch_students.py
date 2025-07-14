import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "batch_student")
	students = frappe.get_all("Batch Student", pluck="name")

	for student in students:
		frappe.db.set_value("Batch Student", student, "confirmation_email_sent", 1)
