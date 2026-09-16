import json

import frappe

from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz
from lms.lms.doctype.lms_quiz_submission.lms_quiz_submission import MaximumAttemptsExceededError
from lms.lms.test_helpers import BaseTestUtils


def _quiz_block_content(quiz):
	return json.dumps(
		{
			"time": 1765194986690,
			"blocks": [{"id": "q1", "type": "quiz", "data": {"quiz": quiz}}],
			"version": "2.29.0",
		}
	)


class TestQuizSubmissionAccess(BaseTestUtils):
	"""submit_quiz must require quiz access and enforce max_attempts
	(VULN-2026-FRAPPE-LMS-005)."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"sqinstr-{hash}@example.com", "Iris", "Instr", ["Course Creator", "Moderator"]
		)
		cls.enrolled = cls._create_user(f"sqenr-{hash}@example.com", "Ela", "Enrolled", ["LMS Student"])
		cls.outsider = cls._create_user(f"sqout-{hash}@example.com", "Otis", "Outsider", ["LMS Student"])

		cls.questions = cls._create_quiz_questions()
		cls.quiz = cls._create_quiz(cls.questions, title=f"Submit Quiz {hash}")
		cls.course = cls._create_course(title=f"Submit Course {hash}", instructor=cls.instructor.email)
		cls.chapter = cls._create_chapter(f"SQChapter {hash}", cls.course.name)
		# Embedding the quiz in a lesson makes save_lesson_details_in_quiz set
		# LMS Quiz.course/lesson, which is what can_access_quiz keys off.
		cls.lesson = cls._create_lesson(
			f"SQLesson {hash}", cls.chapter.name, cls.course.name, _quiz_block_content(cls.quiz.name)
		)
		cls._create_enrollment(cls.enrolled.email, cls.course.name)

		cls.results = [{"question_name": q.name, "answer": ["Option 1"]} for q in cls.questions]

	def _submit(self, user):
		frappe.session.user = user
		try:
			return submit_quiz(self.quiz.name, json.dumps(self.results))
		finally:
			frappe.session.user = "Administrator"

	def _cleanup_submissions(self, member):
		for name in frappe.get_all(
			"LMS Quiz Submission", {"quiz": self.quiz.name, "member": member}, pluck="name"
		):
			frappe.delete_doc("LMS Quiz Submission", name, force=True)

	def test_non_enrolled_user_cannot_submit(self):
		with self.assertRaises(frappe.PermissionError):
			self._submit(self.outsider.email)
		self.assertEqual(
			frappe.db.count("LMS Quiz Submission", {"quiz": self.quiz.name, "member": self.outsider.email}),
			0,
		)

	def test_enrolled_user_can_submit(self):
		result = self._submit(self.enrolled.email)
		self.assertIn("submission", result)
		self._cleanup_submissions(self.enrolled.email)

	def test_max_attempts_enforced(self):
		# max_attempts is enforced downstream by LMSQuizSubmission.validate; this guards
		# against that gate regressing (the score-oracle cap the access check relies on).
		self._cleanup_submissions(self.enrolled.email)
		frappe.db.set_value("LMS Quiz", self.quiz.name, "max_attempts", 1)
		try:
			self._submit(self.enrolled.email)
			with self.assertRaises(MaximumAttemptsExceededError):
				self._submit(self.enrolled.email)
		finally:
			frappe.db.set_value("LMS Quiz", self.quiz.name, "max_attempts", 0)
			self._cleanup_submissions(self.enrolled.email)
