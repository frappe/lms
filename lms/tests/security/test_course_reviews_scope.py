# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""get_reviews answers only a caller who may open the course page, like its siblings
get_batch_courses, get_related_courses and get_course_details."""

import json

import frappe
from frappe.tests import change_settings

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_average_rating, get_reviews

GUEST_ACCESS_ON = change_settings("LMS Settings", allow_guest_access=1)


class TestTheCourseReviewsScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls) -> None:
		super().setUpClass()
		# LMS Settings is read through get_cached_value and the roles hash outlives
		# a rollback, so both are warmed from whichever checkout ran last.
		frappe.clear_cache()
		suffix = frappe.generate_hash(length=8)

		cls.moderator = cls._create_user(f"rev-mod-{suffix}@example.com", "Rev", "Mod", ["Moderator"]).name
		cls.evaluator = cls._create_user(
			f"rev-eval-{suffix}@example.com", "Rev", "Eval", ["Batch Evaluator"]
		).name
		cls.outsider = cls._create_user(
			f"rev-outsider-{suffix}@example.com", "Rev", "Outsider", ["LMS Student"]
		).name
		cls.reviewer = cls._create_user(
			f"rev-author-{suffix}@example.com", "Rev", "Author", ["LMS Student"]
		).name
		cls.instructor = cls._create_user(
			f"rev-instructor-{suffix}@example.com", "Rev", "Instructor", ["LMS Student"]
		).name

		cls.secret = f"SECRET REVIEW BODY {suffix}"
		cls.public_text = f"PUBLIC REVIEW BODY {suffix}"
		cls.draft = cls._seed_course(f"Review Draft {suffix}", published=0, secret=cls.secret)
		cls.live = cls._seed_course(f"Review Live {suffix}", published=1, secret=cls.public_text)

		cls.denied = {
			"guest": "Guest",
			"student": cls.outsider,
			"batch_evaluator": cls.evaluator,
		}

	@classmethod
	def _seed_course(cls, title: str, published: int, secret: str) -> str:
		course = cls._create_course(title=title, instructor=cls.instructor)
		frappe.db.set_value("LMS Course", course.name, "published", published)
		cls._create_enrollment(cls.reviewer, course.name)
		cls._add_rating(course.name, cls.reviewer, 1, secret)
		return course.name

	def _as(self, user: str) -> None:
		frappe.set_user(user)
		self.addCleanup(frappe.set_user, "Administrator")

	def _payload(self, course: str) -> str:
		return json.dumps(get_reviews(course=course), default=str)

	@GUEST_ACCESS_ON
	def test_no_unentitled_caller_reads_an_unpublished_courses_reviews(self) -> None:
		"""Regression as old as the app (#316): get_reviews had no guest or published gate.
		Added for audit finding #38 on branch fix/hide-user-emails."""
		for kind, user in self.denied.items():
			with self.subTest(caller=kind):
				self._as(user)
				payload = self._payload(self.draft)
				self.assertEqual(payload, "[]")
				self.assertNotIn(self.secret, payload)
				self.assertNotIn(self.reviewer, payload)
				frappe.set_user("Administrator")

	@GUEST_ACCESS_ON
	def test_a_moderator_still_reads_them(self) -> None:
		"""CONTROL. The fix cannot move this one. If it fails, the reds above are
		environmental."""
		self._as(self.moderator)
		self.assertIn(self.secret, self._payload(self.draft))

	@GUEST_ACCESS_ON
	def test_the_courses_own_instructor_still_reads_them(self) -> None:
		"""CONTROL. can_modify_course is the same predicate its three siblings ask,
		and an author carrying no LMS staff role passes it."""
		self._as(self.instructor)
		self.assertIn(self.secret, self._payload(self.draft))

	@GUEST_ACCESS_ON
	def test_an_enrolled_student_still_reads_them(self) -> None:
		"""CONTROL. A student enrolled on a course that was later unpublished keeps
		the course page, so it keeps the reviews on it."""
		self._as(self.reviewer)
		self.assertIn(self.secret, self._payload(self.draft))

	@GUEST_ACCESS_ON
	def test_a_published_courses_rows_carry_exactly_the_keys_the_endpoint_declares(self) -> None:
		"""Widening the payload later is then a deliberate act that fails a test."""
		self._as("Guest")
		row = get_reviews(course=self.live)[0]
		# No `owner`: it is the reviewer's login email, sent to staff only.
		self.assertEqual(set(row), {"review", "rating", "creation", "owner_details"})
		self.assertEqual(set(row["owner_details"]), {"username", "full_name", "user_image"})

	def test_guest_access_off_shuts_the_reviews_too(self) -> None:
		"""The guest flag is switched inside the test (permission-and-security-tests.md section 9);
		off, the published course closes too."""
		self._as("Guest")
		with change_settings("LMS Settings", allow_guest_access=0):
			self.assertEqual(get_reviews(course=self.live), [])

	@GUEST_ACCESS_ON
	def test_an_unknown_course_answers_empty_rather_than_raising(self) -> None:
		"""The unpublished answer and the does-not-exist answer are the same, so
		the endpoint is not an oracle for which course names are real."""
		self._as("Guest")
		self.assertEqual(get_reviews(course=f"no-such-course-{frappe.generate_hash(length=6)}"), [])

	def test_the_nightly_statistics_job_still_averages_a_draft_courses_ratings(self) -> None:
		"""CONTROL for the split: update_course_statistics averages every course on
		the site, including ones whose page nobody may open, so get_average_rating
		reads the rows directly rather than through the gated endpoint."""
		self.assertEqual(get_average_rating(self.draft), 5.0)
		self._as("Guest")
		self.assertEqual(get_average_rating(self.draft), 5.0)
