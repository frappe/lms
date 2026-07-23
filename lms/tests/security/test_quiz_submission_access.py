import json

import frappe
from frappe.tests.test_api import FrappeAPITestCase

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


class TestQuizSubmissionAccess(BaseTestUtils, FrappeAPITestCase):
	"""submit_quiz must require quiz access and enforce max_attempts
	(VULN-2026-FRAPPE-LMS-005)."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"sqinstr-{hash}@example.com", "Iris", "Instr", ["Course Creator", "Moderator"]
		)
		self.enrolled = self._create_user(f"sqenr-{hash}@example.com", "Ela", "Enrolled", ["LMS Student"])
		self.outsider = self._create_user(f"sqout-{hash}@example.com", "Otis", "Outsider", ["LMS Student"])

		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(title=f"Submit Quiz {hash}")
		self.course = self._create_course(title=f"Submit Course {hash}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"SQChapter {hash}", self.course.name)
		# Embedding the quiz in a lesson makes save_lesson_details_in_quiz set
		# LMS Quiz.course/lesson, which is what can_access_quiz keys off.
		self.lesson = self._create_lesson(
			f"SQLesson {hash}", self.chapter.name, self.course.name, _quiz_block_content(self.quiz.name)
		)
		self._create_enrollment(self.enrolled.email, self.course.name)

		self.results = [{"question_name": q.name, "answer": ["Option 1"]} for q in self.questions]

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

	def test_non_string_quiz_rejected(self):
		# A non-string quiz must fail cleanly, not with a 500 from the ORM: either
		# Frappe's whitelist type validation (FrappeTypeError, from the `quiz: str`
		# annotation) or our own isinstance guard rejects it.
		frappe.session.user = self.enrolled.email
		try:
			with self.assertRaises((frappe.ValidationError, frappe.FrappeTypeError)):
				submit_quiz(["not", "a", "string"], json.dumps(self.results))
		finally:
			frappe.session.user = "Administrator"

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
