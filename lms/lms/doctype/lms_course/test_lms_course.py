# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSCourse(unittest.TestCase):
	def test_video_link_stored_as_entered(self):
		# validate_video_link is a no-op by design: reducing a URL to a bare id mangled
		# uploaded /files paths and broke some YouTube urls. Calling it on an unsaved
		# doc proves the contract without five save() round-trips.
		course = frappe.new_doc("LMS Course")
		for link in (
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://www.youtube.com/embed/-LPmw2Znl2c",
			"https://youtu.be/dQw4w9WgXcQ",
			"/files/VID-20200313-WA0046.mp4",
			"/private/files/intro.mp4",
		):
			course.video_link = link
			course.validate_video_link()
			self.assertEqual(course.video_link, link)


def _new_course(instructors):
	return frappe.get_doc(
		{
			"doctype": "LMS Course",
			"title": f"Course {frappe.generate_hash(length=8)}",
			"short_introduction": "Course for duplicate instructor tests",
			"description": "Course for duplicate instructor tests",
			"instructors": [{"instructor": instructor} for instructor in instructors],
		}
	)


class TestLMSCourseInstructors(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			f"course-instructor-{frappe.generate_hash(length=8)}@example.com",
			"Chandru",
			"Course",
			["Course Creator"],
		)

	def test_single_instructor_is_accepted(self):
		course = _new_course([self.instructor.name]).insert()
		self.assertEqual([row.instructor for row in course.instructors], [self.instructor.name])

	def test_duplicate_instructor_rejected_on_insert(self):
		course = _new_course([self.instructor.name, self.instructor.name])
		with self.assertRaisesRegex(frappe.ValidationError, "Chandru Course"):
			course.insert()

	def test_duplicate_instructor_rejected_on_save(self):
		course = _new_course([self.instructor.name]).insert()
		course.append("instructors", {"instructor": self.instructor.name})
		with self.assertRaisesRegex(frappe.ValidationError, "Chandru Course"):
			course.save()

	def test_course_without_instructors_is_assigned_its_owner(self):
		# `instructors` is mandatory on LMS Course and validate_instructors() is
		# meant to fill it in with the owner when none is given. BaseTestUtils'
		# _create_course always supplies instructors, so this path had no coverage,
		# and it is the path the course ZIP importer takes, since
		# create_course_doc() only appends what the archive declares.
		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": f"Test Course {frappe.generate_hash()}",
				"short_introduction": "Created without an instructor",
				"description": "The owner must be assigned as instructor automatically.",
			}
		)
		course.insert()

		self.assertEqual([row.instructor for row in course.instructors], [course.owner])

		# and it must be persisted, not only present on the in-memory document
		course.reload()
		self.assertEqual([row.instructor for row in course.instructors], [course.owner])


class TestPublishWarnsAboutEmptyQuizzes(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.course = _new_course(["Administrator"]).insert()
		chapter = self._create_chapter("Publish Warning Chapter", self.course.name)
		self.quiz = self._create_quiz([], title=f"Unfilled Quiz {frappe.generate_hash(length=6)}")
		content = frappe.as_json({"blocks": [{"type": "quiz", "data": {"quiz": self.quiz.name}}]})
		self._create_lesson("Publish Warning Lesson", chapter.name, self.course.name, content)
		self.course.reload()
		frappe.clear_messages()

	def _publish(self):
		self.course.published = 1
		self.course.save()

	def test_publishing_lists_quizzes_without_questions(self):
		self._publish()

		self.assertEqual(self.course.get_onload("quizzes_without_questions"), [self.quiz.title])
		self.assertIn(self.quiz.title, frappe.as_json(frappe.message_log))

	def test_saving_an_already_published_course_does_not_warn_again(self):
		self._publish()
		frappe.clear_messages()
		self.course.reload()
		self.course.description = "Edited after publishing"
		self.course.save()

		self.assertEqual(frappe.message_log, [])
