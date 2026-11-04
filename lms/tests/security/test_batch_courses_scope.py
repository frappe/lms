# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The courses of a batch are read by whoever reads the batch: anyone once it
is published, and its students and staff before that."""

from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_courses


class TestBatchCoursesScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		guest_access = frappe.db.get_single_value("LMS Settings", "allow_guest_access")
		cls.addClassCleanup(cls._set_guest_access, guest_access)
		cls._set_guest_access(1)
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		cls.instructor = cls._create_user(
			f"bcs-instr-{hash}@example.com", "In", "Str", ["Course Creator"]
		).name
		cls.evaluator = cls._create_user(f"bcs-eval-{hash}@example.com", "Ev", "Al", ["Batch Evaluator"]).name
		cls.student = cls._create_user(f"bcs-stud-{hash}@example.com", "St", "Udent", ["LMS Student"]).name
		cls.outsider = cls._create_user(f"bcs-out-{hash}@example.com", "Ou", "Tsider", ["LMS Student"]).name
		cls._create_evaluator(cls.evaluator)
		cls.course = cls._create_course(title=f"Batch Course {hash}", instructor=cls.instructor).name
		cls.batch = cls._create_batch(
			cls.course, instructor=cls.instructor, title=f"Unpublished Batch {hash}", evaluator=cls.evaluator
		).name
		frappe.db.set_value("LMS Batch", cls.batch, "published", 0)
		cls._create_batch_enrollment(cls.student, cls.batch)

	@classmethod
	def _set_guest_access(cls, value):
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", value)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")

	def _courses_as(self, user):
		frappe.set_user(user)
		return [course["name"] for course in get_batch_courses(self.batch)]

	def test_a_guest_and_an_unrelated_learner_get_nothing_for_an_unpublished_batch(self):
		for user in ("Guest", self.outsider):
			with self.subTest(user=user):
				self.assertEqual(self._courses_as(user), [])

	def test_its_students_and_staff_get_the_courses(self):
		for user in (self.student, self.instructor, self.evaluator):
			with self.subTest(user=user):
				self.assertEqual(self._courses_as(user), [self.course])

	def test_anyone_gets_the_courses_of_a_published_batch(self):
		frappe.db.set_value("LMS Batch", self.batch, "published", 1)
		self.assertEqual(self._courses_as(self.outsider), [self.course])
