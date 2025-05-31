import frappe


def execute():
	show_certified_members = frappe.db.get_single_value(
		"LMS Settings", "certified_participants"
	)

	if show_certified_members:
		frappe.db.set_single_value("LMS Settings", "certified_members", 1)
