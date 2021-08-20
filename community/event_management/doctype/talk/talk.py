# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Talk(Document):
    def before_save(self):
        exists = frappe.db.exists({
            'doctype': 'Speaker',
            'user': frappe.session.user
        })
        speaker = None

        if(exists):
            speaker = frappe.db.get_value(
                	'Speaker', {'user': frappe.session.user})

        elif(not exists):
            speaker = frappe.get_doc(dict(
                    event=self.event,
                    user=frappe.session.user,
                    company=self.company,
                	)).insert(ignore_permissions=True)

        self.speaker = speaker
