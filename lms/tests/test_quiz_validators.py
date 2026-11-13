import frappe
from frappe.tests import UnitTestCase


class TestQuizPassingPercentage(UnitTestCase):
	"""An empty quiz reset passing_percentage to 100, and adding questions later never
	restored it. Guards that only total_marks is derived; the author's pass mark stays.
	Fixture-free: validators run on an unsaved doc."""

	def _quiz(self, question_count=0, **kwargs):
		quiz = frappe.new_doc("LMS Quiz")
		quiz.update({"title": "Validator Quiz", "passing_percentage": 70, **kwargs})
		for i in range(question_count):
			quiz.append("questions", {"question": f"question-{i}", "marks": 1})
		return quiz

	def test_empty_quiz_keeps_the_authors_passing_percentage(self):
		quiz = self._quiz(question_count=0, passing_percentage=70)

		quiz.calculate_total_marks()

		self.assertEqual(quiz.total_marks, 0)
		self.assertEqual(quiz.passing_percentage, 70)

	def test_passing_percentage_survives_adding_questions_later(self):
		quiz = self._quiz(question_count=0, passing_percentage=40)
		quiz.calculate_total_marks()

		quiz.append("questions", {"question": "question-0", "marks": 5})
		quiz.calculate_total_marks()

		self.assertEqual(quiz.total_marks, 5)
		self.assertEqual(quiz.passing_percentage, 40)

	def test_empty_quiz_without_a_pass_mark_still_gets_the_default(self):
		quiz = self._quiz(question_count=0, passing_percentage=None)

		quiz.calculate_total_marks()

		self.assertEqual(quiz.passing_percentage, 100)
