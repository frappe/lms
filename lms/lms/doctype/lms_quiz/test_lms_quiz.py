# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

# import frappe
import unittest

import frappe


class TestLMSQuiz(unittest.TestCase):
	@classmethod
	def setUpClass(cls) -> None:
		frappe.get_doc({"doctype": "LMS Quiz", "title": "Test Quiz", "passing_percentage": 90}).save()

	def test_with_multiple_options(self):
		question = frappe.new_doc("LMS Question")
		question.question = "Question Multiple"
		question.type = "Choices"
		question.option_1 = "Option 1"
		question.is_correct_1 = 1
		question.option_2 = "Option 2"
		question.is_correct_2 = 1
		question.save()
		self.assertTrue(question.multiple)

	def test_with_no_correct_option(self):
		question = frappe.new_doc("LMS Question")
		question.question = "Question Multiple"
		question.type = "Choices"
		question.option_1 = "Option 1"
		question.option_2 = "Option 2"
		self.assertRaises(frappe.ValidationError, question.save)

	def test_with_no_possible_answers(self):
		question = frappe.new_doc("LMS Question")
		question.question = "Question Multiple"
		question.type = "User Input"
		self.assertRaises(frappe.ValidationError, question.save)

	def test_scores_question_with_ten_options(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import verify_answer

		q = frappe.new_doc("LMS Question")
		q.question = "Ten option question"
		q.type = "Choices"
		for i in range(1, 11):
			q.set(f"option_{i}", f"opt{i}")
		q.is_correct_7 = 1
		q.save()

		self.assertTrue(verify_answer(q.name, ["opt7"]))
		self.assertFalse(verify_answer(q.name, ["opt3"]))

	def test_legacy_two_option_question_still_scores(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import verify_answer

		q = frappe.new_doc("LMS Question")
		q.question = "Two option legacy"
		q.type = "Choices"
		q.option_1 = "yes"
		q.is_correct_1 = 1
		q.option_2 = "no"
		q.save()

		self.assertTrue(verify_answer(q.name, ["yes"]))
		self.assertFalse(verify_answer(q.name, ["no"]))

	def test_user_input_matches_seventh_possibility(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import check_input_answers

		q = frappe.new_doc("LMS Question")
		q.question = "Ten possibility question"
		q.type = "User Input"
		for i in range(1, 11):
			q.set(f"possibility_{i}", f"answer {i}")
		q.save()

		self.assertTrue(bool(check_input_answers(q.name, "answer 7")))
		self.assertFalse(bool(check_input_answers(q.name, "totally different")))

	@classmethod
	def tearDownClass(cls) -> None:
		frappe.db.delete("LMS Quiz", "test-quiz")
		frappe.db.delete("LMS Question")
