# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_course_details


class TestCourseIcon(BaseTestUtils):
	"""A course thumbnail icon is any plausible lucide name, or empty."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		instructor = self._create_user(f"icon-instr-{hash}@example.com", "Ivy", "Instr", ["Course Creator"])
		self.course = self._create_course(title=f"Icon Course {hash}", instructor=instructor.name)

	def test_saves_an_allowed_icon(self):
		self.course.icon = "rocket"
		self.course.save()
		self.assertEqual(frappe.db.get_value("LMS Course", self.course.name, "icon"), "rocket")

	def test_saves_any_lucide_name(self):
		for name in ("chart-no-axes-column", "dice-6", "rocket"):
			self.course.icon = name
			self.course.save()
			self.assertEqual(frappe.db.get_value("LMS Course", self.course.name, "icon"), name)

	def test_rejects_what_is_not_an_icon_name(self):
		for value in ("Rocket", "lucide rocket", "rocket-", "-rocket", "a--b", "<svg>", "a" * 65):
			self.course.icon = value
			with self.assertRaises(frappe.ValidationError, msg=value):
				self.course.save()

	def test_trims_and_allows_empty(self):
		self.course.icon = "  globe "
		self.course.save()
		self.assertEqual(self.course.icon, "globe")
		self.course.icon = ""
		self.course.save()
		self.assertEqual(self.course.icon, "")

	def test_course_details_carry_the_icon(self):
		self.course.icon = "telescope"
		self.course.save()
		self.assertEqual(get_course_details(self.course.name).icon, "telescope")
