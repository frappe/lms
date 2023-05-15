# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cstr

from lms.lms.utils import generate_slug


class LMSQuiz(Document):
	def autoname(self):
		if not self.name:
			self.name = generate_slug(self.title, "LMS Quiz")

	def validate(self):
		self.validate_correct_answers()

	def validate_correct_answers(self):
		for question in self.questions:
			if question.type == "Choices":
				self.validate_correct_options(question)
			else:
				self.validate_possible_answer(question)

	def validate_correct_options(self, question):
		correct_options = self.get_correct_options(question)

		if len(correct_options) > 1:
			question.multiple = 1

		if not len(correct_options):
			frappe.throw(
				_("At least one option must be correct for this question: {0}").format(
					frappe.bold(question.question)
				)
			)

	def validate_possible_answer(self, question):
		possible_answers_fields = [
			"possibility_1",
			"possibility_2",
			"possibility_3",
			"possibility_4",
		]
		possible_answers = list(filter(lambda x: question.get(x), possible_answers_fields))

		if not len(possible_answers):
			frappe.throw(
				_("Add at least one possible answer for this question: {0}").format(
					frappe.bold(question.question)
				)
			)

	def get_correct_options(self, question):
		correct_option_fields = [
			"is_correct_1",
			"is_correct_2",
			"is_correct_3",
			"is_correct_4",
		]
		return list(filter(lambda x: question.get(x) == 1, correct_option_fields))

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


def update_lesson_info(doc, method):
	if doc.quiz_id:
		frappe.db.set_value(
			"LMS Quiz", doc.quiz_id, {"lesson": doc.name, "course": doc.course}
		)


@frappe.whitelist()
def quiz_summary(quiz, results):
	score = 0
	results = results and json.loads(results)

	for result in results:
		correct = result["is_correct"][0]
		result["question"] = frappe.db.get_value(
			"LMS Quiz Question", {"parent": quiz, "idx": result["question_index"]}, ["question"]
		)

		for point in result["is_correct"]:
			correct = correct and point

		result["is_correct"] = correct
		score += correct
		del result["question_index"]

	frappe.get_doc(
		{
			"doctype": "LMS Quiz Submission",
			"quiz": quiz,
			"result": results,
			"score": score,
			"member": frappe.session.user,
		}
	).save(ignore_permissions=True)

	return score


@frappe.whitelist()
def save_quiz(quiz_title, questions, quiz):
	if quiz:
		doc = frappe.get_doc("LMS Quiz", quiz)
	else:
		doc = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
			}
		)

	doc.update({"title": quiz_title})
	doc.save(ignore_permissions=True)

	for index, row in enumerate(json.loads(questions)):
		if row["question_name"]:
			question_doc = frappe.get_doc("LMS Quiz Question", row["question_name"])
		else:
			question_doc = frappe.get_doc(
				{
					"doctype": "LMS Quiz Question",
					"parent": doc.name,
					"parenttype": "LMS Quiz",
					"parentfield": "questions",
					"idx": index + 1,
				}
			)

		question_doc.update(row)
		question_doc.save(ignore_permissions=True)

	return doc.name


@frappe.whitelist()
def check_answer(question, type, answer):
	if type == "Choices":
		return check_choice_answers(question, answer)
	else:
		return check_input_answers(question, answer)


def check_choice_answers(question, answer):
	fields = []
	for num in range(1, 5):
		fields.append(f"option_{cstr(num)}")
		fields.append(f"is_correct_{cstr(num)}")

	question_details = frappe.db.get_value(
		"LMS Quiz Question", question, fields, as_dict=1
	)

	for num in range(1, 5):
		if question_details[f"option_{num}"] == answer:
			return question_details[f"is_correct_{num}"]
	return 0


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
	return frappe.get_all(
		"LMS Quiz", filters={"owner": frappe.session.user}, fields=["name", "title"]
	)
