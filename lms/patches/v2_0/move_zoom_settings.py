import frappe


def execute():
	create_settings()


def create_settings():
	current_settings = frappe.get_single("Zoom Settings")

	if not current_settings.enable:
		return

	member = current_settings.owner
	member_name = frappe.get_value("User", member, "full_name")

	if not frappe.db.exists(
		"LMS Zoom Settings",
		{
			"account_name": member_name,
		},
	):
		new_settings = frappe.new_doc("LMS Zoom Settings")
		new_settings.enabled = current_settings.enable
		new_settings.account_name = member_name
		new_settings.member = member
		new_settings.member_name = member_name
		new_settings.account_id = current_settings.account_id
		new_settings.client_id = current_settings.client_id
		new_settings.client_secret = current_settings.client_secret
		new_settings.insert()
