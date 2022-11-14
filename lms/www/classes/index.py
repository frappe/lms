import frappe

def get_context(context):
	context.no_cache = 1
	context.classes = frappe.get_all("LMS Class", fields=["name", "title", "start_date", "end_date"])
