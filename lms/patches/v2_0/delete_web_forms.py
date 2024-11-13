import frappe


def execute():
	frappe.db.delete("Web Form", {"module": "LMS"})
