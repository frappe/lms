import json

import frappe

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


class TestLessonInstructorContentLeak(BaseTestUtils):
	"""get_lesson must not return instructor-only fields to students or preview guests."""

	SECRET_NOTES = "GRADING-NOTES-be-strict"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"instr-{hash}@example.com", "Ada", "Instr", ["Course Creator", "Moderator"]
		)
		cls.student = cls._create_user(f"stud-{hash}@example.com", "Sam", "Student", ["LMS Student"])

		cls.course = cls._create_course(title=f"Leak Course {hash}", instructor=cls.instructor.email)
		cls.chapter = cls._create_chapter(f"Chapter {hash}", cls.course.name)
		cls.lesson = cls._create_lesson(f"Lesson {hash}", cls.chapter.name, cls.course.name)
		# Preview + instructor-only content (content fields are EditorJS JSON blobs).
		cls.lesson.include_in_preview = 1
		cls.lesson.instructor_content = _editorjs(SECRET_MARKER)
		cls.lesson.instructor_notes = cls.SECRET_NOTES
		cls.lesson.save()
		cls._create_chapter_reference(cls.course.name, cls.chapter.name, idx=1)
		cls._create_lesson_reference(cls.chapter.name, cls.lesson.name)
		cls._create_enrollment(cls.student.email, cls.course.name)

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
