import frappe


def execute():
	show_certifications = frappe.db.get_single_value("LMS Settings", "certified_members")

	if show_certifications:
		frappe.db.set_single_value("LMS Settings", "certifications", 1)
