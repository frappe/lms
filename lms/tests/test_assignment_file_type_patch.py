from contextlib import contextmanager
from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v0_0.assignment_file_type import execute


@contextmanager
def course_lesson_without_columns():
	"""Shadow `tabCourse Lesson` with a session-only table that lacks `file_type` and `question`.
	Other connections and information_schema cannot see it, so has_column asks this session."""
	cursor = frappe.db._cursor
	cursor.execute("create temporary table `tabCourse Lesson` (name varchar(140) primary key)")

	def has_column(doctype, column):
		cursor.execute(f"show columns from `tab{doctype}` like %s", (column,))
		return bool(cursor.fetchall())

	try:
		with patch.object(frappe.db, "has_column", side_effect=has_column):
			yield
	finally:
		cursor.execute("drop temporary table if exists `tabCourse Lesson`")


class TestAssignmentFileTypePatch(BaseTestUtils):
	"""Regression: the pre-sync patch (#458) read Course Lesson columns without a reload.
	Added for audit finding #54."""

	def setUp(self):
		super().setUp()
		reload_doc = patch("frappe.reload_doc")
		self.reload_doc = reload_doc.start()
		self.addCleanup(reload_doc.stop)

	def test_runs_on_a_site_without_the_columns(self):
		with course_lesson_without_columns():
			execute()

	def test_reloads_course_lesson_before_reading_it(self):
		execute()
		self.reload_doc.assert_any_call("lms", "doctype", "course_lesson")

	def test_clears_file_type_only_on_lessons_without_a_question(self):
		instructor = self._create_user(
			"file-type-patch-instructor@example.com", "Instructor", "Test", ["Course Creator"]
		)
		course = self._create_course(
			title=f"File Type Patch {frappe.generate_hash(length=6)}", instructor=instructor.email
		)
		chapter = self._create_chapter(None, course.name)
		with_question = self._create_lesson("With question", chapter.name, course.name)
		without_question = self._create_lesson("Without question", chapter.name, course.name)
		frappe.db.set_value(
			"Course Lesson", with_question.name, {"file_type": "PDF", "question": "Upload it"}
		)
		frappe.db.set_value("Course Lesson", without_question.name, {"file_type": "PDF", "question": ""})

		execute()

		self.assertEqual(frappe.db.get_value("Course Lesson", with_question.name, "file_type"), "PDF")
		self.assertFalse(frappe.db.get_value("Course Lesson", without_question.name, "file_type"))
