import frappe


def get_context(context):
	context.user_count = frappe.db.count("User", {"enabled": True})
	context.users = frappe.get_all(
		"User",
		filters={"enabled": True},
		fields=["name", "username", "full_name", "user_image", "headline"],
		start=0,
		page_length=24,
		order_by="creation desc",
	)
