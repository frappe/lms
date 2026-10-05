# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""Private images embedded in LMS Question HTML must reach enrolled learners the
same way lesson media does: stay private on disk, rewrite to an access-gated
serve endpoint, deny anyone who cannot take a quiz that includes the question.
"""

import base64

import frappe

from lms.lms.doctype.course_lesson import course_lesson
from lms.lms.doctype.lms_question.lms_question import (
	_resolve_question_references,
	serve_question_resource,
)
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import QUESTION_PRIVATE_MEDIA_ENDPOINT, get_quiz_with_questions

# 1x1 transparent PNG.
ONE_PIXEL_PNG = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
)


class TestServeQuestionResource(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		h = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"qmedia-instr-{h}@example.com", "Ada", "Instr", ["Course Creator", "Moderator"]
		)
		cls.student = cls._create_user(f"qmedia-stud-{h}@example.com", "Sam", "Student", ["LMS Student"])
		cls.outsider = cls._create_user(f"qmedia-out-{h}@example.com", "Otto", "Outsider", ["LMS Student"])

		frappe.set_user(cls.instructor.email)
		try:
			question = frappe.new_doc("LMS Question")
			question.update(
				{
					"question": f"Placeholder {h}",
					"type": "Choices",
					"option_1": "A",
					"is_correct_1": 1,
					"option_2": "B",
					"is_correct_2": 0,
				}
			)
			question.save()
			cls.question = question

			cls.image = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"quiz_prompt_{h}.png",
					"is_private": 1,
					"content": base64.b64encode(ONE_PIXEL_PNG).decode(),
					"decode": True,
				}
			).insert(ignore_permissions=True)
			cls.file_url = cls.image.file_url
			assert cls.file_url.startswith("/private/files/")

			# Unattached private upload embedded in the prompt — the production path
			# RichTextEditor leaves behind.
			cls.question.question = f'<p>Identify the shape</p><p><img src="{cls.file_url}"></p>'
			cls.question.save()
		finally:
			frappe.set_user("Administrator")

		cls.quiz = cls._create_quiz([cls.question], title=f"Question Media Quiz {h}")
		cls.course = cls._create_course(title=f"Question Media Course {h}", instructor=cls.instructor.email)
		cls._place_in_lesson(cls.course.name, "LMS Quiz", cls.quiz.name)
		cls._create_enrollment(cls.student.email, cls.course.name)

	def setUp(self):
		super().setUp()
		self.question.reload()

	def _serve_as(self, user, file_url=None):
		sentinel = object()
		stubbed = course_lesson._serve_private_file
		course_lesson._serve_private_file = lambda relative_path, filename: sentinel
		frappe.set_user(user)
		try:
			return serve_question_resource(file_url or self.file_url)
		finally:
			course_lesson._serve_private_file = stubbed
			frappe.set_user("Administrator")

	def test_content_search_resolves_unattached_private_image(self):
		refs = _resolve_question_references(self.file_url)
		self.assertIn(
			self.question.name,
			[r.question for r in refs],
			msg="content search must find an unattached private image in the question body",
		)

	def test_enrolled_student_is_served(self):
		self.assertIsNotNone(self._serve_as(self.student.email))

	def test_instructor_is_served(self):
		self.assertIsNotNone(self._serve_as(self.instructor.email))

	def test_non_member_is_denied(self):
		with self.assertRaises(frappe.PermissionError):
			self._serve_as(self.outsider.email)

	def test_get_quiz_with_questions_rewrites_private_urls(self):
		frappe.set_user(self.student.email)
		try:
			payload = get_quiz_with_questions(self.quiz.name)
		finally:
			frappe.set_user("Administrator")

		html = payload["questions_by_name"][self.question.name]["question"]
		self.assertIn(QUESTION_PRIVATE_MEDIA_ENDPOINT, html)
		self.assertNotIn(f'src="{self.file_url}"', html)

	def test_foreign_private_url_pasted_into_question_is_denied(self):
		"""Pasting another user's private file url into a question must not open it."""
		h = frappe.generate_hash(length=6)
		other = self._create_user(f"qmedia-other-{h}@example.com", "Oth", "Er", ["Course Creator"])
		frappe.set_user(other.email)
		try:
			secret = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"secret_{h}.png",
					"is_private": 1,
					"content": base64.b64encode(ONE_PIXEL_PNG).decode(),
					"decode": True,
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")

		original_html = self.question.question
		frappe.set_user(self.instructor.email)
		try:
			self.question.question = f'<p><img src="{secret.file_url}"></p>'
			self.question.save()
		finally:
			frappe.set_user("Administrator")

		try:
			with self.assertRaises(frappe.PermissionError):
				self._serve_as(self.student.email, file_url=secret.file_url)
		finally:
			frappe.set_user(self.instructor.email)
			try:
				self.question.question = original_html
				self.question.save()
			finally:
				frappe.set_user("Administrator")
