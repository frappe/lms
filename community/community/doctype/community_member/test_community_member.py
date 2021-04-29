# -*- coding: utf-8 -*-
# Copyright (c) 2021, Frappe and Contributors
# See license.txt
from __future__ import unicode_literals
from community.lms.doctype.lms_course.test_lms_course import new_user
import frappe
import unittest

class TestCommunityMember(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        users = ["test_user@example.com","test_user1@example.com"]

        for user in users:
            if not frappe.db.exists("User", user):
                new_user("Test User", user)

    def test_member_created_from_user(self):
        user = frappe.db.get_value("User","test_user@example.com", ["full_name", "email", "username"], as_dict=True)
        self.assertTrue(frappe.db.exists("Community Member", {"username":user.username}))

        member = frappe.db.get_value("Community Member",
                        filters={"email": user.email},
                        fieldname=["full_name", "email", "owner", "username", "route"],
                        as_dict=True
                    )

        self.assertEqual(user.full_name, member.full_name)
        self.assertEqual(member.owner, user.email)
        self.assertEqual(user.username, member.username)
        self.assertEqual(member.username, member.route)
        
    def test_members_with_same_name(self):
        user1 = frappe.db.get_value("User","test_user@example.com", ["email"], as_dict=True)
        user2 = frappe.get_doc("User","test_user1@example.com", ["email"], as_dict=True)

        self.assertTrue(frappe.db.exists("Community Member", {"email": user1.email} ))
        self.assertTrue(frappe.db.exists("Community Member", {"email": user2.email }))

        member1 = frappe.db.get_value("Community Member",
                        filters={"email": user1.email},
                        fieldname=["full_name", "email", "owner", "username", "route"],
                        as_dict=True
                    )
        member2 = frappe.db.get_value("Community Member",
                        filters={"email": user2.email},
                        fieldname=["full_name", "email", "owner", "username", "route"],
                        as_dict=True
                    )

        self.assertEqual(member1.full_name, member2.full_name)
        self.assertEqual(member1.email, user1.email)
        self.assertEqual(member2.email, user2.email)
        self.assertNotEqual(member1.username, member2.username)

    def test_username_validations(self):
        user = new_user("Tst", "tst@example.com")
        self.assertTrue(frappe.db.exists("Community Member", {"email":user.email} ))

        member = frappe.db.get_value("Community Member",
                        filters={"email": user.email},
                        fieldname=["username"],
                        as_dict=True
                    )

        self.assertEqual(len(member.username), 4)
        frappe.delete_doc("User", user.email)

    def test_user_without_username(self):
        user = new_user("Test User", "test_user2@example.com")
        self.assertTrue(frappe.db.exists("Community Member", {"email":user.email} ))

        member = frappe.db.get_value("Community Member",
                        filters={"email": user.email},
                        fieldname=["username"],
                        as_dict=True
                    )

        self.assertTrue(member.username)
        frappe.delete_doc("User", user.email)

    @classmethod
    def tearDownClass(self):
        users = ["test_user@example.com","test_user1@example.com"]

        for user in users:
            if frappe.db.exists("User", user):
                frappe.delete_doc("User", user)

            if frappe.db.exists("Community Member", {"email": user}):
                frappe.delete_doc("Community Member", {"email": user})