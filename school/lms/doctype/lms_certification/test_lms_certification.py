# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
import unittest
from school.lms.doctype.lms_course.test_lms_course import new_course
from school.lms.doctype.lms_certification.lms_certification import create_certificate

class TestLMSCertification(unittest.TestCase):

    def test_certificate_creation(self):
        course = new_course("Test Certificate", 1)
        certificate = create_certificate(course.name)

        self.assertEqual(certificate.student, "Administrator")
        self.assertEqual(certificate.course, course.name)
        self.assertEqual(certificate.issue_date, frappe.utils.nowdate())
        self.assertEqual(certificate.expiry_date, None)

        frappe.db.delete("LMS Course", course.name)
        frappe.db.delete("LMS Certification", certificate.name)
