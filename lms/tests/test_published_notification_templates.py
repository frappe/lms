import re

import frappe

from lms.lms.test_helpers import BaseTestUtils

TEMPLATES = ("published_course_notification", "published_batch_notification")


class TestPublishedNotificationTemplates(BaseTestUtils):
	def _render(self, template, instructor):
		return frappe.render_template(
			f"templates/emails/{template}.html",
			{
				"brand_name": "LMS",
				"title": "Published Thing",
				"instructors": [instructor],
				"course_url": "/lms/courses/x",
				"batch_url": "/lms/batches/x",
				"start_date": "2026-10-04",
				"end_date": "2026-10-05",
				"start_time": "10:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
			},
		)

	def test_instructor_without_image_gets_their_initial(self):
		"""`full_name.split("")` raised "empty separator" since #1971.
		Added for audit finding #96."""
		for template in TEMPLATES:
			with self.subTest(template=template):
				html = self._render(template, frappe._dict(full_name="ada lovelace", user_image=None))
				initial = re.search(r'color: #fff;">\s*(\S*)\s*</span>', html).group(1)
				self.assertEqual(initial, "A")

	def test_instructor_without_image_or_name_still_renders(self):
		"""Regression from #1971 as above, for a user with no full name. Audit finding #96."""
		for template in TEMPLATES:
			with self.subTest(template=template):
				self._render(template, frappe._dict(full_name=None, user_image=None))
