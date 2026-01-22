import frappe


def execute():
	open_to_field_exists = frappe.db.exists("Custom Field", {"dt": "User", "fieldname": "open_to"})

	if not open_to_field_exists:
		return

	open_to_opportunities = frappe.get_all("User", {"open_to": "Opportunities"}, ["name"])
	for user in open_to_opportunities:
		frappe.db.set_value("User", user.name, "open_to", "Work")
