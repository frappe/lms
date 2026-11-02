# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Course Lesson authoring is scoped to the authors of the lesson's course.

The has_permission hook let any Course Creator author any lesson, so the document API
inserted lessons into other instructors' courses that the per-course endpoints refuse.
"""

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLessonAuthoringScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"las-author-{hash}@example.com", "Ana", "Author", ["Course Creator"])
		cls.outsider = cls._create_user(
			f"las-outsider-{hash}@example.com", "Otto", "Outsider", ["Course Creator"]
		)
		cls.moderator = cls._create_user(f"las-mod-{hash}@example.com", "Mia", "Mod", ["Moderator"])
		cls._require_no_moderators(cls.author.name, cls.outsider.name)

		cls.course = cls._create_course(title=f"LAS Course {hash}", instructor=cls.author.name).name
		cls.chapter = cls._create_chapter(f"LAS Chapter {hash}", cls.course).name
		cls.own_course = cls._create_course(title=f"LAS Own {hash}", instructor=cls.outsider.name).name
		cls.own_chapter = cls._create_chapter(f"LAS Own Chapter {hash}", cls.own_course).name

	def _new_lesson(self, chapter, course):
		doc = frappe.new_doc("Course Lesson")
		doc.update(
			{
				"chapter": chapter,
				"course": course,
				"title": f"LAS Lesson {frappe.generate_hash(length=6)}",
				"content": '{"time":1,"blocks":[],"version":"2.29.0"}',
			}
		)
		return doc

	def _insert_as(self, user, chapter, course):
		frappe.set_user(user)
		return self._new_lesson(chapter, course).insert()

	def test_a_course_creator_cannot_insert_a_lesson_into_another_course(self):
		with self.assertRaises(frappe.PermissionError):
			self._insert_as(self.outsider.name, self.chapter, self.course)

	def test_naming_an_own_course_does_not_admit_another_courses_chapter(self):
		"""course is fetched from chapter after the create check, so the chapter decides."""
		with self.assertRaises(frappe.PermissionError):
			self._insert_as(self.outsider.name, self.chapter, self.own_course)

	def test_owning_a_lesson_in_another_course_grants_no_write(self):
		lesson = self._new_lesson(self.chapter, self.course).insert()
		frappe.db.set_value("Course Lesson", lesson.name, "owner", self.outsider.name, update_modified=False)

		frappe.set_user(self.outsider.name)
		self.assertFalse(frappe.has_permission("Course Lesson", "write", doc=lesson.name))

	def test_a_lesson_cannot_be_moved_into_another_courses_chapter(self):
		lesson = self._insert_as(self.outsider.name, self.own_chapter, self.own_course)
		lesson.chapter = self.chapter
		with self.assertRaises(frappe.PermissionError):
			lesson.save()

	def test_the_course_instructor_can_insert_a_lesson(self):
		lesson = self._insert_as(self.author.name, self.chapter, self.course)
		self.assertTrue(frappe.db.exists("Course Lesson", lesson.name))

	def test_a_moderator_can_insert_a_lesson_into_any_course(self):
		lesson = self._insert_as(self.moderator.name, self.chapter, self.course)
		self.assertTrue(frappe.db.exists("Course Lesson", lesson.name))
