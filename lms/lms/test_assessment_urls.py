import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import (
	get_assignment_details,
	get_exercise_details,
	get_lms_path,
	get_quiz_details,
)


# Guards the assessment URL helpers building paths the SPA route table has.
# Quiz URLs came in #713, exercise URLs in #1593; both were dead paths.
# Added on feat/assessment-visual-redesign as its route moves touched all three.
class TestAssessmentUrls(BaseTestUtils):
	def test_quiz_url_addresses_a_submission_by_its_own_name(self):
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": frappe.generate_hash(length=8),
				"passing_percentage": 50,
				"total_marks": 10,
			}
		).insert()
		assessment = frappe._dict(assessment_name=quiz.name)

		result = get_quiz_details(assessment, "Administrator")

		# A quiz has no "new submission" page, so with no submission yet the link
		# is the attempt page.
		self.assertEqual(result.url, f"/quiz/{quiz.name}")
		self.assertEqual(result.edit_url, f"/quizzes/edit/{quiz.name}")

	def test_quiz_url_addresses_an_existing_submission_by_its_own_name(self):
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": frappe.generate_hash(length=8),
				"passing_percentage": 50,
				"total_marks": 10,
			}
		).insert()
		submission = frappe.get_doc(
			{
				"doctype": "LMS Quiz Submission",
				"quiz": quiz.name,
				"member": "Administrator",
				"score_out_of": 10,
				"passing_percentage": 50,
				"percentage": 0,
			}
		).insert()
		assessment = frappe._dict(assessment_name=quiz.name)

		result = get_quiz_details(assessment, "Administrator")

		self.assertEqual(result.url, f"/quiz-submission/{submission.name}")

	def _create_assignment(self):
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": frappe.generate_hash(length=8),
				"type": "Text",
				"question": "<p>Explain the difference between a list and a tuple.</p>",
			}
		).insert()
		return assignment

	def test_assignment_url_points_at_a_new_submission_under_the_assignment(self):
		assignment = self._create_assignment()
		assessment = frappe._dict(assessment_name=assignment.name)

		result = get_assignment_details(assessment, "Administrator")

		# The no-submission-yet segment is "new", not the old "new-submission".
		self.assertEqual(
			result.url,
			f"/{get_lms_path()}/assignment-submission/{assignment.name}/new",
		)
		self.assertEqual(result.edit_url, f"/assignments/edit/{assignment.name}")

	def test_assignment_url_addresses_an_existing_submission_by_its_own_name(self):
		assignment = self._create_assignment()
		submission = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": assignment.name,
				"member": "Administrator",
				"answer": "<p>A tuple is immutable.</p>",
			}
		).insert()
		assessment = frappe._dict(assessment_name=assignment.name)

		result = get_assignment_details(assessment, "Administrator")

		self.assertEqual(
			result.url,
			f"/{get_lms_path()}/assignment-submission/{assignment.name}/{submission.name}",
		)
		# The two branches differ only in this segment.
		self.assertFalse(result.url.endswith("/new"))
		self.assertEqual(result.edit_url, f"/assignments/edit/{assignment.name}")

	def test_exercise_url_addresses_a_new_submission(self):
		exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "Write a function to return the sum of two numbers.",
				"test_cases": [
					{"input": "2", "expected_output": "3"},
				],
			}
		).insert()
		assessment = frappe._dict(assessment_name=exercise.name)

		result = get_exercise_details(assessment, "Administrator")

		self.assertEqual(
			result.edit_url,
			f"/programming-exercise-submission/{exercise.name}/new",
		)

	def test_exercise_url_addresses_an_existing_submission_by_its_own_name(self):
		exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "Write a function to return the sum of two numbers.",
				"test_cases": [
					{"input": "2", "expected_output": "3"},
				],
			}
		).insert()
		submission = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise Submission",
				"exercise": exercise.name,
				"member": "Administrator",
				"code": "print(inputs[0] + 1)",
			}
		).insert()
		assessment = frappe._dict(assessment_name=exercise.name)

		result = get_exercise_details(assessment, "Administrator")

		self.assertEqual(
			result.edit_url,
			f"/programming-exercise-submission/{exercise.name}/{submission.name}",
		)
