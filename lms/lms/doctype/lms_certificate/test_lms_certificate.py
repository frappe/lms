# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

from unittest.mock import MagicMock, patch

import frappe

from lms.lms.doctype.lms_certificate.lms_certificate import (
	create_certificate,
	LMSCertificate,
)
from lms.lms.test_helpers import BaseTestUtils


class TestLMSCertificate(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.student = self._create_user(
			"test.cert.student@example.com", "Cert", "Student", ["LMS Student"]
		)
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self.course = self._create_course(title=f"Cert Test Course {frappe.generate_hash()[:6]}")
		self.batch = self._create_batch(self.course.name, title=f"Cert Test Batch {frappe.generate_hash()[:6]}")

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_send_mail_includes_batch_context(self):
		"""Verify that send_mail passes batch_name and batch_title in template args."""
		cert = frappe.new_doc("LMS Certificate")
		cert.member = self.student.name
		cert.member_name = "Cert Student"
		cert.course = self.course.name
		cert.batch_name = self.batch.name
		cert.template = "certification"

		with patch("frappe.sendmail") as mock_sendmail:
			cert.send_mail()
			self.assertTrue(mock_sendmail.called)
			_, kwargs = mock_sendmail.call_args
			args = kwargs.get("args", {})
			self.assertEqual(args.get("batch_name"), self.batch.name)
			self.assertEqual(args.get("batch_title"), self.batch.title)
			self.assertEqual(args.get("course_name"), self.course.name)

	def test_create_certificate_persists_batch_from_enrollment(self):
		"""Verify create_certificate copies enrollment_from_batch onto LMS Certificate."""
		frappe.set_user(self.student.name)

		# Create enrollment associated with the batch
		enrollment = self._create_enrollment(self.student.name, self.course.name)
		enrollment.enrollment_from_batch = self.batch.name
		enrollment.progress = 100
		enrollment.save()

		# Enable certification on course
		frappe.db.set_value("LMS Course", self.course.name, "enable_certification", 1)

		cert = create_certificate(self.course.name)
		self.cleanup_items.append(("LMS Certificate", cert.name))

		self.assertEqual(cert.course, self.course.name)
		self.assertEqual(cert.member, self.student.name)
		self.assertEqual(cert.batch_name, self.batch.name)

	def test_create_certificate_without_batch_enrollment(self):
		"""Verify regular course enrollment creates certificate with no batch_name."""
		frappe.set_user(self.student.name)

		enrollment = self._create_enrollment(self.student.name, self.course.name)
		enrollment.enrollment_from_batch = None
		enrollment.progress = 100
		enrollment.save()

		frappe.db.set_value("LMS Course", self.course.name, "enable_certification", 1)

		cert = create_certificate(self.course.name)
		self.cleanup_items.append(("LMS Certificate", cert.name))

		self.assertEqual(cert.course, self.course.name)
		self.assertIsNone(cert.batch_name)

	def test_validate_criteria_enforces_course_progress_with_batch(self):
		"""Verify course progress validation is not bypassed when batch_name is set."""
		cert = frappe.new_doc("LMS Certificate")
		cert.member = self.student.name
		cert.course = self.course.name
		cert.batch_name = self.batch.name
		cert.template = "certification"

		# Enroll in batch
		batch_enrollment = frappe.get_doc(
			{
				"doctype": "LMS Batch Enrollment",
				"batch": self.batch.name,
				"member": self.student.name,
			}
		)
		batch_enrollment.save(ignore_permissions=True)
		self.cleanup_items.append(("LMS Batch Enrollment", batch_enrollment.name))

		# Enroll in course with progress < 100 and certification enabled
		enrollment = self._create_enrollment(self.student.name, self.course.name)
		enrollment.progress = 50
		enrollment.save()
		frappe.db.set_value("LMS Course", self.course.name, "enable_certification", 1)

		with self.assertRaises(frappe.ValidationError):
			cert.validate_criteria()

	def test_validate_batch_duplicates_allows_multiple_courses_in_same_batch(self):
		"""Verify course certificates in the same batch do not trigger batch duplicate errors."""
		second_course = self._create_course(title=f"Second Course {frappe.generate_hash()[:6]}")

		# Existing certificate for course 1 in batch
		cert1 = frappe.new_doc("LMS Certificate")
		cert1.member = self.student.name
		cert1.course = self.course.name
		cert1.batch_name = self.batch.name
		cert1.template = "certification"
		cert1.save(ignore_permissions=True)
		self.cleanup_items.append(("LMS Certificate", cert1.name))

		# Second certificate for course 2 in same batch should not raise batch duplicate
		cert2 = frappe.new_doc("LMS Certificate")
		cert2.member = self.student.name
		cert2.course = second_course.name
		cert2.batch_name = self.batch.name
		cert2.template = "certification"

		# Should not throw duplicate error
		cert2.validate_batch_duplicates()
