# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, add_years
from frappe import _
from frappe.utils.pdf import get_pdf
from school.lms.utils import is_certified

class LMSCertification(Document):

    def validate(self):
        certificates = frappe.get_all("LMS Certification", {
                            "student": self.student,
                            "course": self.course,
                            "expiry_date": [">", nowdate()]
                        })
        if len(certificates):
            full_name = frappe.db.get_value("User", self.student, "full_name")
            course_name = frappe.db.get_value("LMS Course", self.course, "title")
            frappe.throw(_("There is already a valid certificate for user {0} for the course {1}").format(full_name, course_name))

@frappe.whitelist()
def create_certificate(course):
    certificate = is_certified(course)

    if certificate:
        return certificate

    else:
        expires_after_yrs = int(frappe.db.get_value("LMS Course", course, "expiry"))
        expiry_date = None
        if expires_after_yrs:
            expiry_date = add_years(nowdate(), expires_after_yrs)

        certificate = frappe.get_doc({
                            "doctype": "LMS Certification",
                            "student": frappe.session.user,
                            "course": course,
                            "issue_date": nowdate(),
                            "expiry_date": expiry_date
                        })
        certificate.save(ignore_permissions=True)
        return certificate
