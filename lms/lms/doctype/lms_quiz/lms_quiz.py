# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cstr, comma_and
from lms.lms.doctype.lms_question.lms_question import validate_correct_answers
from lms.lms.utils import (
	generate_slug,
	has_course_moderator_role,
	has_course_instructor_role,
)


class LMSQuiz(Document):
	def validate(self):
		self.validate_duplicate_questions()

	def validate_duplicate_questions(self):
		questions = [row.question for row in self.questions]
		rows = [i + 1 for i, x in enumerate(questions) if questions.count(x) > 1]
		if len(rows):
			frappe.throw(
				_("Rows {0} have the duplicate questions.").format(frappe.bold(comma_and(rows)))
			)

	def autoname(self):
		if not self.name:
			self.name = generate_slug(self.title, "LMS Quiz")

	def get_last_submission_details(self):
		"""Returns the latest submission for this user."""
		user = frappe.session.user
		if not user or user == "Guest":
			return

		result = frappe.get_all(
			"LMS Quiz Submission",
			fields="*",
			filters={"owner": user, "quiz": self.name},
			order_by="creation desc",
			page_length=1,
		)

		if result:
			return result[0]


@frappe.whitelist()
def quiz_summary(quiz, results):
	score = 0
	results = results and json.loads(results)

	for result in results:
		correct = result["is_correct"][0]
		question_name = frappe.db.get_value(
			"LMS Quiz Question",
			{"parent": quiz, "idx": result["question_index"] + 1},
			["question"],
		)
		result["question_name"] = question_name
		result["question"] = frappe.db.get_value("LMS Question", question_name, "question")

		for point in result["is_correct"]:
			correct = correct and point

		result["is_correct"] = correct
		score += correct
		del result["question_index"]

	submission = frappe.get_doc(
		{
			"doctype": "LMS Quiz Submission",
			"quiz": quiz,
			"result": results,
			"score": score,
			"member": frappe.session.user,
		}
	)
	submission.save(ignore_permissions=True)

	return {
		"score": score,
		"submission": submission.name,
	}


@frappe.whitelist()
def save_quiz(
	quiz_title, max_attempts=1, quiz=None, show_answers=1, show_submission_history=0
):
	if not has_course_moderator_role() or not has_course_instructor_role():
		return

	values = {
		"title": quiz_title,
		"max_attempts": max_attempts,
		"show_answers": show_answers,
		"show_submission_history": show_submission_history,
	}

	if quiz:
		frappe.db.set_value("LMS Quiz", quiz, values)
		return quiz
	else:
		doc = frappe.new_doc("LMS Quiz")
		doc.update(values)
		doc.save(ignore_permissions=True)
		return doc.name


@frappe.whitelist()
def save_question(quiz, values, index):
	values = frappe._dict(json.loads(values))
	for value in values:
		validate_correct_answers(value)

	if values.get("name"):
		doc = frappe.get_doc("LMS Quiz Question", values.get("name"))
	else:
		doc = frappe.new_doc("LMS Quiz Question")

	doc.update(
		{
			"question": values["question"],
			"type": values["type"],
		}
	)

	if not values.get("name"):
		doc.update(
			{
				"parent": quiz,
				"parenttype": "LMS Quiz",
				"parentfield": "questions",
				"idx": index,
			}
		)

	for num in range(1, 5):
		if values.get(f"option_{num}"):
			doc.update(
				{
					f"option_{num}": values[f"option_{num}"],
					f"is_correct_{num}": values[f"is_correct_{num}"],
				}
			)

		if values.get(f"explanation_{num}"):
			doc.update(
				{
					f"explanation_{num}": values[f"explanation_{num}"],
				}
			)

		if values.get(f"possibility_{num}"):
			doc.update(
				{
					f"possibility_{num}": values[f"possibility_{num}"],
				}
			)

		doc.save(ignore_permissions=True)

	return quiz


@frappe.whitelist()
def get_question_details(question):
	if frappe.db.exists("LMS Quiz Question", question):
		fields = ["name", "question", "type"]
		for num in range(1, 5):
			fields.append(f"option_{cstr(num)}")
			fields.append(f"is_correct_{cstr(num)}")
			fields.append(f"explanation_{cstr(num)}")
			fields.append(f"possibility_{cstr(num)}")

		return frappe.db.get_value("LMS Quiz Question", question, fields, as_dict=1)
	return


@frappe.whitelist()
def check_answer(question, type, answers):
	answers = json.loads(answers)
	if type == "Choices":
		return check_choice_answers(question, answers)
	else:
		return check_input_answers(question, answers[0])


def check_choice_answers(question, answers):
	fields = []
	is_correct = []
	for num in range(1, 5):
		fields.append(f"option_{cstr(num)}")
		fields.append(f"is_correct_{cstr(num)}")

	question_details = frappe.db.get_value("LMS Question", question, fields, as_dict=1)

	for num in range(1, 5):
		if question_details[f"option_{num}"] in answers:
			is_correct.append(question_details[f"is_correct_{num}"])
		else:
			is_correct.append(0)

	return is_correct


def check_input_answers(question, answer):
	fields = []
	for num in range(1, 5):
		fields.append(f"possibility_{cstr(num)}")

	question_details = frappe.db.get_value(
		"LMS Quiz Question", question, fields, as_dict=1
	)
	for num in range(1, 5):
		current_possibility = question_details[f"possibility_{num}"]
		if current_possibility and current_possibility.lower() == answer.lower():
			return 1

	return 0


@frappe.whitelist()
def get_user_quizzes():
	filters = {} if has_course_moderator_role() else {"owner": frappe.session.user}
	return frappe.get_all("LMS Quiz", filters=filters, fields=["name", "title"])
