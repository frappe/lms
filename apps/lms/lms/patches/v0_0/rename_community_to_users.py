import frappe


def execute():
	doc = frappe.db.exists("Top Bar Item", {"url": "/community"})
	if doc:
		frappe.db.set_value("Top Bar Item", doc, {"url": "/people", "label": "People"})
