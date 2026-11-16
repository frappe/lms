# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.locking import locked_count
from lms.lms.permissions import validate_filed_for_self
from lms.lms.utils import get_attachable_file, read_file_bytes, validate_attachable_file


class LMSJobApplication(Document):
	def validate(self):
		validate_filed_for_self(self, "user")
		self.validate_duplicate()
		validate_attachable_file(self, "resume")
		self.validate_resume_exists()

	def after_insert(self):
		self.validate_against_committed_rows()
		job_owner = frappe.get_value("Job Opportunity", self.job, "owner")
		if job_owner:
			frappe.share.add_docshare("LMS Job Application", self.name, job_owner, read=1)

		outgoing_email_account = frappe.get_cached_value(
			"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
		)
		if outgoing_email_account or frappe.conf.get("mail_login"):
			self.send_email_to_employer()

	def on_update(self):
		# An edit that moves an application to another job or user races new
		# applications to it the same way an insert does.
		if not self.flags.in_insert and (self.has_value_changed("job") or self.has_value_changed("user")):
			self.validate_against_committed_rows()

	def validate_duplicate(self):
		"""Applications to one job queue on its row. A locking read here, before this
		row exists, would take a gap lock that a first application to another job can
		deadlock with, so the read that sees committed rows runs after the insert."""
		frappe.db.get_value("Job Opportunity", self.job, "name", for_update=True)
		if frappe.db.exists(
			"LMS Job Application", {"job": self.job, "user": self.user, "name": ["!=", self.name]}
		):
			self.throw_duplicate()

	def validate_against_committed_rows(self):
		"""validate() reads this request's snapshot, which misses an application
		committed while it waited on the job lock."""
		if locked_count("LMS Job Application", {"job": self.job, "user": self.user}) > 1:
			self.throw_duplicate()

	def throw_duplicate(self):
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
						"fcontent": read_file_bytes(resume_file),
					}
				],
				header=[subject, "green"],
				retry=3,
			)
