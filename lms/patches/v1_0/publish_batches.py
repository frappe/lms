import frappe


def execute():
	batches = frappe.get_all("LMS Batch", pluck="name")

	for batch in batches:
		frappe.db.set_value("LMS Batch", batch, "Published", 1)
