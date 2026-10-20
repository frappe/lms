# Copyright (c) 2024, Frappe and Contributors
# See license.txt

<<<<<<< HEAD
# import frappe
from frappe.tests import UnitTestCase


class TestLMSJobApplication(UnitTestCase):
	pass
=======
import io
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from pypdf import PdfWriter

from lms.job.doctype.lms_job_application import lms_job_application


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
>>>>>>> ec36677 (fix: keep stored file bytes intact on frappe version-16)
