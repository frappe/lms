# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc


class LMSCertificateEvaluation(Document):
	pass


@frappe.whitelist()
def create_lms_certificate(source_name, target_doc=None):
	doc = get_mapped_doc(
		"LMS Certificate Evaluation",
		source_name,
		{"LMS Certificate Evaluation": {"doctype": "LMS Certificate"}},
		target_doc,
	)
	return doc
