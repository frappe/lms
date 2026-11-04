# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""get_lesson is guest-allowed and walks chapter and lesson indexes, so its locked and
no-preview answers named the lesson and course of an unpublished course to anyone."""

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_lesson


class TestLessonDraftDisclosure(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")

		cls.author = cls._create_user(f"ld-author-{hash}@example.com", "Ld", "Author", ["Course Creator"])
		cls.other_author = cls._create_user(f"ld-other-{hash}@example.com", "Ld", "Other", ["Course Creator"])
		cls.moderator = cls._create_user(f"ld-mod-{hash}@example.com", "Ld", "Mod", ["Moderator"])
		cls.student = cls._create_user(f"ld-stud-{hash}@example.com", "Ld", "Stud", ["LMS Student"])
		cls.enrolled = cls._create_user(f"ld-enr-{hash}@example.com", "Ld", "Enr", ["LMS Student"])

		cls.draft, cls.draft_lesson = cls._course_with_lesson(f"Lesson Draft {hash}")
		frappe.db.set_value("LMS Course", cls.draft.name, "published", 0)
		cls._create_enrollment(cls.enrolled.name, cls.draft.name)
		cls.live, cls.live_lesson = cls._course_with_lesson(f"Lesson Live {hash}")

	@classmethod
	def _course_with_lesson(cls, title):
		course = cls._create_course(title, instructor=cls.author.name)
		chapter = cls._create_chapter(f"{title} chapter", course.name)
		cls._create_chapter_reference(course.name, chapter.name)
		lesson = cls._create_lesson(f"{title} secret lesson", chapter.name, course.name)
		cls._create_lesson_reference(chapter.name, lesson.name)
		return course, lesson

	def lesson_as(self, user, course):
		frappe.set_user(user)
		try:
			return get_lesson(course, 1, 1) or {}
		finally:
			frappe.set_user("Administrator")

	def test_a_draft_lesson_is_not_described_to_guest_or_an_unrelated_user(self):
		"""Locked and no-preview answers named draft lessons since #713.
		Added for audit finding #81 on branch fix/draft-and-guest-disclosure."""
		for user in ("Guest", self.student.name, self.other_author.name):
			with self.subTest(user=user):
				response = self.lesson_as(user, self.draft.name)
				self.assertNotIn(self.draft_lesson.title, str(response))
				self.assertNotIn(self.draft.title, str(response))

	def test_a_draft_lesson_still_opens_for_its_author_moderator_and_learner(self):
		for user in (self.author.name, self.moderator.name, self.enrolled.name):
			with self.subTest(user=user):
				response = self.lesson_as(user, self.draft.name)
				self.assertEqual(response.get("title"), self.draft_lesson.title)
				self.assertNotIn("no_preview", response)

	def test_a_published_lesson_still_names_itself_to_guest(self):
		response = self.lesson_as("Guest", self.live.name)
		self.assertEqual(response.get("no_preview"), 1)
		self.assertEqual(response.get("course_title"), self.live.title)
