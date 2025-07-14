import frappe


def execute():
	frappe.db.set_value("Portal Settings", None, "default_portal_home", "/courses")
	frappe.db.set_value("Role", "Course Instructor", "home_page", "")
	frappe.db.set_value("Role", "Course Moderator", "home_page", "")
