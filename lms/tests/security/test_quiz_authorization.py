import json

import frappe

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


class TestQuizAuthorization(BaseTestUtils):
	"""get_quiz_with_questions must require enrollment/ownership, not just an LMS role."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"qinstr-{hash}@example.com", "Ivy", "Instr", ["Course Creator", "Moderator"]
		)
		cls.enrolled = cls._create_user(f"qstud-{hash}@example.com", "Ed", "Enrolled", ["LMS Student"])
		cls.outsider = cls._create_user(f"qout-{hash}@example.com", "Ove", "Outsider", ["LMS Student"])

		cls.questions = cls._create_quiz_questions()
		cls.quiz = cls._create_quiz(cls.questions, title=f"Authz Quiz {hash}")
		cls.course = cls._create_course(title=f"Quiz Course {hash}", instructor=cls.instructor.email)
		cls.chapter = cls._create_chapter(f"QChapter {hash}", cls.course.name)
		# Link the quiz to the course the way production does: embed it as a content block,
		# which makes Course Lesson.save_lesson_details_in_quiz set LMS Quiz.course/lesson.
		# (Course Lesson.quiz_id is a manual field that is never auto-populated.)
		cls.lesson = cls._create_lesson(
			f"QLesson {hash}", cls.chapter.name, cls.course.name, _quiz_block_content(cls.quiz.name)
		)
		cls._create_enrollment(cls.enrolled.email, cls.course.name)

		# A second quiz never linked to any lesson or batch (e.g. mid-authoring).
		cls.unlinked_quiz = cls._create_quiz(cls.questions, title=f"Unlinked Quiz {hash}")

	def _call(self, user, quiz=None):
		frappe.session.user = user
		try:
			return get_quiz_with_questions(quiz or self.quiz.name)
		finally:
			frappe.session.user = "Administrator"

	def test_allowed_readers_can_read_the_quiz(self):
		cases = [
			("enrolled_student_linked_quiz", self.enrolled.email, None),
			("instructor_linked_quiz", self.instructor.email, None),
			# Regression: an author/moderator must still reach a quiz not yet
			# embedded anywhere.
			("moderator_unlinked_quiz", self.instructor.email, self.unlinked_quiz.name),
		]
		for case, user, quiz in cases:
			with self.subTest(case=case):
				result = self._call(user, quiz=quiz)
				self.assertEqual(len(result["questions_by_name"]), len(self.questions))

	def test_non_enrolled_user_cannot_read_the_quiz(self):
		cases = [
			("linked_quiz", None),
			("unlinked_quiz", self.unlinked_quiz.name),
		]
		for case, quiz in cases:
			with self.subTest(case=case):
				with self.assertRaises(frappe.PermissionError):
					self._call(self.outsider.email, quiz=quiz)
