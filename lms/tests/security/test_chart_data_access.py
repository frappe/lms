# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import inspect
import json

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_chart_data

STATISTICS_CHARTS = ("New Signups", "Course Enrollments", "Certification")


class TestChartDataAccess(BaseTestUtils):
	"""get_chart_data serves the charts the Statistics page draws, and no others."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		suffix = frappe.generate_hash(length=8)
		cls.student = cls._create_user(
			f"chart-student-{suffix}@example.com", "Chart", "Student", ["LMS Student"]
		).name
		cls.moderator = cls._create_user(
			f"chart-mod-{suffix}@example.com", "Chart", "Mod", ["Moderator"]
		).name
		cls.public_chart = cls._make_chart(f"Probe Public {suffix}", is_public=1)
		cls.private_chart = cls._make_chart(f"Probe Private {suffix}", is_public=0)

	@classmethod
	def _make_chart(cls, name, is_public):
		chart = frappe.new_doc("Dashboard Chart")
		chart.update(
			{
				"chart_name": name,
				"chart_type": "Count",
				"document_type": "User",
				"based_on": "creation",
				"timespan": "Last Year",
				"time_interval": "Daily",
				"type": "Line",
				"is_public": is_public,
				"filters_json": "[]",
			}
		)
		chart.insert()
		return chart.name

	def _as(self, user):
		frappe.set_user(user)
		self.addCleanup(frappe.set_user, "Administrator")

	def test_no_caller_reads_a_chart_the_statistics_page_does_not_draw(self):
		for user in ("Guest", self.student, self.moderator, "Administrator"):
			for chart in (self.public_chart, self.private_chart):
				with self.subTest(user=user, chart=chart):
					self._as(user)
					with self.assertRaises(frappe.PermissionError):
						get_chart_data(chart_name=chart)

	def test_a_missing_chart_gets_the_same_refusal(self):
		self._as("Guest")
		with self.assertRaises(frappe.PermissionError):
			get_chart_data(chart_name=f"No Such Chart {frappe.generate_hash(length=8)}")

	def test_an_allowed_chart_deleted_from_the_site_is_refused_not_500(self):
		frappe.delete_doc("Dashboard Chart", "Course Enrollments", force=True)
		self._as("Guest")
		with self.assertRaises(frappe.PermissionError):
			get_chart_data(chart_name="Course Enrollments")

	def test_a_non_string_chart_name_is_refused(self):
		body = inspect.unwrap(get_chart_data)
		self._as("Guest")
		for value in (["New Signups"], {"name": "New Signups"}, 1):
			with self.subTest(value=value):
				with self.assertRaises(frappe.PermissionError):
					body(chart_name=value)

	def test_guest_reads_every_statistics_chart(self):
		self._as("Guest")
		for chart in STATISTICS_CHARTS:
			with self.subTest(chart=chart):
				rows = get_chart_data(chart_name=chart)
				self.assertTrue(rows)
				self.assertEqual(set(rows[0]), {"date", "count"})

	def test_a_statistics_chart_made_private_is_refused_to_guest_but_not_admin(self):
		frappe.db.set_value("Dashboard Chart", "New Signups", "is_public", 0)
		self._as("Guest")
		with self.assertRaises(frappe.PermissionError):
			get_chart_data(chart_name="New Signups")
		frappe.set_user("Administrator")
		self.assertTrue(get_chart_data(chart_name="New Signups"))

	def test_new_signups_still_counts_users(self):
		email = f"chart-signup-{frappe.generate_hash(length=8)}@example.com"
		self._create_user(email, "Chart", "Signup", ["LMS Student"])
		backdated = add_days(nowdate(), -5)
		frappe.db.set_value("User", email, "creation", backdated, update_modified=False)
		self._as("Guest")
		rows = get_chart_data(chart_name="New Signups")
		counts = {str(row["date"])[:10]: row["count"] for row in rows}
		self.assertGreaterEqual(counts.get(backdated, 0), 1, json.dumps(counts, default=str))
