# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe

from lms.demo.demo_data import create_demo_data
from lms.lms.api import clear_demo_data
from lms.lms.test_helpers import BaseTestUtils

DEMO_INSTRUCTOR = "jannat@example.com"


class TestDemoData(BaseTestUtils):
	def setUp(self):
		super().setUp()
		clear_demo_data()
		self.real_user = self._create_user("real.user@example.com", "Real", "User", ["LMS Student"])
		self.real_user.db_set("user_image", "/files/real.png")

	def test_demo_data_leaves_existing_users_alone(self):
		"""create_instructor reused an arbitrary real user, set their photo and made them
		Moderator; clear_demo_data undid neither. Guards that a real user is untouched."""
		create_demo_data()

		self.assertEqual(frappe.db.get_value("User", self.real_user.name, "user_image"), "/files/real.png")
		self.assertNotIn("Moderator", frappe.get_roles(self.real_user.name))
		course = frappe.db.get_value("LMS Course", {"title": "A guide to Frappe Learning"})
		instructors = frappe.get_all("Course Instructor", {"parent": course}, pluck="instructor")
		self.assertEqual(instructors, [DEMO_INSTRUCTOR])

	def test_clear_demo_data_removes_the_demo_instructor(self):
		"""The instructor demo data creates must be one clear_demo_data deletes."""
		create_demo_data()
		self.assertTrue(frappe.db.exists("User", DEMO_INSTRUCTOR))
		clear_demo_data()

		self.assertFalse(frappe.db.exists("User", DEMO_INSTRUCTOR))
		self.assertTrue(frappe.db.exists("User", self.real_user.name))
