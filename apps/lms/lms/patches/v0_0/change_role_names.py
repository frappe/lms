import frappe


def execute():
	if frappe.db.exists("Role", "Course Instructor"):
		frappe.rename_doc("Role", "Course Instructor", "Instructor")

	if frappe.db.exists("Role", "Course Moderator"):
		frappe.rename_doc("Role", "Course Moderator", "Moderator")
