# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document

class CohortJoinRequest(Document):
    def on_update(self):
        if self.status == "Accepted":
            self.ensure_student()

    def ensure_student(self):
        pass
