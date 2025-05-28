import frappe


def execute():
	live_classes = frappe.get_all("LMS Live Class", ["name", "batch_name"])
	zoom_account = frappe.get_all("LMS Zoom Settings", pluck="name")
	zoom_account = zoom_account[0] if zoom_account else None

	if zoom_account:
		for live_class in live_classes:
			frappe.db.set_value("LMS Batch", live_class.batch_name, "zoom_account", zoom_account)
