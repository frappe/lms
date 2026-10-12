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
