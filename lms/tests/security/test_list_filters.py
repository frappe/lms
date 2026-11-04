# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""The course, batch and job lists are open to guests and pass the caller's
filters to queries that skip permission checks. A list accepts only the filters
it offers, each as a plain value or an [operator, value] pair, and the batch
list sorts only by start date. The filters the list pages send keep working."""

from unittest.mock import patch

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.api import get_job_opportunities, get_job_opportunities_count
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_count, get_batches, get_course_count, get_courses

LIST_ENDPOINTS = {
	"get_courses": get_courses,
	"get_course_count": get_course_count,
	"get_batches": get_batches,
	"get_batch_count": get_batch_count,
}

# A key that names a field of a linked record, one per list.
LINKED_FIELD_KEYS = {
	"get_courses": "evaluator.evaluator",
	"get_course_count": "evaluator.evaluator",
	"get_batches": "zoom_account.account_id",
	"get_batch_count": "zoom_account.account_id",
}

UNSUPPORTED_VALUES = (
	["like", ["%a%"]],
	{"like": "%a%"},
	["regexp", "a"],
	["=", "a", "b"],
	[["=", "a"]],
)


class TestListFilters(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash

		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")

		# Pricing a card can look up the caller's country over the network.
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		cls.category = f"Filters {hash}"
		frappe.get_doc({"doctype": "LMS Category", "category": cls.category}).insert()

		cls.instructor = cls._create_user(
			f"filters-instr-{hash}@example.com", "Ina", "Instr", ["Course Creator"]
		)
		cls.student = cls._create_user(f"filters-stud-{hash}@example.com", "Stu", "Dent", ["LMS Student"])

		cls.course = cls._make_course(f"Filters Course {hash}")
		cls.batch = cls._make_batch(f"Filters Batch {hash}")
		cls._create_enrollment(cls.student.name, cls.course.name)
		cls._create_batch_enrollment(cls.student.name, cls.batch.name)
		cls.job = cls._post_job()

	@classmethod
	def _make_course(cls, title):
		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": title,
				"short_introduction": "intro",
				"description": "description",
				"category": cls.category,
				"published": 1,
				"published_on": nowdate(),
				"enable_certification": 1,
				"instructors": [{"instructor": cls.instructor.name}],
			}
		)
		course.save()
		return course

	@classmethod
	def _make_batch(cls, title):
		batch = frappe.new_doc("LMS Batch")
		batch.update(
			{
				"title": title,
				"published": 1,
				"certification": 1,
				"category": cls.category,
				"start_date": add_days(nowdate(), 5),
				"end_date": add_days(nowdate(), 30),
				"start_time": "10:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": "description",
				"batch_details": "details",
				"instructors": [{"instructor": cls.instructor.name}],
			}
		)
		batch.save()
		return batch

	@classmethod
	def _post_job(cls):
		return frappe.get_doc(
			{
				"doctype": "Job Opportunity",
				"job_title": f"Filters job {cls.hash}",
				"status": "Open",
				"location": "Remote",
				"type": "Full Time",
				"work_mode": "Remote",
				"description": "A job.",
				"company_name": f"Filters Company {cls.hash}",
				"company_website": "https://example.com",
				"company_email_address": cls.instructor.name,
				"company_logo": "https://example.com/logo.png",
				"country": frappe.db.get_value("Country", {}, "name"),
			}
		).insert(ignore_permissions=True)

	def as_user(self, user, fn, *args, **kwargs):
		frappe.set_user(user)
		try:
			return fn(*args, **kwargs)
		finally:
			frappe.set_user("Administrator")

	def callers(self):
		return ("Guest", self.student.name)

	def assert_refused(self, user, fn, **kwargs):
		self.assertRaises(frappe.ValidationError, self.as_user, user, fn, **kwargs)

	def test_a_key_into_a_linked_record_is_refused(self):
		for user in self.callers():
			for name, endpoint in LIST_ENDPOINTS.items():
				with self.subTest(user=user, endpoint=name):
					filters = {LINKED_FIELD_KEYS[name]: ["like", "%"]}
					self.assert_refused(user, endpoint, filters=filters)

	def test_a_field_the_list_does_not_offer_is_refused(self):
		for user in self.callers():
			for name, endpoint in LIST_ENDPOINTS.items():
				with self.subTest(user=user, endpoint=name):
					self.assert_refused(user, endpoint, filters={"owner": ["like", "%"]})

	def test_a_value_that_is_not_plain_is_refused(self):
		for user in self.callers():
			for name, endpoint in LIST_ENDPOINTS.items():
				for value in UNSUPPORTED_VALUES:
					with self.subTest(user=user, endpoint=name, value=value):
						self.assert_refused(user, endpoint, filters={"category": value})

	def test_batches_sort_only_by_start_date(self):
		"""Any other sort falls back to start date, earliest first, rather than failing the list."""
		later = self._make_batch(f"Filters Later Batch {self.hash}")
		later.start_date = add_days(nowdate(), 10)
		later.save()
		earliest_first = [self.batch.name, later.name]
		expected = {
			"start_date desc": earliest_first[::-1],
			"Start_Date  DESC": earliest_first[::-1],
			"start_date": earliest_first,
			None: earliest_first,
			"creation desc": earliest_first,
			"zoom_account.account_id": earliest_first,
			"start_date, (select 1)": earliest_first,
		}
		for user in self.callers():
			for order_by, names in expected.items():
				with self.subTest(user=user, order_by=order_by):
					batches = self.as_user(
						user, get_batches, filters={"category": self.category}, order_by=order_by
					)
					self.assertEqual([batch.name for batch in batches], names)

	def test_a_comma_separated_in_filter_is_accepted(self):
		for user in self.callers():
			with self.subTest(user=user):
				self.assert_lists_batch(user, {"category": ["in", f"{self.category},Other"]}, "start_date")

	def test_the_refusal_does_not_echo_markup(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.ValidationError) as refused:
			get_batches(filters={"<b>x</b>": 1})
		self.assertNotIn("<b>x</b>", str(refused.exception))

	def test_the_course_list_filters_still_work(self):
		search = ["like", f"%{self.hash}%"]
		shapes = {
			"live tab": {"published": 1, "upcoming": 0, "live": 1, "category": self.category},
			"new tab": {
				"published": 1,
				"published_on": [">=", add_days(nowdate(), -90)],
				"category": self.category,
			},
			"search": {"published": 1, "live": 1, "upcoming": 0, "title": search},
			"certification": {"published": 1, "certification": 1, "category": self.category},
		}
		for user in self.callers():
			for label, filters in shapes.items():
				with self.subTest(user=user, shape=label):
					self.assert_lists_course(user, filters)

		self.assert_lists_course(self.student.name, {"enrolled": 1, "category": self.category})
		self.assert_lists_course(self.instructor.name, {"created": 1, "category": self.category})

	def test_the_batch_list_filters_still_work(self):
		today = nowdate()
		shapes = {
			"upcoming tab": ({"published": 1, "start_date": [">=", today]}, "start_date"),
			"active tab": ({"published": 1, "end_date": [">=", today]}, "start_date"),
			"search": (
				{"published": 1, "start_date": [">=", today], "title": ["like", f"%{self.hash}%"]},
				"start_date",
			),
			"certification": ({"published": 1, "certification": 1}, "start_date"),
		}
		for user in self.callers():
			for label, (filters, order_by) in shapes.items():
				with self.subTest(user=user, shape=label):
					self.assert_lists_batch(user, {**filters, "category": self.category}, order_by)

		self.assert_lists_batch(self.student.name, {"enrolled": 1}, "start_date desc")

	def test_the_archived_batch_tab_is_accepted(self):
		filters = {"start_date": ["<=", nowdate()], "category": self.category}
		self.assertEqual(self.as_user(self.student.name, get_batches, filters=filters), [])
		self.assertEqual(self.as_user(self.student.name, get_batch_count, filters=filters), 0)

	def test_a_job_filter_value_that_is_not_plain_is_refused(self):
		cases = (
			({"status": [["=", "Open"]]}, None),
			({"type": ["regexp", "Full"]}, None),
			({"country": {"like": "%"}}, None),
			(None, {"job_title": ["like", ["%a%"]]}),
		)
		for user in self.callers():
			for endpoint in (get_job_opportunities, get_job_opportunities_count):
				for filters, or_filters in cases:
					with self.subTest(
						user=user, endpoint=endpoint.__name__, filters=filters, or_filters=or_filters
					):
						self.assert_refused(user, endpoint, filters=filters, or_filters=or_filters)

	def test_the_job_search_still_works(self):
		search = ["like", f"%{self.hash}%"]
		filters = {
			"status": "Open",
			"type": "Full Time",
			"work_mode": "Remote",
			"country": self.job.country,
		}
		or_filters = {"job_title": search, "company_name": search, "location": search}
		for user in self.callers():
			with self.subTest(user=user):
				jobs = self.as_user(
					user, get_job_opportunities, filters=filters.copy(), or_filters=or_filters
				)
				self.assertEqual([job.name for job in jobs], [self.job.name])
				count = self.as_user(
					user, get_job_opportunities_count, filters=filters.copy(), or_filters=or_filters
				)
				self.assertEqual(count, 1)

	def assert_lists_course(self, user, filters):
		courses = self.as_user(user, get_courses, filters=filters.copy())
		self.assertEqual([course.name for course in courses], [self.course.name])
		self.assertEqual(self.as_user(user, get_course_count, filters=filters.copy()), 1)

	def assert_lists_batch(self, user, filters, order_by):
		batches = self.as_user(user, get_batches, filters=filters.copy(), order_by=order_by)
		self.assertEqual([batch.name for batch in batches], [self.batch.name])
		self.assertEqual(self.as_user(user, get_batch_count, filters=filters.copy()), 1)
