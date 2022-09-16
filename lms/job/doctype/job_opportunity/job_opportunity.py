# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils.user import get_system_managers
from frappe import _
from frappe.utils import get_link_to_form

class JobOpportunity(Document):


    def validate(self):
        self.validate_urls()
        self.validate_logo()


    def validate_urls(self):
        frappe.utils.validate_url(self.company_website, True)
        frappe.utils.validate_url(self.application_link, True)


    def validate_logo(self):
        if "/private" in self.company_logo:
            frappe.db.set_value("File", {"file_url": self.company_logo}, "is_private", 0)
            frappe.db.set_value("File", {"file_url": self.company_logo}, "file_url", self.company_logo.replace("/private", ""))
            self.company_logo = self.company_logo.replace("/private", "")

@frappe.whitelist()
def report(job, reason):
    system_managers = get_system_managers(only_name=True)
    user = frappe.db.get_value("User", frappe.session.user, "full_name")
    subject = _("User {0} has reported the job post {1}").format(user, job)
    args = {
        "job": job,
        "job_url": get_link_to_form("Job Opportunity", job),
        "user": user,
        "reason": reason
    }
    frappe.sendmail(
        recipients = system_managers,
        subject=subject,
        header=[subject, "green"],
        template = "job_report",
        args=args,
        now=True)
