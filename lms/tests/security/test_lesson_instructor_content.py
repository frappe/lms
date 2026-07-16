import json

import frappe
from frappe.tests.test_api import FrappeAPITestCase

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_lesson

SECRET_MARKER = "ANSWER-KEY-8f21"


def _editorjs(text):
	return json.dumps(
		{
			"time": 1765194986690,
			"blocks": [{"id": "abc123", "type": "markdown", "data": {"text": text}}],
			"version": "2.29.0",
		}
	)


class TestLessonInstructorContentLeak(BaseTestUtils, FrappeAPITestCase):
	"""get_lesson must not return instructor-only fields to students or preview guests."""

	SECRET_NOTES = "GRADING-NOTES-be-strict"

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"instr-{hash}@example.com", "Ada", "Instr", ["Course Creator", "Moderator"]
		)
		self.student = self._create_user(f"stud-{hash}@example.com", "Sam", "Student", ["LMS Student"])

		self.course = self._create_course(title=f"Leak Course {hash}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"Chapter {hash}", self.course.name)
		self.lesson = self._create_lesson(f"Lesson {hash}", self.chapter.name, self.course.name)
		# Preview + instructor-only content (content fields are EditorJS JSON blobs).
		self.lesson.include_in_preview = 1
		self.lesson.instructor_content = _editorjs(SECRET_MARKER)
		self.lesson.instructor_notes = self.SECRET_NOTES
		self.lesson.save()
		self._create_chapter_reference(self.course.name, self.chapter.name, idx=1)
		self._create_lesson_reference(self.chapter.name, self.lesson.name)
		self._create_enrollment(self.student.email, self.course.name)

	def _get(self, user):
		frappe.session.user = user
		try:
			return get_lesson(self.course.name, 1, 1)
		finally:
			frappe.session.user = "Administrator"

	def test_enrolled_student_does_not_receive_instructor_content(self):
		result = self._get(self.student.email)
		self.assertEqual(result.get("title"), self.lesson.title)  # gate passed
		self.assertIsNone(result.get("instructor_content"))
		self.assertIsNone(result.get("instructor_notes"))

	def test_preview_guest_does_not_receive_instructor_content(self):
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		result = self._get("Guest")
		self.assertIsNone(result.get("instructor_content"))
		self.assertIsNone(result.get("instructor_notes"))

	def test_instructor_receives_instructor_content(self):
		result = self._get(self.instructor.email)
		self.assertIn(SECRET_MARKER, result.get("instructor_content") or "")
		self.assertEqual(result.get("instructor_notes"), self.SECRET_NOTES)
