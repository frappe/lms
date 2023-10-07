import frappe
from lms.lms.utils import has_course_moderator_role


def get_context(context):
	context.no_cache = 1

	filters = {"owner": frappe.session.user}

	if has_course_moderator_role():
		filters = {}

	context.assignments = frappe.get_all(
		"LMS Assignment",
		filters,
		["title", "name", "type", "question"],
	)
