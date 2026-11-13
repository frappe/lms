from unittest.mock import patch

import frappe

from lms.lms.doctype.lms_batch_enrollment import lms_batch_enrollment
from lms.lms.test_helpers import BaseTestUtils


class TestBatchEnrollmentConfirmationEmail(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		self._create_evaluator()
		course = self._create_course(title="Batch Email Course 2452")
		self.batch = self._create_batch(course.name, title="Batch Email 2452")
		self.member = self._create_user("be2452@example.com", "Batch", "Enrollee", ["LMS Student"])

	def test_enrollment_survives_a_failing_confirmation_email(self):
		"""#2452: an email that failed to render rolled back the whole enrolment.
		Guards that the member stays enrolled and the email stays unsent for a resend."""
		with (
			patch.dict(frappe.conf, {"mail_login": "dummy@example.com"}),
			patch.object(lms_batch_enrollment, "send_mail", side_effect=Exception("render failed")),
		):
			enrollment = self._create_batch_enrollment(self.member.name, self.batch.name)

		self.assertTrue(frappe.db.exists("LMS Batch Enrollment", enrollment.name))
		self.assertFalse(
			frappe.db.get_value("LMS Batch Enrollment", enrollment.name, "confirmation_email_sent")
		)

	def test_a_sent_email_is_still_marked_sent(self):
		with (
			patch.dict(frappe.conf, {"mail_login": "dummy@example.com"}),
			patch.object(lms_batch_enrollment, "send_mail") as send_mail,
		):
			enrollment = self._create_batch_enrollment(self.member.name, self.batch.name)

		send_mail.assert_called_once()
		self.assertTrue(
			frappe.db.get_value("LMS Batch Enrollment", enrollment.name, "confirmation_email_sent")
		)

	def test_a_failed_attempt_is_rolled_back_and_logged_with_its_traceback(self):
		"""Review finding D2: the catch kept what the attempt had written and replaced
		the traceback with a summary."""

		def write_then_fail(doc):
			frappe.db.set_value(doc.doctype, doc.name, "confirmation_email_sent", 1)
			raise Exception("render failed")

		with (
			patch.dict(frappe.conf, {"mail_login": "dummy@example.com"}),
			patch.object(lms_batch_enrollment, "send_mail", side_effect=write_then_fail),
		):
			enrollment = self._create_batch_enrollment(self.member.name, self.batch.name)

		self.assertFalse(
			frappe.db.get_value("LMS Batch Enrollment", enrollment.name, "confirmation_email_sent")
		)
		error = frappe.get_last_doc(
			"Error Log", {"reference_doctype": "LMS Batch Enrollment", "reference_name": enrollment.name}
		)
		self.assertIn("render failed", error.error)

	def test_the_desk_resend_reports_its_failure(self):
		"""Review finding D1: the catch sat in the whitelisted method, so the desk's
		Send Confirmation Email button failed without a word."""
		with patch.object(lms_batch_enrollment, "send_mail"):
			enrollment = self._create_batch_enrollment(self.member.name, self.batch.name)
		with (
			patch.dict(frappe.conf, {"mail_login": "dummy@example.com"}),
			patch.object(lms_batch_enrollment, "send_mail", side_effect=Exception("render failed")),
			self.assertRaises(Exception) as caught,
		):
			lms_batch_enrollment.send_confirmation_email(enrollment)
		self.assertIn("render failed", str(caught.exception))
