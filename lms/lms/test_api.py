import frappe

from lms.lms.api import get_certified_participants, get_course_assessment_progress
from lms.lms.test_helpers import BaseTestUtils


class TestLMSAPI(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._setup_course_flow()

	def test_certified_participants_with_category(self):
		filters = {"category": "Utility Course"}
		certified_participants = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants), 1)
		self.assertEqual(certified_participants[0].member, self.student1.email)

		filters = {"category": "Nonexistent Category"}
		certified_participants_no_match = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_no_match), 0)

	def test_certified_participants_with_open_to_work(self):
		filters = {"open_to_work": 1}
		certified_participants_open_to_work = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_open_to_work), 0)

		frappe.db.set_value("User", self.student1.email, "open_to", "Work")
		certified_participants_open_to_work = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_open_to_work), 1)
		frappe.db.set_value("User", self.student1.email, "open_to", "")

	def test_certified_participants_with_open_to_hiring(self):
		filters = {"hiring": 1}
		certified_participants_hiring = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_hiring), 0)

		frappe.db.set_value("User", self.student1.email, "open_to", "Hiring")
		certified_participants_hiring = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_hiring), 1)
		frappe.db.set_value("User", self.student1.email, "open_to", "")

	def test_course_assessment_progress(self):
		progress = get_course_assessment_progress(self.course.name, self.student1.name)
		progress = frappe._dict(progress)

		self.assertEqual(len(progress.quizzes), 1)
		for quiz in progress.quizzes:
			self.assertEqual(quiz.quiz, self.quiz.name)
			self.assertEqual(quiz.quiz_title, self.quiz.title)
			self.assertEqual(quiz.score, 12)
			self.assertEqual(quiz.percentage, 80)

		self.assertEqual(len(progress.assignments), 1)
		for assignment in progress.assignments:
			self.assertEqual(assignment.assignment, self.assignment.name)
			self.assertEqual(assignment.assignment_title, self.assignment.title)
			self.assertEqual(assignment.status, "Pass")

		self.assertEqual(len(progress.exercises), 1)
		for exercise in progress.exercises:
			self.assertEqual(exercise.exercise, self.programming_exercise.name)
			self.assertEqual(exercise.exercise_title, self.programming_exercise.title)
			self.assertEqual(exercise.status, "Passed")
