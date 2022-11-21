import frappe


def execute():
	frappe.rename_doc("Role", "Course Instructor", "Instructor")
	frappe.rename_doc("Role", "Course Moderator", "Moderator")
