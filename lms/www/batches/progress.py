import frappe
from lms.lms.utils import (
	has_course_moderator_role,
	has_course_evaluator_role,
	get_upcoming_evals,
)
from frappe import _
from lms.www.utils import get_assessments


def get_context(context):
	context.no_cache = 1

	student = frappe.form_dict["username"]
	batch_name = frappe.form_dict["batchname"]
	context.is_moderator = has_course_moderator_role()
	context.is_evaluator = has_course_evaluator_role()

	context.student = frappe.db.get_value(
		"User",
		{"username": student},
		["first_name", "full_name", "name", "last_active", "username"],
		as_dict=True,
	)
	if (
		not context.is_moderator
		and not context.is_evaluator
		and not context.student.name == frappe.session.user
	):
		raise frappe.PermissionError(_("You don't have permission to access this page."))

	context.batch = frappe.db.get_value(
		"LMS Batch", batch_name, ["name", "title"], as_dict=True
	)

	context.courses = frappe.get_all(
		"Batch Course", {"parent": batch_name}, pluck="course"
	)

	context.assessments = get_assessments(batch_name, context.student.name)
	context.upcoming_evals = get_upcoming_evals(context.student.name, context.courses)
