import frappe


def execute():
	if frappe.db.exists("Role", "Class Evaluator") and not frappe.db.exists(
		"Role", "Batch Evaluator"
	):
		frappe.rename_doc("Role", "Class Evaluator", "Batch Evaluator")
