# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Cohort(Document):
    def get_subgroups(self, include_counts=False):
        names = frappe.get_all("Cohort Subgroup", filters={"cohort": self.name}, pluck="name")
        subgroups = [frappe.get_doc("Cohort Subgroup", name) for name in names]
        subgroups = sorted(subgroups, key=lambda sg: sg.title)

        if include_counts:
            mentors = self._get_subgroup_counts("Cohort Mentor")
            students = self._get_subgroup_counts("LMS Batch Membership")
            join_requests = self._get_subgroup_counts("Cohort Join Request")
            for s in subgroups:
                s.num_mentors = mentors.get(s.name, 0)
                s.num_students = students.get(s.name, 0)
                s.num_join_requests = join_requests.get(s.name, 0)
        return subgroups

    def _get_subgroup_counts(self, doctype):
        q = f"""
            SELECT subgroup, count(*) as count
            FROM `tab{doctype}`
            WHERE cohort = %(cohort)s"""
        rows = frappe.db.sql(q, values={"cohort": self.name})
        return {subgroup: count for subgroup, count in rows}

    def get_subgroup(self, slug):
        q = dict(cohort=self.name, slug=slug)
        name = frappe.db.get_value("Cohort Subgroup", q, "name")
        return name and frappe.get_doc("Cohort Subgroup", name)

    def get_mentor(self, email):
        q = dict(cohort=self.name, email=email)
        name = frappe.db.get_value("Cohort Mentor", q, "name")
        return name and frappe.get_doc("Cohort Mentor", name)

    def is_mentor(self, email):
        q = {
            "doctype": "Cohort Mentor",
            "cohort": self.name,
            "email": email
        }
        return frappe.db.exists(q)

    def is_admin(self, email):
        q = {
            "doctype": "Cohort Staff",
            "cohort": self.name,
            "email": email,
            "role": "Admin"
        }
        return frappe.db.exists(q)
