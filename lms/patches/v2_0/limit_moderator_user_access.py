import frappe


def execute():
	"""Moderators read the user list; adding a member goes through
	lms.lms.api.add_member. Take back write, create and delete on User that
	earlier installs granted them."""
	rows = frappe.get_all("Custom DocPerm", {"parent": "User", "role": "Moderator"}, pluck="name")
	for name in rows:
		frappe.db.set_value("Custom DocPerm", name, {"write": 0, "create": 0, "delete": 0})
	if rows:
		frappe.clear_cache(doctype="User")
