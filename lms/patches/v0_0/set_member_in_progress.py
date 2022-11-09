import frappe


def execute():
	progress_records = frappe.get_all("LMS Course Progress", fields=["name", "owner"])

	for progress in progress_records:
		full_name = frappe.db.get_value("User", progress.owner, "full_name")
		frappe.db.set_value("LMS Course Progress", progress.name, "member", progress.owner)
		frappe.db.set_value("LMS Course Progress", progress.name, "member_name", full_name)
