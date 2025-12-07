import frappe


def execute():
	frappe.db.set_single_value("LMS Settings", "programming_exercises", True)
