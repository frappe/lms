import frappe


def execute():
	frappe.db.set_value("Portal Settings", None, "default_portal_home", "/users")
