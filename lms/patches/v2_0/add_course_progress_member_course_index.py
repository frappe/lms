import frappe


def execute():
	# on_doctype_update adds it on install; existing sites get it here.
	frappe.db.add_index("LMS Course Progress", ["member", "course"])
