# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from lms.lms.utils import can_create_courses


class LMSAssignment(Document):
	pass


@frappe.whitelist()
def save_assignment(assignment, title, type, question):
	if not can_create_courses():
		return

	if assignment:
		doc = frappe.get_doc("LMS Assignment", assignment)
	else:
		doc = frappe.get_doc({"doctype": "LMS Assignment"})

	doc.update({"title": title, "type": type, "question": question})
	doc.save(ignore_permissions=True)
	return doc.name
