import frappe


def execute():
	open_to_field_exists = frappe.db.exists("Custom Field", {"dt": "User", "fieldname": "open_to"})

	if not open_to_field_exists:
		return
