import frappe


def execute():
	looking_for_job = frappe.get_all("User", {"looking_for_job": 1}, ["name"])

	for user in looking_for_job:
		frappe.db.set_value("User", user.name, "open_to", "Opportunities")

	frappe.db.delete("Custom Field", {"dt": "User", "fieldname": "looking_for_job"})
