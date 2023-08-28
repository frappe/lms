import frappe
from frappe.model.rename_doc import rename_doc


def execute():
	if frappe.db.exists("DocField", {"fieldname": "students", "parent": "LMS Batch"}):
		return

	rename_lms_class()
	rename_class_student()
	rename_class_courses()


def rename_lms_class():
	frappe.flags.ignore_route_conflict_validation = True
	rename_doc("DocType", "LMS Class", "LMS Batch")
	frappe.flags.ignore_route_conflict_validation = False
	frappe.reload_doctype("LMS Batch", force=True)


def rename_class_student():
	frappe.flags.ignore_route_conflict_validation = True
	rename_doc("DocType", "Class Student", "Batch Student")
	frappe.flags.ignore_route_conflict_validation = False
	frappe.reload_doctype("Batch Student", force=True)


def rename_class_courses():
	frappe.flags.ignore_route_conflict_validation = True
	rename_doc("DocType", "Class Course", "Batch Course")
	frappe.flags.ignore_route_conflict_validation = False
	frappe.reload_doctype("Batch Course", force=True)
