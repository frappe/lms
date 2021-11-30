# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class CohortJoinRequest(Document):
    def on_update(self):
        if self.status == "Accepted":
            self.ensure_student()

    def ensure_student(self):
        q = {
            "doctype": "LMS Batch Membership",
            "cohort": self.cohort,
            "subgroup": self.subgroup,
            "email": self.email
        }
        if frappe.db.exists(q):
            return

        cohort = frappe.get_doc("Cohort", self.cohort)

        data = {
            "doctype": "LMS Batch Membership",
            "course": cohort.course,
            "cohort": self.cohort,
            "subgroup": self.subgroup,
            "member": self.email,
            "member_type": "Student",
            "role": "Member"
        }
        doc = frappe.get_doc(data)
        doc.insert(ignore_permissions=True)
