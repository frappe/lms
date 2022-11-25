# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from lms.lms.utils import has_course_moderator_role


class LMSCertificateEvaluation(Document):
	pass


def has_website_permission(doc, ptype, user, verbose=False):
	if has_course_moderator_role() or doc.member == frappe.session.user:
		return True
	return False


@frappe.whitelist()
def create_lms_certificate(source_name, target_doc=None):
	doc = get_mapped_doc(
		"LMS Certificate Evaluation",
		source_name,
		{"LMS Certificate Evaluation": {"doctype": "LMS Certificate"}},
		target_doc,
	)
	return doc
