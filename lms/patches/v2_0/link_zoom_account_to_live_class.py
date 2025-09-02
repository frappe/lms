import frappe


def execute():
	live_classes = frappe.get_all("LMS Live Class", pluck="name")
	zoom_account = frappe.get_all("LMS Zoom Settings", pluck="name")
	zoom_account = zoom_account[0] if zoom_account else None

	if zoom_account:
		for live_class in live_classes:
			frappe.db.set_value(
				"LMS Live Class",
				live_class,
				"zoom_account",
				zoom_account,
			)
