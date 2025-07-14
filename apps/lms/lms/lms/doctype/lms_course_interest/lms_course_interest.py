# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class LMSCourseInterest(Document):
	pass


@frappe.whitelist()
def capture_interest(course):
	data = {
		"doctype": "LMS Course Interest",
		"course": course,
		"user": frappe.session.user,
	}
	if not frappe.db.exists(data):
		frappe.get_doc(data).save(ignore_permissions=True)
	return "OK"
