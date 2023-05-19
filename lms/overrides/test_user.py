# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe

from lms.lms.doctype.lms_course.test_lms_course import new_user


class TestCustomUser(unittest.TestCase):
	def test_with_basic_username(self):
		user = new_user("Username", "test_with_basic_username@example.com")
		self.assertEqual(user.username, "username")

	def test_without_username(self):
		"""The user in this test has the same first name as the user of the test test_with_basic_username.
		In such cases frappe makes the username of the second user empty.
		The condition in lms app should override this and save a username."""
		user = new_user("Username", "test-without-username@example.com")
		self.assertTrue(user.username)

	def test_with_short_first_name(self):
		user = new_user("USN", "test_with_short_first_name@example.com")
		self.assertGreaterEqual(len(user.username), 4)

	@classmethod
	def tearDownClass(cls) -> None:
		users = [
			"test_with_basic_username@example.com",
			"test-without-username@example.com",
			"test_with_short_first_name@example.com",
		]
		frappe.db.delete("User", {"name": ["in", users]})
