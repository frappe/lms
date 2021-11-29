# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import random_string

class CohortSubgroup(Document):
    def before_save(self):
        if not self.invite_code:
            self.invite_code = random_string(8)

    def get_invite_link(self):
        return f"{frappe.utils.get_url()}/cohorts/{self.cohort}/join/{self.slug}/{self.invite_code}"

    def has_student(self, email):
        """Check if given user is a student of this subgroup.
        """
        q = {
            "doctype": "Cohort Student",
            "subgroup": self.name,
            "email": email
        }
        return frappe.db.exists(q)

    def has_join_request(self, email):
        """Check if given user is a student of this subgroup.
        """
        q = {
            "doctype": "Cohort Join Request",
            "subgroup": self.name,
            "email": email
        }
        return frappe.db.exists(q)

    def get_join_requests(self, status="Pending"):
        q = {
            "subgroup": self.name,
            "status": status
        }
        return frappe.get_all("Cohort Join Request", filters=q, fields=["*"], order_by="creation")


#def after_doctype_insert():
#    frappe.db.add_unique("Cohort Subgroup", ("cohort", "slug"))
