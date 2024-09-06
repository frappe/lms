import frappe


def execute():
	frappe.db.delete("Notification", "Certificate Request Creation")
