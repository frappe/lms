# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc

class LMSCertificateRequest(Document):
	pass

@frappe.whitelist()
def create_certificate_request(course, date, day, start_time, end_time):
    is_member = frappe.db.exists({
        "doctype": "LMS Batch Membership",
        "course": course,
        "member": frappe.session.user
    })

    if not is_member:
        return

    frappe.get_doc({
        "doctype": "LMS Certificate Request",
        "course": course,
        "member": frappe.session.user,
        "date": date,
        "day": day,
        "start_time": start_time,
        "end_time": end_time
    }).save(ignore_permissions=True)


@frappe.whitelist()
def create_lms_certificate_evaluation(source_name, target_doc=None):
    doc = get_mapped_doc("LMS Certificate Request", source_name, {
        "LMS Certificate Request": {
            "doctype": "LMS Certificate Evaluation"
        }
    }, target_doc)
    return doc
