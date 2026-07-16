import json

import frappe
from frappe.tests.test_api import FrappeAPITestCase

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_quiz_with_questions


def _quiz_block_content(quiz):
	return json.dumps(
		{
			"time": 1765194986690,
			"blocks": [{"id": "q1", "type": "quiz", "data": {"quiz": quiz}}],
			"version": "2.29.0",
		}
	)


class TestQuizAuthorization(BaseTestUtils, FrappeAPITestCase):
	"""get_quiz_with_questions must require enrollment/ownership, not just an LMS role."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"qinstr-{hash}@example.com", "Ivy", "Instr", ["Course Creator", "Moderator"]
		)
		self.enrolled = self._create_user(f"qstud-{hash}@example.com", "Ed", "Enrolled", ["LMS Student"])
		self.outsider = self._create_user(f"qout-{hash}@example.com", "Ove", "Outsider", ["LMS Student"])

		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(title=f"Authz Quiz {hash}")
		self.course = self._create_course(title=f"Quiz Course {hash}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"QChapter {hash}", self.course.name)
		# Link the quiz to the course the way production does: embed it as a content block,
		# which makes Course Lesson.save_lesson_details_in_quiz set LMS Quiz.course/lesson.
		# (Course Lesson.quiz_id is a manual field that is never auto-populated.)
		self.lesson = self._create_lesson(
			f"QLesson {hash}", self.chapter.name, self.course.name, _quiz_block_content(self.quiz.name)
		)
		self._create_enrollment(self.enrolled.email, self.course.name)

		# A second quiz never linked to any lesson or batch (e.g. mid-authoring).
		self.unlinked_quiz = self._create_quiz(title=f"Unlinked Quiz {hash}")

	def _call(self, user, quiz=None):
		frappe.session.user = user
		try:
			return get_quiz_with_questions(quiz or self.quiz.name)
		finally:
			frappe.session.user = "Administrator"

	def test_non_enrolled_user_cannot_read_quiz(self):
		with self.assertRaises(frappe.PermissionError):
			self._call(self.outsider.email)

	def test_enrolled_student_can_read_quiz(self):
		result = self._call(self.enrolled.email)
		self.assertEqual(len(result["questions_by_name"]), len(self.questions))

	def test_instructor_can_read_quiz(self):
		result = self._call(self.instructor.email)
		self.assertEqual(len(result["questions_by_name"]), len(self.questions))

	def test_moderator_can_read_unlinked_quiz(self):
		# Regression: an author/moderator must still reach a quiz not yet embedded anywhere.
		result = self._call(self.instructor.email, quiz=self.unlinked_quiz.name)
		self.assertEqual(len(result["questions_by_name"]), len(self.questions))

	def test_non_enrolled_user_cannot_read_unlinked_quiz(self):
		with self.assertRaises(frappe.PermissionError):
			self._call(self.outsider.email, quiz=self.unlinked_quiz.name)

	def test_non_string_quiz_is_rejected(self):
		# A non-string quiz is rejected either by Frappe's whitelist type
		# validation (FrappeTypeError, from the `quiz: str` annotation) or by
		# our own isinstance guard (ValidationError) for non-whitelisted callers.
		frappe.session.user = self.enrolled.email
		try:
			with self.assertRaises((frappe.ValidationError, frappe.FrappeTypeError)):
				get_quiz_with_questions(["not", "a", "string"])
		finally:
			frappe.session.user = "Administrator"
