# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The `created` course filter lists the courses the caller instructs: a batch
tag never stands in for a course tag, and a course and a batch never share a
name."""

from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import generate_slug, get_courses


class TestCreatedCoursesFilter(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		cls.creator = cls._create_user(
			f"ccf-creator-{hash}@example.com", "Cr", "Eator", ["Course Creator"]
		).name
		cls.bystander = cls._create_user(
			f"ccf-by-{hash}@example.com", "By", "Stander", ["Course Creator"]
		).name
		cls._require_no_moderators(cls.creator, cls.bystander)
		cls.title = f"Shared Name {hash}"
		cls.course = cls._create_course(title=cls.title, instructor=cls.bystander).name
		frappe.db.set_value("LMS Course", cls.course, "published", 0)
		# The row a batch named like the course would leave: a batch tag on the
		# course's name.
		frappe.get_doc(
			{
				"doctype": "Course Instructor",
				"parent": cls.course,
				"parenttype": "LMS Batch",
				"parentfield": "instructors",
				"instructor": cls.creator,
			}
		).insert()

	def _created_courses(self, user):
		frappe.set_user(user)
		return [row["name"] for row in get_courses({"created": 1}, limit_page_length=100)]

	def test_a_batch_tag_on_the_courses_name_does_not_list_the_course(self):
		self.assertNotIn(self.course, self._created_courses(self.creator))

	def test_a_course_tag_lists_the_course(self):
		self.assertIn(self.course, self._created_courses(self.bystander))

	def test_a_course_and_a_batch_never_take_the_same_name(self):
		self.assertNotEqual(generate_slug(self.title, "LMS Batch"), self.course)
		evaluator = self._create_user(
			f"ccf-eval-{self.hash}@example.com", "Ev", "Al", ["Batch Evaluator"]
		).name
		self._create_evaluator(evaluator)
		batch = self._create_batch(
			self.course, instructor=self.bystander, title=f"Batch Name {self.hash}", evaluator=evaluator
		)
		self.assertNotEqual(generate_slug(batch.title, "LMS Course"), batch.name)
