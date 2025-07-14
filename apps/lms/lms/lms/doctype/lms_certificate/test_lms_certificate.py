# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe
from frappe.utils import add_years, cint, nowdate

from lms.lms.doctype.lms_certificate.lms_certificate import create_certificate
from lms.lms.doctype.lms_course.test_lms_course import new_course


class TestLMSCertificate(unittest.TestCase):
	def test_certificate_creation(self):
		course = new_course(
			"Test Certificate",
			{
				"enable_certification": 1,
			},
		)
		certificate = create_certificate(course.name)

		self.assertEqual(certificate.member, "Administrator")
		self.assertEqual(certificate.course, course.name)
		self.assertEqual(certificate.issue_date, nowdate())

		frappe.db.delete("LMS Certificate", certificate.name)
		frappe.db.delete("LMS Course", course.name)
