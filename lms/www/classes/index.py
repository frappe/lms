import frappe
from frappe.utils import getdate
from lms.lms.utils import has_course_moderator_role


def get_context(context):
	context.no_cache = 1
	context.is_moderator = has_course_moderator_role()
	context.classes = frappe.get_all(
		"LMS Class",
		{"end_date": [">=", getdate()]},
		["name", "title", "start_date", "end_date"],
	)
