# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe


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
