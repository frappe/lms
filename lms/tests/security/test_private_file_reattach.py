# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A submitted file URL only counts if its File row was uploaded for that document.

Frappe grants a private File to whoever can read the document it is attached to, so
an unchecked URL would hand someone else's file to the caller.
"""

import os
from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import validate_image


class TestPrivateFileReattach(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.hash = frappe.generate_hash(length=8).lower()
		self.victim = self._create_user(f"pfr-v-{self.hash}@example.com", "Vic", "Tim", ["LMS Student"]).name
		self.student = self._create_user(
			f"pfr-s-{self.hash}@example.com", "Sam", "Student", ["LMS Student"]
		).name
		self.assignment = self._create_assignment(f"PFR Assignment {self.hash}").name

	def _upload(self, owner, file_name):
		frappe.set_user(owner)
		# nosemgrep: lms-unjustified-ignore-permissions - stands in for upload_file, which owns the row the same way
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": file_name,
				"is_private": 1,
				"content": f"{owner} {file_name} {self.hash}".encode(),
			}
		).insert(ignore_permissions=True)
		self.addCleanup(self._remove_from_disk, file.get_full_path())
		frappe.set_user("Administrator")
		return file

	@staticmethod
	def _remove_from_disk(path):
		if os.path.exists(path):
			os.remove(path)

	def _stored(self, file):
		return frappe.db.get_value(
			"File", file.name, ["attached_to_doctype", "attached_to_name", "is_private"], as_dict=True
		)

	def _student_can_read(self, file):
		return frappe.has_permission("File", "read", doc=frappe.get_doc("File", file.name), user=self.student)

	def _submit(self, **values):
		frappe.set_user(self.student)
		submission = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": self.assignment,
				"answer": "<p>answer</p>",
				**values,
			}
		).insert()
		frappe.set_user("Administrator")
		return submission

	def _submit_answer_image(self, src):
		return self._submit(answer=f'<p>answer</p><img src="{src}">')

	def test_answer_image_cannot_adopt_another_users_unattached_file(self):
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")

		self._submit_answer_image(secret.file_url)

		self.assertFalse(self._stored(secret).attached_to_doctype)
		self.assertFalse(self._student_can_read(secret))

	def test_answer_image_cannot_move_a_file_attached_elsewhere(self):
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")
		frappe.db.set_value(
			"File", secret.name, {"attached_to_doctype": "User", "attached_to_name": self.victim}
		)

		self._submit_answer_image(secret.file_url)

		self.assertEqual(self._stored(secret).attached_to_name, self.victim)

	def test_answer_image_case_variant_does_not_adopt_the_victims_file(self):
		# Attacker's row first, so the victim's is the newer one frappe.get_all returns first.
		own = self._upload(self.student, f"SECRET-{self.hash}.txt")
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")

		self._submit_answer_image(secret.file_url)

		self.assertFalse(self._stored(secret).attached_to_doctype)
		self.assertFalse(self._stored(own).attached_to_doctype)

	def test_answer_image_the_student_uploaded_is_attached(self):
		own = self._upload(self.student, f"diagram-{self.hash}.txt")

		submission = self._submit_answer_image(own.file_url)

		self.assertEqual(self._stored(own).attached_to_name, submission.name)

	def test_answer_with_several_images_attaches_only_the_users_own_files(self):
		own_one = self._upload(self.student, f"own-one-{self.hash}.txt")
		own_two = self._upload(self.student, f"own-two-{self.hash}.txt")
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")

		submission = self._submit(
			answer=(
				f'<p><img src="{own_one.file_url}"><img src="{secret.file_url}">'
				f'<img src="{own_two.file_url}"></p>'
			)
		)

		self.assertEqual(self._stored(own_one).attached_to_name, submission.name)
		self.assertEqual(self._stored(own_two).attached_to_name, submission.name)
		self.assertFalse(self._stored(secret).attached_to_doctype)
		self.assertFalse(self._student_can_read(secret))

	def test_attachment_cannot_name_another_users_file(self):
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")

		with self.assertRaises(frappe.PermissionError):
			self._submit(assignment_attachment=secret.file_url)

		self.assertFalse(self._stored(secret).attached_to_doctype)

	def test_attachment_the_student_uploaded_is_accepted(self):
		own = self._upload(self.student, f"essay-{self.hash}.txt")

		submission = self._submit(assignment_attachment=own.file_url)

		self.assertEqual(submission.assignment_attachment, own.file_url)

	def _evaluator_for_the_assignment(self):
		"""An evaluator the way production makes one: tagged on a batch that runs it.

		The Batch Evaluator role tags nobody by itself -- a Course Evaluator insert is
		what grants it -- and assessment_submission_has_permission reads the Batch
		Course row rather than the role, so a bare role holder reaches no submission.
		"""
		evaluator = self._create_user(
			f"pfr-e-{self.hash}@example.com", "Eva", "Luator", ["Batch Evaluator"]
		).name
		course = self._create_course(title=f"PFR Grading Course {self.hash}", instructor="Administrator")
		self._create_evaluator(evaluator)
		batch = self._create_batch(
			course.name,
			title=f"PFR Grading Batch {self.hash}",
			instructor="Administrator",
			evaluator=evaluator,
		)
		batch.append("assessment", {"assessment_type": "LMS Assignment", "assessment_name": self.assignment})
		batch.save()
		return evaluator

	def test_evaluator_can_grade_a_submission_with_an_attachment(self):
		evaluator = self._evaluator_for_the_assignment()
		own = self._upload(self.student, f"essay-{self.hash}.txt")
		submission = self._submit(assignment_attachment=own.file_url)

		frappe.set_user(evaluator)
		submission.reload()
		submission.status = "Pass"
		submission.save()

		self.assertEqual(frappe.db.get_value("LMS Assignment Submission", submission.name, "status"), "Pass")

	def _post_job(self, **values):
		frappe.set_user(self.student)
		job = frappe.get_doc(
			{
				"doctype": "Job Opportunity",
				"job_title": f"Job {self.hash}",
				"location": "Remote",
				"type": "Full Time",
				"description": "A job.",
				"company_name": f"Company {self.hash}",
				"company_website": "https://example.com",
				"company_email_address": self.student,
				"company_logo": "https://example.com/logo.png",
				"country": frappe.db.get_value("Country", {}, "name"),
				**values,
			}
		)
		try:
			return job.insert()
		finally:
			frappe.set_user("Administrator")

	def _apply(self, resume):
		job = self._post_job()
		self.enterContext(patch.dict(frappe.local.conf, {"mail_login": "test@example.com"}))
		self.sendmail = self.enterContext(patch("frappe.sendmail"))
		frappe.set_user(self.student)
		try:
			frappe.get_doc(
				{"doctype": "LMS Job Application", "job": job.name, "user": self.student, "resume": resume}
			).insert()
		finally:
			frappe.set_user("Administrator")

	def test_resume_cannot_name_another_users_file(self):
		secret = self._upload(self.victim, f"resume-{self.hash}.txt")

		with self.assertRaises(frappe.PermissionError):
			self._apply(secret.file_url)

		self.sendmail.assert_not_called()
		self.assertFalse(self._stored(secret).attached_to_doctype)

	def test_resume_case_variant_cannot_name_the_victims_file(self):
		self._upload(self.student, f"RESUME-{self.hash}.txt")
		secret = self._upload(self.victim, f"resume-{self.hash}.txt")

		with self.assertRaises(frappe.PermissionError):
			self._apply(secret.file_url)

	def test_resume_with_no_matching_file_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			self._apply(f"/files/does-not-exist-{self.hash}.pdf")

		self.sendmail.assert_not_called()
		self.assertFalse(frappe.db.exists("LMS Job Application", {"user": self.student}))

	def test_own_resume_is_emailed_with_its_own_content(self):
		own = self._upload(self.student, f"resume-{self.hash}.txt")

		self._apply(own.file_url)

		attachments = self.sendmail.call_args.kwargs["attachments"]
		self.assertEqual(
			attachments,
			[{"fname": own.file_name, "fcontent": frappe.get_doc("File", own.name).get_content()}],
		)

	def test_company_logo_cannot_publish_another_users_file(self):
		secret = self._upload(self.victim, f"logo-{self.hash}.png")

		with self.assertRaises(frappe.PermissionError):
			self._post_job(company_logo=secret.file_url)

		self.assertEqual(self._stored(secret).is_private, 1)

	def test_own_company_logo_is_made_public(self):
		own = self._upload(self.student, f"logo-{self.hash}.png")

		job = self._post_job(company_logo=own.file_url)

		self.assertEqual(job.company_logo, own.file_url.replace("/private", ""))
		self.assertEqual(self._stored(own).is_private, 0)

	def test_course_image_cannot_name_another_users_file(self):
		creator = self._create_user(
			f"pfr-c-{self.hash}@example.com", "Cy", "Creator", ["Course Creator"]
		).name
		secret = self._upload(self.victim, f"cover-{self.hash}.png")
		course = frappe.get_doc(
			{
				"doctype": "LMS Course",
				"title": f"PFR Course {self.hash}",
				"short_introduction": "Intro",
				"description": "Description",
				"image": secret.file_url,
				"instructors": [{"instructor": creator}],
			}
		)

		frappe.set_user(creator)
		with self.assertRaises(frappe.PermissionError):
			course.insert()
		frappe.set_user("Administrator")

		self.assertEqual(self._stored(secret).is_private, 1)

	def test_validate_image_leaves_another_users_file_private(self):
		secret = self._upload(self.victim, f"cover-{self.hash}.png")

		frappe.set_user(self.student)
		path = validate_image(secret.file_url)
		frappe.set_user("Administrator")

		self.assertEqual(path, secret.file_url)
		self.assertEqual(self._stored(secret).is_private, 1)
