# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class LMSCertificateRequest(Document):
	pass

@frappe.whitelist()
def create_certificate_request(course, day, start_time, end_time):
    evaluator = frappe.db.get_value("LMS Course", course, "evaluator")
    frappe.get_doc({
        "doctype": "LMS Certificate Request",
        "course": course,
        "day": day,
        "start_time": start_time,
        "end_time": end_time
    }).save(ignore_permissions=True)
