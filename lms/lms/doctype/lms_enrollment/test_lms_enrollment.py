# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe

from lms.lms.doctype.lms_course.test_lms_course import new_course, new_user


class TestLMSEnrollment(unittest.TestCase):
	def test_membership(self):
		course = new_course("Test Enrollment")
		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.course = course.name
		enrollment.member = frappe.session.user

		enrollment.save()

		self.assertEqual(enrollment.course, course.name)
		self.assertEqual(enrollment.member, "Administrator")
		frappe.db.delete("LMS Enrollment", enrollment.name)
		frappe.db.delete("LMS Course", course.name)
