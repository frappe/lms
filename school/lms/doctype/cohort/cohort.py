# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Cohort(Document):
    def get_subgroups(self):
        names = frappe.get_all("Cohort Subgroup", filters={"cohort": self.name}, pluck="name")
        return [frappe.get_doc("Cohort Subgroup", name) for name in names]

    def get_subgroup(self, slug):
        q = dict(cohort=self.name, slug=slug)
        name = frappe.db.get_value("Cohort Subgroup", q, "name")
        return name and frappe.get_doc("Cohort Subgroup", name)
