# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSCourse(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)

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
