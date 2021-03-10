# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class LMSSketch(Document):
    def get_owner_name(self):
        return self.owner.split("@")[0]

@frappe.whitelist()
def save_sketch(name, title, code):
    if not name or name == "new":
        doc = frappe.new_doc('LMS Sketch')
        doc.title = title
        doc.code = code
        doc.runtime = 'python-canvas'
        doc.insert()
        status = "created"
    else:
        doc = frappe.get_doc("LMS Sketch", name)

        if doc.owner != frappe.session.user:
            return {
                "ok": False,
                "error": "Permission Denied"
            }
        doc.title = title
        doc.code = code
        doc.save()
        status = "updated"
    return {
        "ok": True,
        "status": status,
        "name": doc.name,
    }

