# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cstr, comma_and, cint
from fuzzywuzzy import fuzz
from lms.lms.doctype.course_lesson.course_lesson import save_progress
from lms.lms.utils import (
	generate_slug,
	has_course_moderator_role,
	has_course_instructor_role,
)


class LMSQuiz(Document):
	def validate(self):
		self.validate_duplicate_questions()
		self.validate_limit()
		self.calculate_total_marks()

	def validate_duplicate_questions(self):
		questions = [row.question for row in self.questions]
		rows = [i + 1 for i, x in enumerate(questions) if questions.count(x) > 1]
		if len(rows):
			frappe.throw(
				_("Rows {0} have the duplicate questions.").format(frappe.bold(comma_and(rows)))
			)

	def validate_limit(self):
		if self.limit_questions_to and cint(self.limit_questions_to) >= len(self.questions):
			frappe.throw(
				_("Limit cannot be greater than or equal to the number of questions in the quiz.")
			)

		if self.limit_questions_to and cint(self.limit_questions_to) < len(self.questions):
			marks = [question.marks for question in self.questions]
			if len(set(marks)) > 1:
				frappe.throw(_("All questions should have the same marks if the limit is set."))

	def calculate_total_marks(self):
		if self.limit_questions_to:
			self.total_marks = sum(
				question.marks for question in self.questions[: cint(self.limit_questions_to)]
			)
		else:
			self.total_marks = sum(cint(question.marks) for question in self.questions)

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


def set_total_marks(questions):
	marks = 0
	for question in questions:
		marks += question.get("marks")
	return marks


@frappe.whitelist()
def quiz_summary(quiz, results):
	score = 0
	results = results and json.loads(results)

	for result in results:
		correct = result["is_correct"][0]
		for point in result["is_correct"]:
			correct = correct and point
		result["is_correct"] = correct

		question_details = frappe.db.get_value(
			"LMS Quiz Question",
			{"parent": quiz, "question": result["question_name"]},
			["question", "marks", "question_detail"],
			as_dict=1,
		)

		result["question_name"] = question_details.question
		result["question"] = question_details.question_detail
		marks = question_details.marks if correct else 0

		result["marks"] = marks
		score += marks

		del result["question_name"]

	quiz_details = frappe.db.get_value(
		"LMS Quiz", quiz, ["total_marks", "passing_percentage", "lesson", "course"], as_dict=1
	)
	score_out_of = quiz_details.total_marks
	percentage = (score / score_out_of) * 100

	submission = frappe.get_doc(
		{
			"doctype": "LMS Quiz Submission",
			"quiz": quiz,
			"result": results,
			"score": score,
			"score_out_of": score_out_of,
			"member": frappe.session.user,
			"percentage": percentage,
			"passing_percentage": quiz_details.passing_percentage,
		}
	)
	submission.save(ignore_permissions=True)

	if (
		percentage >= quiz_details.passing_percentage
		and quiz_details.lesson
		and quiz_details.course
	):
		save_progress(quiz_details.lesson, quiz_details.course)
	elif not quiz_details.passing_percentage:
		save_progress(quiz_details.lesson, quiz_details.course)

	return {
		"score": score,
		"score_out_of": score_out_of,
		"submission": submission.name,
		"pass": percentage == quiz_details.passing_percentage,
		"percentage": percentage,
	}


@frappe.whitelist()
def save_quiz(
	quiz_title,
	passing_percentage,
	questions,
	max_attempts=0,
	quiz=None,
	show_answers=1,
	show_submission_history=0,
):
	if not has_course_moderator_role() or not has_course_instructor_role():
		return

	values = {
		"title": quiz_title,
		"passing_percentage": passing_percentage,
		"max_attempts": max_attempts,
		"show_answers": show_answers,
		"show_submission_history": show_submission_history,
	}

	if quiz:
		frappe.db.set_value("LMS Quiz", quiz, values)
		update_questions(quiz, questions)
		return quiz
	else:
		doc = frappe.new_doc("LMS Quiz")
		doc.update(values)
		doc.save()
		update_questions(doc.name, questions)
		return doc.name


def update_questions(quiz, questions):
	questions = json.loads(questions)

	delete_questions(quiz, questions)
	add_questions(quiz, questions)
	frappe.db.set_value("LMS Quiz", quiz, "total_marks", set_total_marks(quiz, questions))


def delete_questions(quiz, questions):
	existing_questions = frappe.get_all(
		"LMS Quiz Question",
		{
			"parent": quiz,
		},
		pluck="name",
	)

	current_questions = [question.get("question_name") for question in questions]

	for question in existing_questions:
		if question not in current_questions:
			frappe.db.delete("LMS Quiz Question", question)


def add_questions(quiz, questions):
	for index, question in enumerate(questions):
		question = frappe._dict(question)
		if question.question_name:
			doc = frappe.get_doc("LMS Quiz Question", question.question_name)
		else:
			doc = frappe.new_doc("LMS Quiz Question")
			doc.update(
				{
					"parent": quiz,
					"parenttype": "LMS Quiz",
					"parentfield": "questions",
					"idx": index + 1,
				}
			)

		doc.update({"question": question.question, "marks": question.marks})

		doc.save()


@frappe.whitelist()
def save_question(quiz, values, index):
	values = frappe._dict(json.loads(values))

	if values.get("name"):
		doc = frappe.get_doc("LMS Question", values.get("name"))
	else:
		doc = frappe.new_doc("LMS Question")

	doc.update(
		{
			"question": values.question,
			"type": values["type"],
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

	doc.save()
	return doc.name


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
	fields = ["multiple"]
	is_correct = []
	for num in range(1, 5):
		fields.append(f"option_{cstr(num)}")
		fields.append(f"is_correct_{cstr(num)}")

	question_details = frappe.db.get_value("LMS Question", question, fields, as_dict=1)

	for num in range(1, 5):
		if question_details[f"option_{num}"] in answers:
			is_correct.append(question_details[f"is_correct_{num}"])
		elif question_details[f"is_correct_{num}"]:
			is_correct.append(2)
		else:
			is_correct.append(0)

	return is_correct


def check_input_answers(question, answer):
	fields = []
	for num in range(1, 5):
		fields.append(f"possibility_{cstr(num)}")

	question_details = frappe.db.get_value("LMS Question", question, fields, as_dict=1)
	for num in range(1, 5):
		current_possibility = question_details[f"possibility_{num}"]
		if current_possibility and fuzz.token_sort_ratio(current_possibility, answer) > 85:
			return 1

	return 0


@frappe.whitelist()
def get_user_quizzes():
	filters = {} if has_course_moderator_role() else {"owner": frappe.session.user}
	return frappe.get_all("LMS Quiz", filters=filters, fields=["name", "title"])
