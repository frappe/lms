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

	def test_course_without_instructors_is_assigned_its_owner(self):
		# `instructors` is mandatory on LMS Course and validate_instructors() is
		# meant to fill it in with the owner when none is given. Every other test
		# here supplies instructors explicitly (BaseTestUtils._create_course does),
		# so this path had no coverage — and it is the path the course ZIP importer
		# takes, since create_course_doc() only appends what the archive declares.
		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": f"Test Course {frappe.generate_hash()}",
				"short_introduction": "Created without an instructor",
				"description": "The owner must be assigned as instructor automatically.",
			}
		)
		course.insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Course", course.name))

		self.assertEqual([row.instructor for row in course.instructors], [course.owner])

		# and it must be persisted, not only present on the in-memory document
		course.reload()
		self.assertEqual([row.instructor for row in course.instructors], [course.owner])

	def test_video_link_stored_as_entered(self):
		course = self._create_course(f"Test Course {frappe.generate_hash()}")

		# video_link is stored verbatim, with no stripping. The frontend normalizes
		# both full URLs and uploaded file paths for rendering.
		for link in (
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://www.youtube.com/embed/-LPmw2Znl2c",
			"https://youtu.be/dQw4w9WgXcQ",
			"/files/VID-20200313-WA0046.mp4",
			"/private/files/intro.mp4",
		):
			course.video_link = link
			course.save()
			self.assertEqual(course.video_link, link)

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
