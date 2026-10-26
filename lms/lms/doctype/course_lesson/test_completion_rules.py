import frappe

from lms.lms.doctype.course_lesson.course_lesson import (
	get_assignment_progress,
	get_programming_exercise_progress,
	get_quiz_progress,
)
from lms.lms.test_helpers import BaseTestUtils


class CompletionFixtures(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		instructor = cls._create_user(
			f"cr-instr-{hash}@example.com", "Rule", "Instructor", ["Course Creator"]
		)
		cls.student = cls._create_user(
			f"cr-student-{hash}@example.com", "Rule", "Student", ["LMS Student"]
		).name
		cls.course = cls._create_course(f"Completion Rule Course {hash}", instructor=instructor.email).name
		cls._create_enrollment(cls.student, cls.course)

		cls.quiz = cls._create_quiz(cls._create_quiz_questions()[:1], title=f"Rule Quiz {hash}")
		cls.quiz_lesson = cls._place_in_lesson(cls.course, "LMS Quiz", cls.quiz.name).name
		cls.assignment = cls._create_assignment(f"Rule Assignment {hash}").name
		cls.assignment_lesson = cls._place_in_lesson(cls.course, "LMS Assignment", cls.assignment).name
		cls.open_ended_quiz = cls._create_open_ended_quiz(hash)
		cls.open_ended_lesson = cls._place_in_lesson(cls.course, "LMS Quiz", cls.open_ended_quiz).name
		cls.exercise = cls._create_programming_exercise(f"Rule Exercise {hash}").name
		cls.exercise_lesson = cls._place_in_lesson(cls.course, "LMS Programming Exercise", cls.exercise).name

	@classmethod
	def _create_open_ended_quiz(cls, hash):
		question = frappe.get_doc(
			{"doctype": "LMS Question", "question": f"Explain it {hash}", "type": "Open Ended"}
		).insert()
		quiz = frappe.get_doc(
			{"doctype": "LMS Quiz", "title": f"Open Ended Rule Quiz {hash}", "passing_percentage": 50}
		)
		quiz.append("questions", {"question": question.name, "marks": 5})
		quiz.insert()
		cls.open_ended_question = question.name
		return quiz.name

	@classmethod
	def _submit_quiz(cls, quiz, percentage):
		"""The score is written straight in: set_percentage would recompute it from rows."""
		submission = frappe.get_doc(
			{"doctype": "LMS Quiz Submission", "quiz": quiz, "member": cls.student, "passing_percentage": 70}
		).insert()
		frappe.db.set_value("LMS Quiz Submission", submission.name, "percentage", percentage)
		return submission.name

	@classmethod
	def _submit_assignment(cls, status):
		frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": cls.assignment,
				"member": cls.student,
				"answer": "My answer.",
				"status": status,
			}
		).insert()

	@classmethod
	def _submit_exercise(cls, status):
		frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise Submission",
				"exercise": cls.exercise,
				"member": cls.student,
				"code": "print(1)",
				"status": status,
			}
		).insert()


# Regression on this branch only, no upstream PR: each item is held to its own rule.
# Added on fix/course-progress-enforcement (no PR yet).
class TestCompletionRuleChecks(CompletionFixtures):
	def _quiz(self, rule):
		return get_quiz_progress(self.quiz_lesson, self.student, rule)

	def test_no_quiz_submission_meets_neither_rule(self):
		self.assertFalse(self._quiz("Attempted"))
		self.assertFalse(self._quiz("Passed"))

	def test_a_failing_quiz_submission_is_an_attempt_but_not_a_pass(self):
		self._submit_quiz(self.quiz.name, 0)
		self.assertTrue(self._quiz("Attempted"))
		self.assertFalse(self._quiz("Passed"))

	def test_a_passing_quiz_submission_meets_the_passed_rule(self):
		self._submit_quiz(self.quiz.name, 100)
		self.assertTrue(self._quiz("Passed"))

	def test_an_item_with_no_rule_does_not_hold_the_lesson(self):
		self.assertTrue(self._quiz(None))
		self.assertTrue(get_assignment_progress(self.assignment_lesson, self.student, None))
		self.assertTrue(get_programming_exercise_progress(self.exercise_lesson, self.student, None))

	def test_an_ungraded_assignment_is_an_attempt_but_not_a_pass(self):
		self._submit_assignment("Not Graded")
		self.assertTrue(get_assignment_progress(self.assignment_lesson, self.student, "Attempted"))
		self.assertFalse(get_assignment_progress(self.assignment_lesson, self.student, "Passed"))

	def test_a_passed_assignment_meets_the_passed_rule(self):
		self._submit_assignment("Pass")
		self.assertTrue(get_assignment_progress(self.assignment_lesson, self.student, "Passed"))

	def test_a_failed_exercise_is_an_attempt_but_not_a_pass(self):
		self._submit_exercise("Failed")
		self.assertTrue(get_programming_exercise_progress(self.exercise_lesson, self.student, "Attempted"))
		self.assertFalse(get_programming_exercise_progress(self.exercise_lesson, self.student, "Passed"))

	def test_a_passed_exercise_meets_the_passed_rule(self):
		self._submit_exercise("Passed")
		self.assertTrue(get_programming_exercise_progress(self.exercise_lesson, self.student, "Passed"))

	def test_an_ungraded_open_ended_quiz_is_an_attempt_but_not_a_pass(self):
		self._submit_quiz(self.open_ended_quiz, 0)
		self.assertTrue(get_quiz_progress(self.open_ended_lesson, self.student, "Passed", "Attempted"))
		self.assertFalse(get_quiz_progress(self.open_ended_lesson, self.student, "Attempted", "Passed"))

	def test_each_kind_of_quiz_is_held_only_to_its_own_rule(self):
		self.assertTrue(get_quiz_progress(self.open_ended_lesson, self.student, "Passed", None))
		self.assertFalse(get_quiz_progress(self.quiz_lesson, self.student, "Passed", None))
		self.assertTrue(get_quiz_progress(self.quiz_lesson, self.student, None, "Passed"))
