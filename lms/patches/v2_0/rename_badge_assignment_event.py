import frappe


def execute():
	badge_with_auto_assign = frappe.get_all("LMS Badge", filters={"event": "Auto Assign"}, fields=["name"])
	for badge in badge_with_auto_assign:
		frappe.db.set_value("LMS Badge", badge.name, "event", "Manual Assignment")
