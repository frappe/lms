# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import inspect
import json

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.api import get_chart_details
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_chart_data, get_course_completion_data

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

	def _set_guest_access(self, value):
		"""`guest_access_allowed` reads through `frappe.get_cached_value`, so clear the cache after the write."""
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", value)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")

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

	def test_a_range_over_a_year_is_refused(self):
		self._as("Guest")
		for from_date, to_date in (("1000-01-01", nowdate()), (nowdate(), "3000-01-01")):
			with self.subTest(from_date=from_date, to_date=to_date):
				with self.assertRaises(frappe.ValidationError):
					get_chart_data(chart_name="New Signups", from_date=from_date, to_date=to_date)

	def test_an_end_date_before_the_start_is_refused(self):
		self._as("Guest")
		with self.assertRaises(frappe.ValidationError):
			get_chart_data(chart_name="New Signups", from_date=nowdate(), to_date=add_days(nowdate(), -1))

	def test_daily_points_stop_at_the_limit(self):
		self._as("Guest")
		rows = get_chart_data(
			chart_name="New Signups", from_date=add_days(nowdate(), -365), to_date=nowdate()
		)
		self.assertEqual(len(rows), 366)
		with self.assertRaises(frappe.ValidationError):
			get_chart_data(chart_name="New Signups", from_date=add_days(nowdate(), -366), to_date=nowdate())

	def test_a_year_of_daily_rows_is_served(self):
		self._as("Guest")
		rows = get_chart_data(
			chart_name="New Signups", from_date=add_days(nowdate(), -365), to_date=nowdate()
		)
		self.assertGreaterEqual(len(rows), 365)

	def test_an_unknown_timegrain_is_refused(self):
		self._as("Guest")
		with self.assertRaises(frappe.ValidationError):
			get_chart_data(chart_name="New Signups", timegrain="Hourly")

	def test_statistics_are_empty_for_guests_when_guest_access_is_off(self):
		previous = frappe.db.get_single_value("LMS Settings", "allow_guest_access")
		self._set_guest_access(0)
		self.addCleanup(self._set_guest_access, previous)

		self._as("Guest")
		self.assertEqual(get_chart_data(chart_name="New Signups"), [])
		self.assertFalse(get_chart_details())
		self.assertEqual(get_course_completion_data(), [])

		frappe.set_user(self.student)
		self.assertTrue(get_chart_data(chart_name="New Signups"))
		self.assertTrue(get_chart_details())
		self.assertTrue(get_course_completion_data())

	def test_a_longer_period_allows_a_longer_range(self):
		self._as("Guest")
		rows = get_chart_data(
			chart_name="New Signups", timegrain="Yearly", from_date=add_days(nowdate(), -3 * 365)
		)
		self.assertGreaterEqual(len(rows), 3)
