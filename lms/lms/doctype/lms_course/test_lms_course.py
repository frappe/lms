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


class TestLMSCourseInstructors(BaseTestUtils):
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
