import frappe

def execute():
	rows = frappe.db.sql("select field from `tabSingles` where doctype='User'", as_dict = True)

	if len(rows):
		frappe.db.sql("delete from `tabSingles` where doctype='User'")
