# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from lms.lms.utils import has_course_instructor_role, has_course_moderator_role


class LMSQuestion(Document):
	def validate(self):
		validate_correct_answers(self)
		update_question_title(self)


def validate_correct_answers(question):
	if question.type == "Choices":
		validate_duplicate_options(question)
		validate_minimum_options(question)
		validate_correct_options(question)
	elif question.type == "User Input":
		validate_possible_answer(question)


def validate_duplicate_options(question):
	options = []

	for num in range(1, 5):
		if question.get(f"option_{num}"):
			options.append(question.get(f"option_{num}"))

	if len(set(options)) != len(options):
		frappe.throw(_("Duplicate options found for this question."))


def validate_correct_options(question):
	correct_options = get_correct_options(question)

	if len(correct_options) > 1:
		question.multiple = 1

	if not len(correct_options):
		frappe.throw(_("At least one option must be correct for this question."))


def validate_minimum_options(question):
	if question.type == "Choices" and (not question.option_1 or not question.option_2):
		frappe.throw(_("Minimum two options are required for multiple choice questions."))


def validate_possible_answer(question):
	possible_answers = []
	possible_answers_fields = [
		"possibility_1",
		"possibility_2",
		"possibility_3",
		"possibility_4",
	]

	for field in possible_answers_fields:
		if question.get(field):
			possible_answers.append(field)

	if not len(possible_answers):
		frappe.throw(
			_("Add at least one possible answer for this question: {0}").format(
				frappe.bold(question.question)
			)
		)


def update_question_title(question):
	if not question.is_new():
		question_rows = frappe.get_all(
			"LMS Quiz Question", {"question": question.name}, pluck="name"
		)

		for row in question_rows:
			frappe.db.set_value("LMS Quiz Question", row, "question_detail", question.question)


def get_correct_options(question):
	correct_options = []
	correct_option_fields = [
		"is_correct_1",
		"is_correct_2",
		"is_correct_3",
		"is_correct_4",
	]
	for field in correct_option_fields:
		if question.get(field) == 1:
			correct_options.append(field)

	return correct_options


@frappe.whitelist()
def get_question_details(question):
	if not has_course_instructor_role() or not has_course_moderator_role():
		return

	fields = ["question", "type", "name"]
	for i in range(1, 5):
		fields.append(f"option_{i}")
		fields.append(f"is_correct_{i}")
		fields.append(f"explanation_{i}")
		fields.append(f"possibility_{i}")

	return frappe.db.get_value("LMS Question", question, fields, as_dict=1)
