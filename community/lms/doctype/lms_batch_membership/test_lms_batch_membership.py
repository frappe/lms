# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and Contributors
# See license.txt
from __future__ import unicode_literals

import frappe
import unittest

class TestLMSBatchMembership(unittest.TestCase):
    def setUp(self):
        frappe.db.sql("DELETE FROM `tabLMS Batch Membership`")
        frappe.db.sql("DELETE FROM `tabLMS Batch`")
        frappe.db.sql('delete from `tabLMS Course Mentor Mapping`')
        frappe.db.sql("DELETE FROM `tabLMS Course`")
        frappe.db.sql("DELETE FROM `tabUser` where email like '%@test.com'")

    def new_course_batch(self):
        course = frappe.get_doc({
            "doctype": "LMS Course",
            "name": "test-course",
            "title": "Test Course",
            "short_code": "XX"
        })
        course.insert()

        self.new_user("mentor@test.com", "Test Mentor")
        # without this, the creating batch will fail
        course.add_mentor("mentor@test.com")

        frappe.session.user = "mentor@test.com"

        batch = frappe.get_doc({
            "doctype": "LMS Batch",
            "name": "test-batch",
            "title": "Test Batch",
            "course": course.name
        })
        batch.insert(ignore_permissions=True)

        frappe.session.user = "Administrator"
        return course, batch

    def new_user(self, email="test@test.com", full_name="Test User"):
        user = frappe.get_doc({
            "doctype": "User",
            "name": email,
            "email": email,
            "first_name": full_name,
        })
        user.insert()
        return user

    def add_membership(self, batch_name, member_name, member_type="Student"):
        doc = frappe.get_doc({
            "doctype": "LMS Batch Membership",
            "batch": batch_name,
            "member": member_name,
            "member_type": member_type
        })
        doc.insert()
        return doc

    def test_membership(self):
        course, batch = self.new_course_batch()
        member = self.new_user("test01@test.com")
        membership = self.add_membership(batch.name, member.name)

        assert membership.course == course.name
        assert membership.member_name == member.full_name

    def test_membership_change_role(self):
        course, batch = self.new_course_batch()
        member = self.new_user("test01@test.com")
        membership = self.add_membership(batch.name, member.name)

        # it should be possible to change role
        membership.role = "Admin"
        membership.save()
