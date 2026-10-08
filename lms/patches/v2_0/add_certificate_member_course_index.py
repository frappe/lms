import frappe


def execute():
	"""Index the (member, course, batch_name) lookup that save_evaluation_details and
	save_certificate_details lock with FOR UPDATE. Idempotent."""
	for doctype in ("LMS Certificate", "LMS Certificate Evaluation"):
		if frappe.db.table_exists(doctype):
			frappe.db.add_index(doctype, ["member", "course", "batch_name"])
