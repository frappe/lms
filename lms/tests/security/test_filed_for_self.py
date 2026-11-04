import os
from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestFiledForSelf(BaseTestUtils):
	"""A job application and batch feedback are filed by the user they name."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"ffs-stud-{cls.hash}@example.com", "Ffs", "Student", ["LMS Student"])
		cls.victim = cls._create_user(f"ffs-vict-{cls.hash}@example.com", "Ffs", "Victim", ["LMS Student"])
		cls.moderator = cls._create_user(f"ffs-mod-{cls.hash}@example.com", "Ffs", "Moderator", ["Moderator"])
		course = cls._create_course(f"FFS Course {cls.hash}", cls.moderator.name)
		cls._create_evaluator(cls.moderator.name)
		cls.batch = cls._create_batch(
			course.name, cls.moderator.name, f"FFS Batch {cls.hash}", cls.moderator.name
		).name
		cls._create_batch_enrollment(cls.student.name, cls.batch)
		cls._create_batch_enrollment(cls.victim.name, cls.batch)

	def setUp(self):
		super().setUp()
		self.enterContext(patch("frappe.sendmail"))

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _post_job(self):
		job = frappe.get_doc(
			{
				"doctype": "Job Opportunity",
				"job_title": f"Job {self.hash}",
				"location": "Remote",
				"type": "Full Time",
				"description": "A job.",
				"company_name": f"Company {self.hash}",
				"company_website": "https://example.com",
				"company_email_address": self.moderator.name,
				"company_logo": "https://example.com/logo.png",
				"country": frappe.db.get_value("Country", {}, "name"),
			}
		)
		with patch("frappe.email.doctype.notification.notification.evaluate_alert"):
			return job.insert().name

	def _resume(self):
		frappe.set_user(self.student.name)
		# nosemgrep: lms-unjustified-ignore-permissions - stands in for upload_file, which owns the row the same way
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"resume-{self.hash}.txt",
				"is_private": 1,
				"content": f"resume {self.hash}".encode(),
			}
		).insert(ignore_permissions=True)
		path = file.get_full_path()
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
		return file.file_url

	def _apply(self, user):
		job = self._post_job()
		resume = self._resume()
		frappe.set_user(self.student.name)
		return frappe.get_doc(
			{"doctype": "LMS Job Application", "job": job, "user": user, "resume": resume}
		).insert()

	def _feedback(self, as_user, member):
		frappe.set_user(as_user)
		return frappe.get_doc(
			{"doctype": "LMS Batch Feedback", "batch": self.batch, "member": member, "feedback": "Good"}
		).insert()

	def test_a_student_cannot_apply_in_another_users_name(self):
		with self.assertRaises(frappe.PermissionError):
			self._apply(self.victim.name)
		self.assertFalse(frappe.db.exists("LMS Job Application", {"user": self.victim.name}))

	def test_a_student_applies_in_their_own_name(self):
		application = self._apply(self.student.name)
		self.assertEqual(application.user, self.student.name)

	def test_a_student_cannot_give_feedback_in_another_users_name(self):
		with self.assertRaises(frappe.PermissionError):
			self._feedback(self.student.name, self.victim.name)

	def test_a_student_gives_feedback_in_their_own_name(self):
		self.assertEqual(self._feedback(self.student.name, self.student.name).member, self.student.name)

	def test_a_student_cannot_repoint_their_feedback_to_another_user(self):
		feedback = self._feedback(self.student.name, self.student.name)
		feedback.member = self.victim.name
		with self.assertRaises(frappe.PermissionError):
			feedback.save()

	def test_feedback_needs_an_enrolment_in_the_batch(self):
		outsider = self._create_user(f"ffs-out-{self.hash}@example.com", "Ffs", "Outsider", ["LMS Student"])
		with self.assertRaises(frappe.PermissionError):
			self._feedback(outsider.name, outsider.name)

	def test_a_moderator_files_feedback_for_a_student(self):
		feedback = self._feedback(self.moderator.name, self.victim.name)
		self.assertEqual(feedback.member, self.victim.name)
