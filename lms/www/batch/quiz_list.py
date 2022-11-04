import frappe


def get_context(context):
	context.no_cache = 1
	context.quiz_list = frappe.get_all(
		"LMS Quiz", {"owner": frappe.session.user}, ["name", "title"]
	)
