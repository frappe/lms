# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_months, get_link_to_form, getdate, validate_url
from frappe.utils.user import get_system_managers

from lms.lms.utils import generate_slug, validate_image


class JobOpportunity(Document):
	def validate(self):
		self.validate_urls()
		self.company_logo = validate_image(self.company_logo)

	def validate_urls(self):
		validate_url(self.company_website, True, ["http", "https"])

	def autoname(self):
		if not self.name:
			self.name = generate_slug(f"{self.job_title}-${self.company_name}", "LMS Course")


def update_job_openings():
	old_jobs = frappe.get_all(
		"Job Opportunity",
		filters={"status": "Open", "creation": ["<=", add_months(getdate(), -3)]},
		pluck="name",
	)

	for job in old_jobs:
		frappe.db.set_value("Job Opportunity", job, "status", "Closed")


@frappe.whitelist()
def report(job, reason):
	system_managers = get_system_managers(only_name=True)
	user = frappe.db.get_value("User", frappe.session.user, "full_name")
	subject = _("User {0} has reported the job post {1}").format(user, job)
	args = {
		"job": job,
		"job_url": get_link_to_form("Job Opportunity", job),
		"user": user,
		"reason": reason,
	}
	frappe.sendmail(
		recipients=system_managers,
		subject=subject,
		header=[subject, "green"],
		template="job_report",
		args=args,
		now=True,
	)
