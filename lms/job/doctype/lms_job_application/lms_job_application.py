# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSJobApplication(Document):
	def validate(self):
		self.validate_duplicate()

	def after_insert(self):
		outgoing_email_account = frappe.get_cached_value(
			"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
		)
		if outgoing_email_account:
			self.send_email_to_employer()

	def validate_duplicate(self):
		if frappe.db.exists("LMS Job Application", {"job": self.job, "user": self.user}):
			frappe.throw(_("You have already applied for this job."))

	def send_email_to_employer(self):
		company_email = frappe.get_value("Job Opportunity", self.job, "company_email_address")
		print(company_email)
		if company_email:
			subject = _("New Job Applicant")

			args = {
				"full_name": frappe.db.get_value("User", self.user, "full_name"),
				"job_title": self.job_title,
			}

			frappe.sendmail(
				recipients=company_email,
				subject=subject,
				template="job_application",
				args=args,
				attachments=[self.resume],
				header=[subject, "green"],
				retry=3,
			)
