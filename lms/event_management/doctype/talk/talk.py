# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Talk(Document):
    def before_save(self):
        if not self.speaker:
            self.save_speaker()

    def save_speaker(self):
        exists = frappe.db.exists({
                    'doctype': 'Speaker',
                    'user': frappe.session.user
                })

        if exists:
            self.speaker = frappe.db.get_value(
                    'Speaker', {'user': frappe.session.user}, ["name"])

        else:
            speaker = frappe.get_doc({
                "doctype": "Speaker",
                "event": self.event,
                "user": frappe.session.user
            })
            speaker.save(ignore_permissions=True)
            self.speaker = speaker.name
