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

	quiz = frappe.db.get_value(
		"LMS Quiz",
		quiz_name,
		[
			"name",
			"title",
			"max_attempts",
			"show_answers",
			"show_submission_history",
			"passing_percentage",
		],
		as_dict=True,
	)
	quiz.questions = []
	fields = ["name", "question", "type", "multiple"]
	for num in range(1, 5):
		fields.append(f"option_{num}")
		fields.append(f"is_correct_{num}")
		fields.append(f"explanation_{num}")
		fields.append(f"possibility_{num}")

	questions = frappe.get_all(
		"LMS Quiz Question",
		filters={"parent": quiz.name},
		fields=["question", "marks"],
		order_by="idx",
	)

	for question in questions:
		details = frappe.db.get_value("LMS Question", question.question, fields, as_dict=1)
		details["marks"] = question.marks
		quiz.questions.append(details)
	context.quiz = quiz

	context.all_submissions = frappe.get_all(
		"LMS Quiz Submission",
		{
			"quiz": context.quiz.name,
			"member": frappe.session.user,
		},
		["name", "score", "creation"],
		order_by="creation desc",
	)

	context.no_of_attempts = len(context.all_submissions) or 0

	if submission == "new-submission":
		context.submission = frappe._dict()
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

		context.hide_quiz = (
			context.is_moderator or context.submission.member != frappe.session.user
		)
