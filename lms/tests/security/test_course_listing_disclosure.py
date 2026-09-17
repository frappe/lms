# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""F-39 / ticket 75883: the course and batch lists must not hand out drafts.

`get_courses` / `get_batches` are whitelisted with allow_guest and pass
caller-supplied filters straight to the query, so `{"published": 0}` returned
every unpublished course and batch on the site -- to a guest and to any
logged-in user alike. `get_course_outline` had the same shape: it gated on
`guest_access_allowed()` and then read the chapters of whatever course it was
handed.
"""

from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batches, get_course_outline, get_courses

MAX = 120


class TestCourseListingDisclosure(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash

		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")

		# Pricing a course card falls through to get_country_code(), which makes an
		# un-timeouted request to ip-api.com when the user has no country set. A
		# disclosure test must not depend on the network being up.
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		if not frappe.db.exists("LMS Category", "Business"):
			category = frappe.new_doc("LMS Category")
			category.category = "Business"
			category.save()

		# Deliberately NOT a Moderator: the `created` tab has to keep working for a
		# plain author, which is the regression a blanket published=1 would cause.
		cls.instructor = cls._create_user(
			f"disc-instr-{hash}@example.com", "Ira", "Instr", ["Course Creator"]
		)
		cls.moderator = cls._create_user(f"disc-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		cls.student = cls._create_user(f"disc-stud-{hash}@example.com", "Sam", "Stud", ["LMS Student"])

		cls.draft = cls._make_course(f"Disclosure Draft {hash}", 0)
		cls.draft_enrolled = cls._make_course(f"Disclosure Draft Enrolled {hash}", 0)
		cls.live = cls._make_course(f"Disclosure Live {hash}", 1)

		# The outline assertions need a course with something in it: an unprotected
		# outline of an empty course returns [] too, which would pass either way.
		for course in (cls.draft, cls.draft_enrolled, cls.live):
			cls._make_chapter(course.name)

		cls._create_enrollment(cls.student.name, cls.draft_enrolled.name)

		cls.draft_batch = cls._make_batch(f"Disclosure Draft Batch {hash}", 0)
		cls.live_batch = cls._make_batch(f"Disclosure Live Batch {hash}", 1)
		cls._create_batch_enrollment(cls.student.name, cls.draft_batch.name)

	@classmethod
	def _make_course(cls, title, published):
		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": title,
				"short_introduction": "intro",
				"description": "description",
				"category": "Business",
				"published": published,
			}
		)
		course.append("instructors", {"instructor": cls.instructor.name})
		course.save()
		return course

	@classmethod
	def _make_chapter(cls, course):
		chapter = frappe.new_doc("Course Chapter")
		chapter.update({"title": f"Chapter of {course}", "course": course})
		chapter.save()
		reference = frappe.new_doc("Chapter Reference")
		reference.update(
			{
				"parent": course,
				"parenttype": "LMS Course",
				"parentfield": "chapters",
				"chapter": chapter.name,
				"idx": 1,
			}
		)
		reference.insert()
		return chapter

	@classmethod
	def _make_batch(cls, title, published):
		batch = frappe.new_doc("LMS Batch")
		batch.update(
			{
				"title": title,
				"published": published,
				"category": "Business",
				"start_date": "2026-01-01",
				"end_date": "2026-12-31",
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

	def _as(self, user, fn):
		frappe.set_user(user)
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	# -- the leak ---------------------------------------------------------

	def test_unentitled_callers_never_get_unpublished_courses(self):
		for case, user in (("guest", "Guest"), ("plain_student", self.student.name)):
			with self.subTest(case=case):
				self.assertTrue("Moderator" not in frappe.get_roles(user) if user != "Guest" else True)
				rows = self._as(user, lambda: get_courses(filters={"published": 0}, limit_page_length=MAX))
				self.assertEqual(
					[row.name for row in rows if not row.published],
					[],
					"published=0 must be overridden for a caller with no claim to drafts",
				)
				self.assertNotIn(self.draft.name, [row.name for row in rows])

	def test_unentitled_callers_never_get_unpublished_batches(self):
		for case, user in (("guest", "Guest"), ("plain_student", self.student.name)):
			with self.subTest(case=case):
				rows = self._as(user, lambda: get_batches(filters={"published": 0}, limit_page_length=MAX))
				self.assertEqual([row.name for row in rows if not row.published], [])
				self.assertNotIn(self.draft_batch.name, [row.name for row in rows])

	def test_unentitled_callers_get_no_outline_for_an_unpublished_course(self):
		for case, user in (("guest", "Guest"), ("plain_student", self.student.name)):
			with self.subTest(case=case):
				self.assertEqual(self._as(user, lambda: get_course_outline(self.draft.name)), [])

	def test_or_filters_cannot_smuggle_a_draft_back_in(self):
		"""`title` / `certification` become or_filters; published must stay AND-ed."""
		rows = self._as(
			"Guest",
			lambda: get_courses(
				filters={"published": 0, "title": f"Disclosure Draft {self.hash}"},
				limit_page_length=MAX,
			),
		)
		self.assertEqual([row.name for row in rows if not row.published], [])

	# -- no regression ----------------------------------------------------

	def test_published_rows_are_unaffected(self):
		for case, user in (("guest", "Guest"), ("plain_student", self.student.name)):
			with self.subTest(case=case):
				# Narrowed by title: the site carries more published courses than one
				# page holds, so an unnarrowed page is not evidence either way.
				courses = self._as(
					user,
					lambda: get_courses(
						filters={"published": 1, "title": self.live.title}, limit_page_length=MAX
					),
				)
				self.assertIn(self.live.name, [row.name for row in courses])
				batches = self._as(user, lambda: get_batches(filters={"published": 1}, limit_page_length=MAX))
				self.assertIn(self.live_batch.name, [row.name for row in batches])
				self.assertTrue(self._as(user, lambda: get_course_outline(self.live.name)))

	def test_author_still_lists_their_own_drafts(self):
		self.assertNotIn("Moderator", frappe.get_roles(self.instructor.name))
		rows = self._as(
			self.instructor.name, lambda: get_courses(filters={"created": 1}, limit_page_length=MAX)
		)
		self.assertIn(self.draft.name, [row.name for row in rows])

	def test_member_still_lists_a_course_unpublished_under_them(self):
		rows = self._as(
			self.student.name, lambda: get_courses(filters={"enrolled": 1}, limit_page_length=MAX)
		)
		self.assertIn(self.draft_enrolled.name, [row.name for row in rows])

		batches = self._as(
			self.student.name, lambda: get_batches(filters={"enrolled": 1}, limit_page_length=MAX)
		)
		self.assertIn(self.draft_batch.name, [row.name for row in batches])

	def test_moderator_still_lists_every_draft(self):
		self.assertIn("Moderator", frappe.get_roles(self.moderator.name))
		rows = self._as(
			self.moderator.name, lambda: get_courses(filters={"published": 0}, limit_page_length=MAX)
		)
		self.assertIn(self.draft.name, [row.name for row in rows])

		batches = self._as(
			self.moderator.name, lambda: get_batches(filters={"published": 0}, limit_page_length=MAX)
		)
		self.assertIn(self.draft_batch.name, [row.name for row in batches])

	def test_entitled_callers_still_get_a_draft_outline(self):
		cases = (
			("author", self.instructor.name, self.draft.name),
			("moderator", self.moderator.name, self.draft.name),
			("enrolled_member", self.student.name, self.draft_enrolled.name),
		)
		for case, user, course in cases:
			with self.subTest(case=case):
				self.assertTrue(self._as(user, lambda: get_course_outline(course)))
