# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe

from lms.lms.api import delete_course
from lms.lms.test_helpers import BaseTestUtils


class TestLMSCourse(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)

	def test_new_course(self):
		course_name = f"Test Course {frappe.generate_hash()}"

		course = self._create_course(course_name)

		self.assertEqual(course.title, course_name)
		self.assertTrue(frappe.db.exists("LMS Course", course.name))

	def test_delete_course(self):
		course = self._create_course(f"Test Course {frappe.generate_hash()}")
		chapter = self._create_chapter(f"Test Chapter {frappe.generate_hash()}", course.name)
		lesson = self._create_lesson(f"Test Lesson {frappe.generate_hash()}", chapter.name, course.name)

		lesson_ref = self._create_lesson_reference(chapter.name, lesson.name)
		chapter_ref = self._create_chapter_reference(course.name, chapter.name)

		user_email = f"test_{frappe.generate_hash()}@example.com"
		self._create_user(user_email, "Test", "Member", ["LMS Student"])
		enrollment = self._create_enrollment(user_email, course.name)
		progress = self._create_progress(user_email, course.name, lesson.name)

		delete_course(course.name)

		self.assertFalse(frappe.db.exists("LMS Course", course.name))
		self.assertFalse(frappe.db.exists("Course Chapter", chapter.name))
		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertFalse(frappe.db.exists("LMS Enrollment", enrollment.name))
		self.assertFalse(frappe.db.exists("LMS Course Progress", {"course": course.name}))
		self.assertFalse(frappe.db.exists("Chapter Reference", {"parent": course.name}))
		self.assertFalse(frappe.db.exists("Lesson Reference", {"parent": chapter.name}))

		# remove from cleanup_items list since delete_course already deleted them
		self.cleanup_items.remove(("LMS Course", course.name))
		self.cleanup_items.remove(("LMS Enrollment", enrollment.name))
		self.cleanup_items.remove(("LMS Course Progress", progress.name))
		self.cleanup_items.remove(("Chapter Reference", chapter_ref.name))
		self.cleanup_items.remove(("Lesson Reference", lesson_ref.name))
		self.cleanup_items.remove(("Course Chapter", chapter.name))
		self.cleanup_items.remove(("Course Lesson", lesson.name))
