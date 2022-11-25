import frappe


def get_context(context):
	context.no_cache = 1
	name = frappe.form_dict["subname"]

	context.submission = frappe.db.get_value(
		"LMS Quiz Submission", name, ["name", "quiz"], as_dict=1
	)

	questions = frappe.get_all(
		"LMS Quiz Result", {"parent": name}, ["question", "is_correct", "answer"]
	)

	for question in questions:
		options = frappe.db.get_value(
			"LMS Quiz Question",
			{"question": question.question},
			["option_1", "option_2", "option_3", "option_4"],
			as_dict=1,
		)
		question.update(options)
		question.answer = question.answer.split(",")

	context.questions = questions
