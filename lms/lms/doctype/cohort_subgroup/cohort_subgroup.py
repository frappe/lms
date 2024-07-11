# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import random_string


class CohortSubgroup(Document):
	def before_save(self):
		if not self.invite_code:
			self.invite_code = random_string(8)

	def get_url(self):
		cohort = frappe.get_doc("Cohort", self.cohort)
		return f"{frappe.utils.get_url()}/lms/courses/{self.course}/subgroups/{cohort.slug}/{self.slug}"

	def get_invite_link(self):
		cohort = frappe.get_doc("Cohort", self.cohort)
		return f"{frappe.utils.get_url()}/lms/courses/{self.course}/join/{cohort.slug}/{self.slug}/{self.invite_code}"

	def has_student(self, email):
		"""Check if given user is a student of this subgroup."""
		q = {"doctype": "LMS Enrollment", "subgroup": self.name, "member": email}
		return frappe.db.exists(q)

	def has_join_request(self, email):
		"""Check if given user is a student of this subgroup."""
		q = {"doctype": "Cohort Join Request", "subgroup": self.name, "email": email}
		return frappe.db.exists(q)

	def get_join_requests(self, status="Pending"):
		q = {"subgroup": self.name, "status": status}
		return frappe.get_all(
			"Cohort Join Request", filters=q, fields=["*"], order_by="creation desc"
		)

	def get_mentors(self):
		emails = frappe.get_all(
			"Cohort Mentor", filters={"subgroup": self.name}, fields=["email"], pluck="email"
		)
		return self._get_users(emails)

	def get_students(self):
		emails = frappe.get_all(
			"LMS Enrollment",
			filters={"subgroup": self.name},
			fields=["member"],
			pluck="member",
			page_length=1000,
		)
		return self._get_users(emails)

	def _get_users(self, emails):
		users = [frappe.get_cached_doc("User", email) for email in emails]
		return sorted(users, key=lambda user: user.full_name)

	def is_mentor(self, email):
		q = {"doctype": "Cohort Mentor", "subgroup": self.name, "email": email}
		return frappe.db.exists(q)

	def is_manager(self, email):
		"""Returns True if the given user is a manager of this subgroup.

		Mentors of the subgroup, admins of the Cohort are considered as managers.
		"""
		return self.is_mentor(email) or self.get_cohort().is_admin(email)

	def get_cohort(self):
		return frappe.get_doc("Cohort", self.cohort)

	def add_mentor(self, email):
		d = {
			"doctype": "Cohort Mentor",
			"subgroup": self.name,
			"cohort": self.cohort,
			"email": email,
		}
		if frappe.db.exists(d):
			return
		doc = frappe.get_doc(d)
		doc.insert(ignore_permissions=True)


# def after_doctype_insert():
#    frappe.db.add_unique("Cohort Subgroup", ("cohort", "slug"))
