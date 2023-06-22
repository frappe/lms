import frappe
from lms.lms.utils import has_course_moderator_role
from frappe import _


def get_context(context):
	context.no_cache = 1

	if frappe.session.user == "Guest":
		raise frappe.PermissionError(_("You don't have permission to access this page."))

	context.is_moderator = has_course_moderator_role()
	submission = frappe.form_dict["submission"]
	quiz_name = frappe.form_dict["quiz"]

	context.quiz = frappe.get_doc("LMS Quiz", quiz_name)

	if submission == "new-submission":
		context.submission = frappe._dict()
		context.no_of_attempts = 0
		context.hide_quiz = False
	else:
		context.submission = frappe.db.get_value(
			"LMS Quiz Submission",
			submission,
			["name", "score", "member", "member_name"],
			as_dict=True,
		)

		if not context.is_moderator and frappe.session.user != context.submission.member:
			raise frappe.PermissionError(_("You don't have permission to access this page."))

		if not context.quiz or not context.submission:
			raise frappe.PermissionError(_("Invalid Submission URL"))

		context.all_submissions = frappe.get_all(
			"LMS Quiz Submission",
			{
				"quiz": context.quiz.name,
				"member": context.submission.member,
			},
			["name", "score", "creation"],
			order_by="creation desc",
		)

		context.no_of_attempts = len(context.all_submissions) or 0
		context.hide_quiz = (
			context.is_moderator and context.submission.member != frappe.session.user
		)
