import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_batch")
	batches = frappe.get_all("LMS Batch", pluck="name")

	for batch in batches:
		frappe.db.set_value("LMS Batch", batch, "Published", 1)
