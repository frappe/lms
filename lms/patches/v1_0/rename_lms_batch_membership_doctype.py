import frappe
from frappe.model.rename_doc import rename_doc


def execute():
	if frappe.db.exists("DocType", "LMS Enrollment"):
		return

	frappe.flags.ignore_route_conflict_validation = True
	rename_doc("DocType", "LMS Batch Membership", "LMS Enrollment")
	frappe.flags.ignore_route_conflict_validation = False

	frappe.reload_doctype("LMS Enrollment", force=True)
