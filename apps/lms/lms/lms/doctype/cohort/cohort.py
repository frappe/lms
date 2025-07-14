# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Cohort(Document):
	def get_url(self):
		return f"{frappe.utils.get_url()}/lms/courses/{self.course}/cohorts/{self.slug}"

	def get_subgroups(self, include_counts=False, sort_by=None):
		names = frappe.get_all("Cohort Subgroup", filters={"cohort": self.name}, pluck="name")
		subgroups = [frappe.get_cached_doc("Cohort Subgroup", name) for name in names]
		subgroups = sorted(subgroups, key=lambda sg: sg.title)

		if include_counts:
			mentors = self._get_subgroup_counts("Cohort Mentor")
			students = self._get_subgroup_counts("LMS Enrollment")
			join_requests = self._get_subgroup_counts("Cohort Join Request", status="Pending")
			for s in subgroups:
				s.num_mentors = mentors.get(s.name, 0)
				s.num_students = students.get(s.name, 0)
				s.num_join_requests = join_requests.get(s.name, 0)

		if sort_by:
			subgroups.sort(key=lambda sg: getattr(sg, sort_by), reverse=True)
		return subgroups

	def _get_subgroup_counts(self, doctype, **kw):
		rows = frappe.get_all(
			doctype,
			filters={"cohort": self.name, **kw},
			fields=["subgroup", "count(*) as count"],
			group_by="subgroup",
		)
		return {row["subgroup"]: row["count"] for row in rows}

	def _get_count(self, doctype, **kw):
		filters = {"cohort": self.name, **kw}
		return frappe.db.count(doctype, filters=filters)

	def get_page_template(self, slug, scope=None):
		p = self.get_page(slug, scope=scope)
		return p and p.get_template_html()

	def get_page(self, slug, scope=None):
		for p in self.pages:
			if p.slug == slug and scope in [p.scope, None]:
				return p

	def get_pages(self, scope=None):
		return [p for p in self.pages if scope in [p.scope, None]]

	def get_stats(self):
		return {
			"subgroups": self._get_count("Cohort Subgroup"),
			"mentors": self._get_count("Cohort Mentor"),
			"students": self._get_count("LMS Enrollment"),
			"join_requests": self._get_count("Cohort Join Request", status="Pending"),
		}

	def get_subgroup(self, slug):
		q = dict(cohort=self.name, slug=slug)
		name = frappe.db.get_value("Cohort Subgroup", q, "name")
		return name and frappe.get_doc("Cohort Subgroup", name)

	def get_mentor(self, email):
		q = dict(cohort=self.name, email=email)
		name = frappe.db.get_value("Cohort Mentor", q, "name")
		return name and frappe.get_doc("Cohort Mentor", name)

	def is_mentor(self, email):
		q = {"doctype": "Cohort Mentor", "cohort": self.name, "email": email}
		return frappe.db.exists(q)

	def is_admin(self, email):
		q = {"doctype": "Cohort Staff", "cohort": self.name, "email": email, "role": "Admin"}
		return frappe.db.exists(q)
