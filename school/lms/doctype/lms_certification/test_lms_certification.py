# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
import unittest
from school.lms.doctype.lms_course.test_lms_course import new_course
from school.lms.doctype.lms_certification.lms_certification import create_certificate

class TestLMSCertification(unittest.TestCase):

    def setup(self):
        self.course = new_course("Test Certificate")

    def test_certificate_creation(self):
        self.certificate = create_certificate(self.course.name)
        self.assertEqual(self.certificate.student, "Administrator")
        self.assertEqual(self.certificate.course, self.course.name)
        self.assertEqual(self.certificate.issue_date, frappe.utils.nowdate())
        self.assertEqual(self.certificate.expiry_date, None)

    def tearDown(self):
        frappe.db.delete("LMS Course", self.course.name)
        frappe.db.delete("LMS Certification", self.certificate.name)

