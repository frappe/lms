import frappe


def execute():
	if frappe.db.exists("Role", "Class Evaluator"):
		frappe.rename_doc("Role", "Class Evaluator", "Batch Evaluator")
