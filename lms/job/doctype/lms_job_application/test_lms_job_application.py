# Copyright (c) 2024, Frappe and Contributors
# See license.txt

import io
import threading
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from pypdf import PdfWriter

from lms.job.doctype.lms_job_application import lms_job_application
from lms.lms.test_helpers import BaseTestUtils


def blank_pdf():
	"""Not UTF-8 (its header carries binary bytes), but it decodes as windows-1250."""
	writer = PdfWriter()
	writer.add_blank_page(72, 72)
	buffer = io.BytesIO()
	writer.write(buffer)
	return buffer.getvalue()


class TestResumeAttachment(IntegrationTestCase):
	def test_the_employer_gets_the_resume_bytes(self):
		"""Version-16's File.get_content returned this PDF as str, so the employer's copy
		was re-encoded as UTF-8 and would not open."""
		pdf = blank_pdf()
		resume = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"resume-{frappe.generate_hash(length=8)}.pdf",
				"content": pdf,
				"is_private": 1,
			}
		).insert()
		application = frappe.get_doc(
			{
				"doctype": "LMS Job Application",
				"job": "any-job",
				"user": "Administrator",
				"resume": resume.file_url,
			}
		)
		original_get_value = frappe.get_value

		def get_value(doctype, *args, **kwargs):
			if doctype == "Job Opportunity":
				return "employer@example.com"
			return original_get_value(doctype, *args, **kwargs)

		with (
			patch.object(frappe, "get_value", get_value),
			patch.object(
				lms_job_application, "get_attachable_file", return_value=frappe._dict(name=resume.name)
			),
			patch.object(frappe, "sendmail") as sendmail,
		):
			application.send_email_to_employer()

		attachment = sendmail.call_args.kwargs["attachments"][0]
		self.assertEqual(attachment["fcontent"], pdf)


# A worker that never reaches the barrier must not hang the whole suite.
THREAD_TIMEOUT = 30


def _delete_committed(doctype, name):
	"""Delete without the Deleted Document copy, which a committed fixture would
	otherwise leave on the site."""
	in_import = frappe.flags.in_import
	frappe.flags.in_import = True
	try:
		frappe.delete_doc(doctype, name, force=True, delete_permanently=True)
	finally:
		frappe.flags.in_import = in_import


def _delete_committed_user(user):
	"""What deleting a User leaves behind: its own Notification Settings delete is
	not permanent, and its defaults, share comment and role audit trail stay."""
	_delete_committed("Notification Settings", user)
	_delete_committed("User", user)
	frappe.db.delete("DefaultValue", {"parent": user})
	frappe.db.delete("Comment", {"reference_doctype": "User", "reference_name": user})
	frappe.db.delete("Permission Log", {"for_doctype": "User", "for_document": user})


class TestParallelApplications(BaseTestUtils):
	"""The workers commit on their own connections, so this class skips
	BaseTestUtils' savepoint and removes its committed fixtures itself."""

	def setUp(self):
		super(BaseTestUtils, self).setUp()
		suffix = frappe.generate_hash(length=8)
		self.student = self._create_user(
			f"job-applicant-{suffix}@example.com", "Job", "Applicant", ["LMS Student"]
		)
		self.job = frappe.get_doc(
			{
				"doctype": "Job Opportunity",
				"job_title": f"Parallel job {suffix}",
				"location": "Remote",
				"type": "Full Time",
				"description": "A job.",
				"company_name": f"Company {suffix}",
				"company_website": "https://example.com",
				"company_email_address": "jobs@example.com",
				"company_logo": "https://example.com/logo.png",
				"country": frappe.db.get_value("Country", {}, "name"),
			}
		).insert()
		frappe.set_user(self.student.name)
		try:
			self.resume = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"resume-{suffix}.pdf",
					"content": blank_pdf(),
					"is_private": 1,
				}
			).insert()
		finally:
			frappe.set_user("Administrator")

	def tearDown(self):
		for name in frappe.get_all("LMS Job Application", {"job": self.job.name}, pluck="name"):
			_delete_committed("LMS Job Application", name)
		_delete_committed("File", self.resume.name)
		_delete_committed("Job Opportunity", self.job.name)
		_delete_committed_user(self.student.name)
		frappe.db.commit()  # nosemgrep
		super(BaseTestUtils, self).tearDown()

	def test_parallel_submits_create_one_application(self):
		"""Two clicks on Apply can reach the server together. Both read "not applied
		yet" before either commits, so the duplicate check alone let both in."""
		workers = 4
		errors = self._apply_in_parallel(workers)

		applications = frappe.db.count(
			"LMS Job Application", {"job": self.job.name, "user": self.student.name}
		)
		self.assertEqual(applications, 1)
		self.assertEqual(len(errors), workers - 1)
		for error in errors:
			self.assertIsInstance(error, frappe.ValidationError)
			self.assertIn("You have already applied for this job.", str(error))

	def _apply_in_parallel(self, workers: int) -> list[Exception]:
		"""Insert the same application once per worker, each on its own connection,
		all at the same moment. Returns what the losing workers raised."""
		site = frappe.local.site
		frappe.db.commit()  # nosemgrep
		barrier = threading.Barrier(workers)
		errors = []

		def apply():
			try:
				frappe.init(site=site)
				frappe.connect()
				frappe.set_user(self.student.name)
				try:
					barrier.wait(timeout=THREAD_TIMEOUT)
					frappe.get_doc(
						{
							"doctype": "LMS Job Application",
							"job": self.job.name,
							"user": self.student.name,
							"resume": self.resume.file_url,
						}
					).insert()
					frappe.db.commit()  # nosemgrep
				except Exception:
					frappe.db.rollback()
					raise
				finally:
					frappe.destroy()
			except Exception as e:
				errors.append(e)

		threads = [threading.Thread(target=apply) for _ in range(workers)]
		for thread in threads:
			thread.start()
		for thread in threads:
			thread.join(timeout=THREAD_TIMEOUT)
			self.assertFalse(thread.is_alive(), "a worker did not finish")
		return errors


class TestMovedApplication(BaseTestUtils):
	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=8)
		self.student = self._create_user(f"job-mover-{suffix}@example.com", "Job", "Mover", ["LMS Student"])
		self.jobs = [self._job(f"{suffix}-{n}") for n in range(2)]
		self.applications = [
			frappe.get_doc({"doctype": "LMS Job Application", "job": job, "user": self.student.name}).insert(
				ignore_mandatory=True
			)
			for job in self.jobs
		]

	def _job(self, suffix):
		return (
			frappe.get_doc(
				{
					"doctype": "Job Opportunity",
					"job_title": f"Job {suffix}",
					"location": "Remote",
					"type": "Full Time",
					"description": "A job.",
					"company_name": f"Company {suffix}",
					"company_website": "https://example.com",
					"company_email_address": "jobs@example.com",
					"company_logo": "https://example.com/logo.png",
					"country": frappe.db.get_value("Country", {}, "name"),
				}
			)
			.insert()
			.name
		)

	def test_moving_an_application_onto_one_its_snapshot_missed_is_refused(self):
		"""An edit that waited on the job lock while the user applied to that job
		reads a snapshot without the new application, so validate() lets it through.
		The check after the update must still refuse it."""
		application = frappe.get_doc("LMS Job Application", self.applications[0].name)
		application.job = self.jobs[1]
		# The resume is not the subject.
		application.flags.ignore_mandatory = True
		with patch.object(lms_job_application.LMSJobApplication, "validate_duplicate"):
			with self.assertRaisesRegex(frappe.ValidationError, "already applied"):
				application.save()
