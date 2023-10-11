# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSQuestion(Document):
	def validate(self):
		self.validate_correct_answers()


def validate_correct_answers(question):
	if question.type == "Choices":
		validate_duplicate_options(question)
		validate_correct_options(question)


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


def get_correct_options(question):
	correct_option_fields = [
		"is_correct_1",
		"is_correct_2",
		"is_correct_3",
		"is_correct_4",
	]
	return list(filter(lambda x: question.get(x) == 1, correct_option_fields))
