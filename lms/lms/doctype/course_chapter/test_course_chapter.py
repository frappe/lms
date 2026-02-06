# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe

from lms.lms.api import delete_chapter
from lms.lms.test_helpers import BaseTestUtils


class TestCourseChapter(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)

	def tearDown(self):
		return super().tearDown()

	def test_chapter_deletion_and_renumbering(self):
		course = self._create_course(f"Test Renumbering Course {frappe.generate_hash()[:8]}")
		chapters = []

		for i in range(1, 4):
			chapter = self._create_chapter(f"Chapter {i}", course.name)
			chapters.append(chapter)
			self._create_chapter_reference(course.name, chapter.name, i)
			self.assertEqual(self._get_chapter_index(course.name, chapter.name), i)

		delete_chapter(chapters[1].name)

		idx_ch1 = self._get_chapter_index(course.name, chapters[0].name)
		idx_ch3 = self._get_chapter_index(course.name, chapters[2].name)

		self.assertEqual(idx_ch1, 1, "Chapter 1 index should remain 1")
		self.assertEqual(idx_ch3, 2, "Chapter 3 index should be renumbered to 2 after deleting Chapter 2")

	def _get_chapter_index(self, course, chapter):
		return frappe.db.get_value("Chapter Reference", {"parent": course, "chapter": chapter}, "idx")
