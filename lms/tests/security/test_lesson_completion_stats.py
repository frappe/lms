# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Lesson completion stats are for the course's authors and Moderators, not for
every holder of a role."""

import frappe

from lms.lms.api import get_lesson_completion_stats
from lms.lms.test_helpers import BaseTestUtils


class TestLessonCompletionStats(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"lcs-auth-{hash}@example.com", "Au", "Thor", ["Course Creator"]).name
		cls.other_creator = cls._create_user(
			f"lcs-other-{hash}@example.com", "Ot", "Her", ["Course Creator"]
		).name
		cls.moderator = cls._create_user(f"lcs-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.student = cls._create_user(f"lcs-stud-{hash}@example.com", "St", "Udent", ["LMS Student"]).name
		cls._require_no_moderators(cls.author, cls.other_creator)
		cls.course = cls._create_course(title=f"Stats Course {hash}", instructor=cls.author).name
		chapter = cls._create_chapter(f"Chapter {hash}", cls.course).name
		cls.lesson = cls._create_lesson(f"Lesson {hash}", chapter, cls.course).name
		cls._create_chapter_reference(cls.course, chapter)
		cls._create_lesson_reference(chapter, cls.lesson)

	def test_only_the_courses_authors_and_moderators_read_them(self):
		for user in (self.other_creator, self.student):
			with self.subTest(user=user):
				frappe.set_user(user)
				with self.assertRaises(frappe.PermissionError):
					get_lesson_completion_stats(self.course)
		for user in (self.author, self.moderator):
			with self.subTest(user=user):
				frappe.set_user(user)
				rows = get_lesson_completion_stats(self.course)
				self.assertEqual([row.lesson_name for row in rows], [self.lesson])
