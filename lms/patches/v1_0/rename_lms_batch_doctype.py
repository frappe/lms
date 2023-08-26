import frappe
from frappe.model.rename_doc import rename_doc


def execute():
	if frappe.db.exists("DocType", "LMS Batch Old"):
		return

	frappe.flags.ignore_route_conflict_validation = True
	rename_doc("DocType", "LMS Batch", "LMS Batch Old")
	frappe.flags.ignore_route_conflict_validation = False

	frappe.reload_doctype("LMS Batch Old", force=True)
