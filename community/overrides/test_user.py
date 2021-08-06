# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

# import frappe
import unittest
import frappe

class TestCustomUser(unittest.TestCase):

    def test_with_basic_username(self):
        new_user = frappe.get_doc({
                        "doctype": "User",
                        "email": "test_with_basic_username@example.com",
                        "first_name": "Username"
                    }).insert()
        self.assertEqual(new_user.username, "username")

    def test_without_username(self):
        """ The user in this test has the same first name as the user of the test test_with_basic_username.
        In such cases frappe makes the username of the second user empty.
        The condition in community app should override this and save a username. """
        new_user = frappe.get_doc({
                        "doctype": "User",
                        "email": "test-without-username@example.com",
                        "first_name": "Username"
                    }).insert()
        self.assertTrue(new_user.username)

    def test_with_illegal_characters(self):
        new_user = frappe.get_doc({
                        "doctype": "User",
                        "email": "test_with_illegal_characters@example.com",
                        "first_name": "Username$$"
                    }).insert()
        self.assertEqual(new_user.username[:8], "username")

    def test_with_hyphen_at_end(self):
        new_user = frappe.get_doc({
                        "doctype": "User",
                        "email": "test_with_hyphen_at_end@example.com",
                        "first_name": "Username---"
                    }).insert()
        length = len(new_user.username)
        self.assertNotEqual(new_user.username[length-1], "-")

    @classmethod
    def tearDownClass(cls) -> None:
        users = [
                    "test_with_basic_username@example.com",
                    "test-without-username@example.com",
                    "test_with_illegal_characters@example.com",
                    "test_with_hyphen_at_end@example.com"
                ]
        frappe.db.delete("User", {"name": ["in", users]})
