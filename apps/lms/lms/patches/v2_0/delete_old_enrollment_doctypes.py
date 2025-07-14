import frappe


def execute():
	frappe.delete_doc("DocType", "Batch Student")
	frappe.delete_doc("Notification", "Payment Completion Reminder")
