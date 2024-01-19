# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class BatchStudent(Document):
	pass


@frappe.whitelist()
def enroll_batch(batch_name):
	enrollment = frappe.new_doc("Batch Student")
	enrollment.student = frappe.session.user
	enrollment.parent = batch_name
	enrollment.parentfield = "students"
	enrollment.parenttype = "LMS Batch"
	enrollment.save(ignore_permissions=True)
