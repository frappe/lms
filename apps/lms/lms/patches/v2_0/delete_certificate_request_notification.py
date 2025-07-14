import frappe


def execute():
	delete_notification("Certificate Request Creation")
	delete_notification("Certificate Request Reminder")


def delete_notification(notification_name):
	if frappe.db.exists("Notification", notification_name):
		frappe.db.delete("Notification", notification_name)
