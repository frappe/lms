import frappe


def execute():
	frappe.reload_doc("community", "doctype", "community_member")
	members = frappe.get_all("Community Member", ["name", "email_preference"])
	for member in members:
		if not member.email_preference:
			frappe.db.set_value(
				"Community Member", member.name, "email_preference", "Email on every Message"
			)
