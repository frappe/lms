# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""The job endpoints are guest-allowed. A closed post is for its poster and staff;
everyone else sees open posts only, however the status filter is spelled."""

import frappe

from lms.lms.api import get_job_details, get_job_opportunities, get_job_opportunities_count
from lms.lms.test_helpers import BaseTestUtils
from lms.www._lms import get_meta_from_document

CLOSED_SPELLINGS = (
	None,
	"Closed",
	["=", "Closed"],
	["in", ["Closed"]],
	["in", ["Open", "Closed"]],
	["!=", "Open"],
	["not in", ["Open"]],
	["like", "Clo%"],
	["is", "set"],
)


class TestJobVisibility(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash
		cls.poster = cls._create_user(f"job-poster-{hash}@example.com", "Job", "Poster", ["LMS Student"])
		cls.student = cls._create_user(f"job-stud-{hash}@example.com", "Job", "Stud", ["LMS Student"])
		cls.moderator = cls._create_user(f"job-mod-{hash}@example.com", "Job", "Mod", ["Moderator"])

		cls.open_job = cls._post_job("Open")
		cls.closed_job = cls._post_job("Closed")

	@classmethod
	def _post_job(cls, status):
		frappe.set_user(cls.poster.name)
		try:
			return frappe.get_doc(
				{
					"doctype": "Job Opportunity",
					"job_title": f"{status} job {cls.hash}",
					"status": status,
					"location": "Remote",
					"type": "Full Time",
					"description": "A job.",
					"company_name": f"Company {cls.hash}",
					"company_website": "https://example.com",
					"company_email_address": cls.poster.name,
					"company_logo": "https://example.com/logo.png",
					"country": frappe.db.get_value("Country", {}, "name"),
				}
			).insert()
		finally:
			frappe.set_user("Administrator")

	def as_user(self, user, fn, *args, **kwargs):
		frappe.set_user(user)
		try:
			return fn(*args, **kwargs)
		finally:
			frappe.set_user("Administrator")

	def listed(self, user, status):
		filters = {"status": status} if status is not None else {}
		jobs = self.as_user(user, get_job_opportunities, filters=frappe._dict(filters), page_length=1000)
		return {job.name for job in jobs}

	def test_closed_posts_are_not_listed_to_guest_or_another_user(self):
		"""Only the exact string "Closed" was held to the poster since #2325.
		Added for audit finding #77 on branch fix/draft-and-guest-disclosure."""
		for user in ("Guest", self.student.name):
			for status in CLOSED_SPELLINGS:
				with self.subTest(user=user, status=status):
					self.assertNotIn(self.closed_job.name, self.listed(user, status))

	def test_closed_posts_are_not_counted_for_guest_or_another_user(self):
		"""The count leaked closed posts the same way since #2325.
		Added for audit finding #77 on branch fix/draft-and-guest-disclosure."""
		for user in ("Guest", self.student.name):
			for status in CLOSED_SPELLINGS:
				with self.subTest(user=user, status=status):
					filters = {"status": status} if status is not None else {}
					everyone = self.as_user(self.moderator.name, get_job_opportunities_count, filters)
					theirs = self.as_user(user, get_job_opportunities_count, filters)
					listed = len(
						self.as_user(user, get_job_opportunities, filters=filters, page_length=100000)
					)
					self.assertEqual(theirs, listed)
					self.assertLess(theirs, everyone)

	def test_or_filters_do_not_reach_a_closed_post(self):
		"""A search with no status filter listed closed posts since #2325.
		Added for support ticket 79940 on branch fix/draft-and-guest-disclosure."""
		or_spellings = ({"status": "Closed"}, {"job_title": ["like", f"%{self.hash}%"]})
		for user in ("Guest", self.student.name):
			for or_filters in or_spellings:
				with self.subTest(user=user, or_filters=or_filters):
					jobs = self.as_user(
						user, get_job_opportunities, or_filters=frappe._dict(or_filters), page_length=1000
					)
					self.assertNotIn(self.closed_job.name, {job.name for job in jobs})

	def test_open_posts_are_still_listed_to_guest(self):
		for status in (None, "Open", ["=", "Open"], ["in", ["Open"]]):
			with self.subTest(status=status):
				self.assertIn(self.open_job.name, self.listed("Guest", status))

	def test_the_poster_still_lists_their_own_closed_post(self):
		for status in ("Closed", ["=", "Closed"], ["in", ["Closed"]]):
			with self.subTest(status=status):
				self.assertIn(self.closed_job.name, self.listed(self.poster.name, status))

	def test_a_moderator_lists_every_closed_post(self):
		for status in (None, "Closed"):
			with self.subTest(status=status):
				self.assertIn(self.closed_job.name, self.listed(self.moderator.name, status))

	def test_a_closed_post_has_no_details_for_guest_or_another_user(self):
		"""get_job_details answered any post by name since #713.
		Added for audit finding #77 on branch fix/draft-and-guest-disclosure."""
		for user in ("Guest", self.student.name):
			with self.subTest(user=user):
				self.assertFalse(self.as_user(user, get_job_details, self.closed_job.name))
				meta = self.as_user(user, get_meta_from_document, f"job-openings/{self.closed_job.name}")
				self.assertNotIn(self.closed_job.job_title, str(meta))

	def test_a_closed_post_keeps_its_details_for_the_poster_and_a_moderator(self):
		for user in (self.poster.name, self.moderator.name):
			with self.subTest(user=user):
				details = self.as_user(user, get_job_details, self.closed_job.name)
				self.assertEqual(details.job_title, self.closed_job.job_title)
				meta = self.as_user(user, get_meta_from_document, f"job-openings/{self.closed_job.name}")
				self.assertEqual(meta.get("title"), self.closed_job.job_title)

	def test_an_open_post_keeps_its_details_for_guest(self):
		details = self.as_user("Guest", get_job_details, self.open_job.name)
		self.assertEqual(details.job_title, self.open_job.job_title)
