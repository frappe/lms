import frappe


def execute():
	frappe.db.delete("Web Form", "lesson")
	frappe.db.delete("Web Form", "chapter")
	frappe.db.delete("Web Form", "course")
