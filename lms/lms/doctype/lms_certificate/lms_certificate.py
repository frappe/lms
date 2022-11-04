# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_years, nowdate
from frappe.utils.pdf import get_pdf

from lms.lms.utils import is_certified


class LMSCertificate(Document):
	def before_insert(self):
		certificates = frappe.get_all(
			"LMS Certificate", {"member": self.member, "course": self.course}
		)
		if len(certificates):
			full_name = frappe.db.get_value("User", self.member, "full_name")
			course_name = frappe.db.get_value("LMS Course", self.course, "title")
			frappe.throw(
				_("{0} is already certified for the course {1}").format(full_name, course_name)
			)


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

		certificate = frappe.get_doc(
			{
				"doctype": "LMS Certificate",
				"member": frappe.session.user,
				"course": course,
				"issue_date": nowdate(),
				"expiry_date": expiry_date,
			}
		)
		certificate.save(ignore_permissions=True)
		return certificate


@frappe.whitelist()
def get_certificate_pdf(html):
	frappe.local.response.filename = "certificate.pdf"
	frappe.local.response.filecontent = get_pdf(html, {"orientation": "LandScape"})
	frappe.local.response.type = "pdf"
