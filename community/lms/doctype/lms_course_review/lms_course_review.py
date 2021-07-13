# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class LMSCourseReview(Document):
	pass

@frappe.whitelist()
def submit_review(rating, review, course):
    frappe.get_doc({
        "doctype": "LMS Course Review",
        "rating": rating,
        "review": review,
        "course": course
    }).save(ignore_permissions=True)
    return "OK"
