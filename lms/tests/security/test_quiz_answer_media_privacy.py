# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""A learner's inline quiz-answer image must not be world-readable.

Regression tests for frappe/lms#2768.

`_save_file` built the `File` row by hand with `is_private: False`, so it never went
near the private-by-default upload path the SPA uses (`FileUploader`'s
`{private: true}` -> `upload_file`'s `is_private=1`). The image landed under `/files/`
where anyone holding the URL -- including the other learners sitting the same quiz --
could read the graded evidence.
"""

import base64
import json

import frappe

from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz
from lms.lms.test_helpers import BaseTestUtils

# 1x1 transparent PNG.
ONE_PIXEL_PNG = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
)


class TestQuizAnswerImagePrivacy(BaseTestUtils):
	"""An open-ended answer's inline image is the learner's own work and the
	grader's evidence. It is written private and bound to the submission, so
	`File.has_permission` defers to LMS Quiz Submission's own read rule."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6).lower()
		cls.learner = cls._create_user(f"mp-learner-{hash}@example.com", "Lea", "Rner", ["LMS Student"]).name
		cls.onlooker = cls._create_user(f"mp-other-{hash}@example.com", "On", "Looker", ["LMS Student"]).name
		cls.author = cls._create_user(f"mp-qauth-{hash}@example.com", "Qu", "Author", ["Course Creator"]).name

		question = frappe.new_doc("LMS Question")
		question.update({"question": f"Show your working {hash}", "type": "Open Ended"})
		question.save()
		cls.question = question

		cls.course = cls._create_course(title=f"Media Privacy Course {hash}", instructor=cls.author)

		quiz = frappe.new_doc("LMS Quiz")
		quiz.update(
			{
				"title": f"Open Ended Quiz {hash}",
				"passing_percentage": 0,
				"total_marks": 5,
				"course": cls.course.name,
			}
		)
		quiz.append("questions", {"question": question.name, "marks": 5})
		quiz.save()
		cls.quiz = quiz

		# The onlooker is enrolled too: a peer sitting the same quiz is the caller this
		# is meant to keep out, not a stranger who was never in the course.
		cls._create_enrollment(cls.learner, cls.course.name)
		cls._create_enrollment(cls.onlooker, cls.course.name)

	def _submit_answer_with_an_image(self, as_user):
		encoded = base64.b64encode(ONE_PIXEL_PNG).decode()
		answer = f'<img src="data:image/png;filename=working-{frappe.generate_hash(length=6)}.png,{encoded}">'
		original = frappe.session.user
		frappe.set_user(as_user)
		try:
			return submit_quiz(
				self.quiz.name,
				json.dumps([{"question_name": self.question.name, "answer": [answer]}]),
			)
		finally:
			frappe.set_user(original)

	def _answer_file(self, submission):
		stored = frappe.get_doc("LMS Quiz Submission", submission)
		url = stored.result[0].answer.split('src="', 1)[1].split('"', 1)[0]
		path = url.split("?", 1)[0]
		name = frappe.db.get_value("File", {"file_url": path}, "name")
		self.assertTrue(name, f"no File row for {path}")
		return frappe.get_doc("File", name), path

	def test_an_inline_answer_image_is_written_private(self):
		result = self._submit_answer_with_an_image(self.learner)
		file, path = self._answer_file(result["submission"])
		self.assertTrue(path.startswith("/private/files/"), f"answer image served from {path}")
		self.assertEqual(file.is_private, 1)

	def test_an_inline_answer_image_is_bound_to_its_submission(self):
		"""Without the attachment a private File is readable by its owner alone, which
		would hide the learner's own evidence from the grader."""
		result = self._submit_answer_with_an_image(self.learner)
		file, _ = self._answer_file(result["submission"])
		self.assertEqual(file.attached_to_doctype, "LMS Quiz Submission")
		self.assertEqual(file.attached_to_name, result["submission"])

	def test_another_learner_cannot_read_an_inline_answer_image(self):
		result = self._submit_answer_with_an_image(self.learner)
		file, _ = self._answer_file(result["submission"])

		self.assertTrue(
			file.has_permission("read", user=self.learner),
			"the learner lost access to their own answer image",
		)
		self.assertFalse(
			file.has_permission("read", user=self.onlooker),
			"another learner can read this answer image",
		)

	def test_the_gate_is_the_submission_and_not_the_file_owner(self):
		"""Control. The learner passes on ownership alone, so a test that only checks
		the learner would still pass if the attachment were dropped. A System Manager
		owns nothing here and can read it only through LMS Quiz Submission's DocPerm."""
		result = self._submit_answer_with_an_image(self.learner)
		file, _ = self._answer_file(result["submission"])
		self.assertNotEqual(file.owner, "Administrator")
		self.assertTrue(file.has_permission("read", user="Administrator"))
