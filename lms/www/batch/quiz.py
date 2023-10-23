import frappe
from frappe.utils import cstr
from frappe import _
from lms.lms.utils import has_course_instructor_role, has_course_moderator_role


def get_context(context):
	context.no_cache = 1

	if not has_course_moderator_role() or not has_course_instructor_role():
		message = "You do not have permission to access this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))

	quizname = frappe.form_dict["quizname"]
	if quizname == "new-quiz":
		context.quiz = frappe._dict()
	else:

		context.quiz = frappe.db.get_value(
			"LMS Quiz",
			quizname,
			[
				"title",
				"name",
				"max_attempts",
				"passing_percentage",
				"show_answers",
				"show_submission_history",
			],
			as_dict=1,
		)

		fields_arr = ["name", "question", "marks"]
		context.quiz.questions = frappe.get_all(
			"LMS Quiz Question", {"parent": quizname}, fields_arr, order_by="idx"
		)
