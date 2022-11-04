# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

# import frappe
import unittest

import frappe


class TestLMSQuiz(unittest.TestCase):
	@classmethod
	def setUpClass(cls) -> None:
		frappe.get_doc({"doctype": "LMS Quiz", "title": "Test Quiz"}).save(
			ignore_permissions=True
		)

	def test_with_multiple_options(self):
		quiz = frappe.get_doc("LMS Quiz", "test-quiz")
		quiz.append(
			"questions",
			{
				"question": "Question multiple",
				"option_1": "Option 1",
				"is_correct_1": 1,
				"option_2": "Option 2",
				"is_correct_2": 1,
			},
		)
		quiz.save()
		self.assertTrue(quiz.questions[0].multiple)

	def test_with_no_correct_option(self):
		quiz = frappe.get_doc("LMS Quiz", "test-quiz")
		quiz.append(
			"questions",
			{
				"question": "Question no correct option",
				"option_1": "Option 1",
				"option_2": "Option 2",
			},
		)
		self.assertRaises(frappe.ValidationError, quiz.save)

	@classmethod
	def tearDownClass(cls) -> None:
		frappe.db.delete("LMS Quiz", "test-quiz")
		frappe.db.delete("LMS Quiz Question", {"parent": "test-quiz"})
