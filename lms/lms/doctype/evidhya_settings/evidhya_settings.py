# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EvidhyaSettings(Document):
	pass


@frappe.whitelist()
def regenerate_url():
    doc = frappe.get_single("Evidhya Settings")
    evidhya_key = frappe.generate_hash(length=20)

    doc.update({"evidhya_key": evidhya_key})
    doc.save()