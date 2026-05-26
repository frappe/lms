# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.utils import has_course_instructor_role, has_moderator_role

# Each LMS Question carries up to 4 option/correctness/explanation/possibility
# columns. Keep these lists as the single source of truth so any future change
# to cardinality touches one place.
QUESTION_OPTION_FIELDS = [f"option_{i}" for i in range(1, 5)]
QUESTION_CORRECTNESS_FIELDS = [f"is_correct_{i}" for i in range(1, 5)]
QUESTION_EXPLANATION_FIELDS = [f"explanation_{i}" for i in range(1, 5)]
QUESTION_POSSIBILITY_FIELDS = [f"possibility_{i}" for i in range(1, 5)]


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
	options = [question.get(f) for f in QUESTION_OPTION_FIELDS if question.get(f)]
	if len(set(options)) != len(options):
		frappe.throw(_("Duplicate options found for this question."))


def validate_correct_options(question):
	correct_options = get_correct_options(question)

	if len(correct_options) > 1:
		question.multiple = 1
	else:
		question.multiple = 0

	if not len(correct_options):
		frappe.throw(_("At least one option must be correct for this question."))


def validate_minimum_options(question):
	if question.type == "Choices" and (not question.option_1 or not question.option_2):
		frappe.throw(_("Minimum two options are required for multiple choice questions."))


def validate_possible_answer(question):
	if not any(question.get(f) for f in QUESTION_POSSIBILITY_FIELDS):
		frappe.throw(
			_("Add at least one possible answer for this question: {0}").format(
				frappe.bold(question.question)
			)
		)


def update_question_title(question):
	if not question.is_new():
		question_rows = frappe.get_all("LMS Quiz Question", {"question": question.name}, pluck="name")

		for row in question_rows:
			frappe.db.set_value("LMS Quiz Question", row, "question_detail", question.question)


def get_correct_options(question):
	return [f for f in QUESTION_CORRECTNESS_FIELDS if question.get(f) == 1]
