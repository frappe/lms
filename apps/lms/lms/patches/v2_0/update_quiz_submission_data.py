import frappe


def execute():
	set_question_data()
	set_submission_data()


def set_question_data():
	questions = frappe.get_all("LMS Quiz Question", fields=["name", "question"])

	for question in questions:
		question_doc = frappe.db.get_value(
			"LMS Question", question.question, ["question", "type"], as_dict=1
		)
		frappe.db.set_value(
			"LMS Quiz Question",
			question.name,
			{"question_detail": question_doc.question, "type": question_doc.type},
		)


def set_submission_data():
	submissions = frappe.get_all("LMS Quiz Submission", fields=["name", "quiz"])

	for submission in submissions:
		quiz_title = frappe.db.get_value("LMS Quiz", submission.quiz, "title")
		frappe.db.set_value("LMS Quiz Submission", submission.name, "quiz_title", quiz_title)

		questions = frappe.get_all(
			"LMS Quiz Result", filters={"parent": submission.name}, fields=["question_name"]
		)

		for question in questions:
			if question.question_name:
				marks_out_of = frappe.db.get_value(
					"LMS Quiz Question",
					{"parent": submission.quiz, "question": question.question_name},
					["marks"],
				)

				frappe.db.set_value(
					"LMS Quiz Result",
					{"parent": submission.name, "question_name": question.question_name},
					"marks_out_of",
					marks_out_of,
				)
