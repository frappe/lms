# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Guests see an instructor's name and avatar on course and batch pages, never their bio.
Signed-in users keep the bio for the instructor card."""

from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_details, get_batches, get_course_details, get_courses

BIO = "<p>Teaches accounting.</p>"


class TestInstructorBioDisclosure(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)

		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		cls.instructor = cls._create_user(
			f"bio-instr-{hash}@example.com", "Bea", "Instr", ["Course Creator"]
		).name
		frappe.db.set_value("User", cls.instructor, "bio", BIO)
		cls.student = cls._create_user(f"bio-stud-{hash}@example.com", "Sid", "Stud", ["LMS Student"]).name

		cls.course = cls._create_course(f"Bio Disclosure {hash}", instructor=cls.instructor).name
		cls.batch = cls._create_batch(
			cls.course,
			instructor=cls.instructor,
			title=f"Bio Disclosure Batch {hash}",
			evaluator=None,
		).name

	def _as(self, user, fn):
		frappe.set_user(user)
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	def _instructor_lists(self, user):
		def listed(rows, name):
			return next(row for row in rows if row.name == name).instructors

		return {
			"get_course_details": self._as(user, lambda: get_course_details(self.course)).instructors,
			"get_courses": listed(self._as(user, lambda: get_courses(limit_page_length=500)), self.course),
			"get_batch_details": self._as(user, lambda: get_batch_details(self.batch)).instructors,
			"get_batches": listed(self._as(user, lambda: get_batches(limit_page_length=500)), self.batch),
		}

	def test_guest_gets_no_instructor_bio(self):
		for endpoint, instructors in self._instructor_lists("Guest").items():
			with self.subTest(endpoint=endpoint):
				self.assertEqual([row.full_name for row in instructors], ["Bea Instr"])
				self.assertEqual([row.bio for row in instructors], [None])

	def test_signed_in_user_gets_instructor_bio(self):
		for endpoint, instructors in self._instructor_lists(self.student).items():
			with self.subTest(endpoint=endpoint):
				self.assertEqual([row.bio for row in instructors], [BIO])
