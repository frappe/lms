# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Schedule(Document):
	def before_save(self):
		exists = frappe.db.exists(
            "Schedule",
            {
                "Event": self.event,
                "slot": self.slot
            },
        )

		if exists:
			frappe.throw("Slot already Assigned")
