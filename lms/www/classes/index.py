import frappe
from frappe.utils import getdate


def get_context(context):
	context.no_cache = 1

	context.classes = frappe.get_all(
		"LMS Class",
		{"end_date": [">=", getdate()]},
		["name", "title", "start_date", "end_date"],
	)
