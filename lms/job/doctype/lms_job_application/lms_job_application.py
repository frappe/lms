# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.utils import get_attachable_file, validate_attachable_file


class LMSJobApplication(Document):
	def validate(self):
		self.validate_duplicate()
		validate_attachable_file(self, "resume")
		self.validate_resume_exists()

	def after_insert(self):
		job_owner = frappe.get_value("Job Opportunity", self.job, "owner")
		if job_owner:
			frappe.share.add_docshare("LMS Job Application", self.name, job_owner, read=1)

		outgoing_email_account = frappe.get_cached_value(
			"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
		)
		if outgoing_email_account or frappe.conf.get("mail_login"):
			self.send_email_to_employer()

	def validate_duplicate(self):
		if frappe.db.exists("LMS Job Application", {"job": self.job, "user": self.user}):
			frappe.throw(_("You have already applied for this job."))

	def validate_resume_exists(self):
		if self.resume and not get_attachable_file(self.resume, self, frappe.session.user):
			frappe.throw(_("Please upload the resume again. The uploaded file could not be found."))

	def send_email_to_employer(self):
		company_email = frappe.get_value("Job Opportunity", self.job, "company_email_address")
		if company_email:
			subject = _("New Job Applicant")

			args = {
				"full_name": frappe.db.get_value("User", self.user, "full_name"),
				"job_title": self.job_title,
			}
			resume = get_attachable_file(self.resume, self, frappe.session.user)
			if not resume:
				return
			resume_file = frappe.get_doc("File", resume.name)
			frappe.sendmail(
				recipients=company_email,
				subject=subject,
				template="job_application",
				args=args,
				attachments=[
					{
						"fname": resume_file.file_name,
						"fcontent": resume_file.get_content(),
					}
				],
				header=[subject, "green"],
				retry=3,
			)
