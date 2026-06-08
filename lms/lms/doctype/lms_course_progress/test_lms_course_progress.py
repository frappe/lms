# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSCourseProgress(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.admin = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self.student = self._create_user("student@example.com", "Test", "Student", ["LMS Student"])
		self.course = self._create_course()

		self.lessons = []
		for i in range(1, 3):
			chapter = self._create_chapter(f"Chapter {i}", self.course.name)
			self._create_chapter_reference(self.course.name, chapter.name, idx=i)
			for j in range(1, 3):
				lesson = self._create_lesson(f"Lesson {i}.{j}", chapter.name, self.course.name)
				self._create_lesson_reference(chapter.name, lesson.name)
				self.lessons.append(lesson)

		self.enrollment = self._create_enrollment(self.student.email, self.course.name)

	def test_manual_progress_recalculates_enrollment(self):
		"""Creating a course progress (desk) must update the enrollment progress"""
		self._create_lesson_progress(self.student.email, self.course.name, self.lessons[0].name)
		self._create_lesson_progress(self.student.email, self.course.name, self.lessons[1].name)

		self.enrollment.reload()
		self.assertEqual(self.enrollment.progress, 50)

		self._create_lesson_progress(self.student.email, self.course.name, self.lessons[2].name)
		self._create_lesson_progress(self.student.email, self.course.name, self.lessons[3].name)

		self.enrollment.reload()
		self.assertEqual(self.enrollment.progress, 100)

	def test_duplicate_progress_is_rejected(self):
		"""Duplicate progress row for the same (member, lesson) not allowed"""
		self._create_lesson_progress(self.student.email, self.course.name, self.lessons[0].name)

		lms_course_progress = frappe.new_doc("LMS Course Progress")
		lms_course_progress.update(
			{
				"member": self.student.email,
				"course": self.course.name,
				"lesson": self.lessons[0].name,
				"status": "Complete",
			}
		)
		with self.assertRaises(frappe.UniqueValidationError):
			lms_course_progress.insert(ignore_permissions=True)

		count = frappe.db.count(
			"LMS Course Progress",
			{"member": self.student.email, "lesson": self.lessons[0].name},
		)
		self.assertEqual(count, 1)

		self.enrollment.reload()
		self.assertEqual(self.enrollment.progress, 25)
