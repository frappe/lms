import frappe


def execute():
	table = frappe.qb.DocType("Singles")
	q = frappe.qb.from_(table).select(table.field).where(table.doctype == "User")
	rows = q.run()

	if len(rows):
		frappe.db.delete("Singles", {"doctype": "User"})
