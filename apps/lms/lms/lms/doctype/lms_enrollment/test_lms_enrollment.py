# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe

from lms.lms.doctype.lms_course.test_lms_course import new_course, new_user


class TestLMSEnrollment(unittest.TestCase):
	def setUp(self):
		frappe.db.delete("LMS Enrollment")
		frappe.db.delete("LMS Batch Old")
		frappe.db.delete("LMS Course Mentor Mapping")
		frappe.db.delete("User", {"email": ("like", "%@test.com")})

	def new_course_batch(self):
		course = new_course("Test Course")

		new_user("Test Mentor", "mentor@test.com")
		# without this, the creating batch will fail
		course.add_mentor("mentor@test.com")

		frappe.session.user = "mentor@test.com"

		batch = frappe.get_doc(
			{
				"doctype": "LMS Batch Old",
				"name": "test-batch",
				"title": "Test Batch",
				"course": course.name,
			}
		)
		batch.insert(ignore_permissions=True)

		frappe.session.user = "Administrator"
		return course, batch

	def add_membership(self, batch_name, member_name, course, member_type="Student"):
		doc = frappe.get_doc(
			{
				"doctype": "LMS Enrollment",
				"batch_old": batch_name,
				"member": member_name,
				"member_type": member_type,
				"course": course,
			}
		)
		doc.insert()
		return doc

	def test_membership(self):
		course, batch = self.new_course_batch()
		member = new_user("Test", "test01@test.com")
		membership = self.add_membership(batch.name, member.name, course.name)

		assert membership.course == course.name
		assert membership.member_name == member.full_name

	def test_membership_change_role(self):
		course, batch = self.new_course_batch()
		member = new_user("Test", "test01@test.com")
		membership = self.add_membership(batch.name, member.name, course.name)

		# it should be possible to change role
		membership.role = "Admin"
		membership.save()
