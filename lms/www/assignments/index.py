import frappe


def get_context(context):
	context.no_cache = 1
	context.assignments = frappe.get_all(
		"LMS Assignment",
		{"owner": frappe.session.user},
		["title", "name", "type", "question"],
	)
