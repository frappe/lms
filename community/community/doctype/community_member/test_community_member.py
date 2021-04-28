# -*- coding: utf-8 -*-
# Copyright (c) 2021, Frappe and Contributors
# See license.txt
from __future__ import unicode_literals
from community.lms.doctype.lms_course.test_lms_course import new_user
import frappe
import unittest

class TestCommunityMember(unittest.TestCase):
	
	def test_member_created_from_user(self):
		user = new_user("Test User", "test_user@example.com")
		member = frappe.get_doc("Community Member", {"email": "test_user@example.com"})
		self.assertEqual(user.full_name, member.full_name)
		self.assertEqual(member.owner, user.email)
		self.assertEqual(user.username, member.username)
		self.assertEqual(member.username, member.route)
