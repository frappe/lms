import frappe
from lms.lms.utils import has_course_moderator_role, has_course_evaluator_role
from frappe import _
from lms.www.utils import get_assessments


def get_context(context):
	context.no_cache = 1

	student = frappe.form_dict["username"]
	class_name = frappe.form_dict["classname"]
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

	context.class_info = frappe.db.get_value(
		"LMS Class", class_name, ["name"], as_dict=True
	)

	context.courses = frappe.get_all(
		"Class Course", {"parent": class_name}, pluck="course"
	)

	context.assessments = get_assessments(class_name, context.student.name)

	upcoming_evals = frappe.get_all(
		"LMS Certificate Request",
		{
			"member": context.student.name,
			"course": ["in", context.courses],
			"date": [">=", frappe.utils.nowdate()],
		},
		["date", "start_time", "course", "evaluator", "google_meet_link"],
		order_by="date",
	)

	for evals in upcoming_evals:
		evals.course_title = frappe.db.get_value("LMS Course", evals.course, "title")
		evals.evaluator_name = frappe.db.get_value("User", evals.evaluator, "full_name")

	context.upcoming_evals = upcoming_evals
