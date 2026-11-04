import frappe


def execute():
	frappe.db.set_single_value("Portal Settings", "default_portal_home", "/users")
