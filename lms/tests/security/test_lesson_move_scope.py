# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Lesson moves and chapter edits are authorised against the course that owns each end."""

import frappe

from lms.lms.api import update_lesson_index, upsert_chapter
from lms.lms.test_helpers import BaseTestUtils


class TestLessonMoveScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(
			f"lms-mv-author-{hash}@example.com", "Ana", "Author", ["Course Creator"]
		)
		cls.victim = cls._create_user(
			f"lms-mv-victim-{hash}@example.com", "Vic", "Victim", ["Course Creator"]
		)
		cls.student = cls._create_user(
			f"lms-mv-student-{hash}@example.com", "Sam", "Student", ["LMS Student"]
		)

		cls.own_course = cls._create_course(title=f"Move Own {hash}", instructor=cls.author.name).name
		cls.other_course = cls._create_course(title=f"Move Other {hash}", instructor=cls.victim.name).name
		cls.own_chapter = cls._create_chapter(f"Move Own Ch {hash}", cls.own_course).name
		cls.own_second_chapter = cls._create_chapter(f"Move Own Ch2 {hash}", cls.own_course).name
		cls.other_chapter = cls._create_chapter(f"Move Other Ch {hash}", cls.other_course).name

		cls.own_lesson = cls._create_lesson(f"Move Own Lesson {hash}", cls.own_chapter, cls.own_course).name
		cls._create_lesson_reference(cls.own_chapter, cls.own_lesson)

	def _references(self, chapter):
		return frappe.get_all("Lesson Reference", {"parent": chapter}, pluck="lesson")

	def _move(self, user, target, source=None):
		frappe.set_user(user)
		update_lesson_index(self.own_lesson, source or self.own_chapter, target, 0)

	def test_a_lesson_cannot_be_moved_into_another_courses_chapter(self):
		with self.assertRaises(frappe.PermissionError):
			self._move(self.author.name, self.other_chapter)

		frappe.set_user("Administrator")
		self.assertIn(self.own_lesson, self._references(self.own_chapter))
		self.assertNotIn(self.own_lesson, self._references(self.other_chapter))

	def test_a_lesson_cannot_be_moved_into_a_missing_chapter(self):
		with self.assertRaises(frappe.DoesNotExistError):
			self._move(self.author.name, "no-such-chapter")

		frappe.set_user("Administrator")
		self.assertIn(self.own_lesson, self._references(self.own_chapter))

	def test_non_authors_cannot_move_a_lesson(self):
		for user in (self.victim.name, self.student.name, "Guest"):
			with self.subTest(user=user), self.assertRaises(frappe.PermissionError):
				self._move(user, self.own_second_chapter)

	def test_an_author_can_move_a_lesson_between_their_own_chapters(self):
		self._move(self.author.name, self.own_second_chapter)

		frappe.set_user("Administrator")
		self.assertNotIn(self.own_lesson, self._references(self.own_chapter))
		self.assertIn(self.own_lesson, self._references(self.own_second_chapter))

	def _upsert(self, user, name, course, title="Retitled"):
		frappe.set_user(user)
		return upsert_chapter(title=title, course=course, is_scorm_package=False, name=name)

	def test_another_courses_chapter_cannot_be_edited_by_naming_your_own_course(self):
		with self.assertRaises(frappe.PermissionError):
			self._upsert(self.author.name, self.other_chapter, self.own_course)

		frappe.set_user("Administrator")
		stored = frappe.db.get_value("Course Chapter", self.other_chapter, ["title", "course"], as_dict=True)
		self.assertEqual(stored.course, self.other_course)
		self.assertNotEqual(stored.title, "Retitled")

	def test_an_author_can_retitle_their_own_chapter(self):
		self._upsert(self.author.name, self.own_chapter, self.own_course, title="Own Retitled")

		frappe.set_user("Administrator")
		self.assertEqual(frappe.db.get_value("Course Chapter", self.own_chapter, "title"), "Own Retitled")
