# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

"""Integration tests for the RediSearch LMS backend.

Mock-free: exercises the real RediSearch module in the cache Redis and the real
command-palette permission/grouping. Skips itself when the module is absent.
"""

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.redisearch import LearningRediSearch, delete_index, is_search_module_loaded


class TestLearningRediSearch(BaseTestUtils):
	def setUp(self):
		super().setUp()
		if not is_search_module_loaded():
			self.skipTest("RediSearch module not loaded in cache Redis")

		self._prev_backend = frappe.db.get_single_value("LMS Settings", "search_backend")
		frappe.db.set_single_value("LMS Settings", "search_backend", "RediSearch")

		# _create_course links an instructor User that must exist first.
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		self.course = self._create_course(title="Redisearch Probe Course")
		self.search = LearningRediSearch()
		self.search.build_index()

	def tearDown(self):
		try:
			self.search.drop_index()
			frappe.db.set_single_value("LMS Settings", "search_backend", self._prev_backend)
		finally:
			super().tearDown()

	def _course_found(self, term):
		return self.course.name in {
			r["name"] for r in self.search.search(term)["results"] if r["doctype"] == "LMS Course"
		}

	def test_index_exists_after_build(self):
		self.assertTrue(self.search.index_exists())

	def test_search_finds_course(self):
		result = self.search.search("probe")
		names = {r["name"] for r in result["results"] if r["doctype"] == "LMS Course"}
		self.assertIn(self.course.name, names)

	def test_result_shape(self):
		result = self.search.search("probe")
		self.assertTrue(result["results"])
		row = next(r for r in result["results"] if r["name"] == self.course.name)
		for key in ("doctype", "name", "title", "content", "author", "published", "modified"):
			self.assertIn(key, row)
		self.assertEqual(row["published"], 1)

	def test_empty_query_returns_nothing(self):
		for q in ("", "   ", "***"):
			self.assertEqual(self.search.search(q)["results"], [])

	def test_instructors_searchable_and_delete_isolated(self):
		"""Each Course Instructor keeps its own index entry, so all instructors of
		a course are searchable by name; deleting one drops only that entry and
		leaves the other instructors — and the course itself — searchable."""
		self._create_user("alice.q@example.com", "Alice", "Quibbleton", ["Moderator", "Course Creator"])
		self._create_user("bob.z@example.com", "Bob", "Zephyrix", ["Moderator", "Course Creator"])
		course = frappe.get_doc("LMS Course", self.course.name)
		course.append("instructors", {"instructor": "alice.q@example.com"})
		course.append("instructors", {"instructor": "bob.z@example.com"})
		course.save()
		self.search.build_index()

		# Both instructors' distinctive names find the course.
		self.assertTrue(self._course_found("Quibbleton"))
		self.assertTrue(self._course_found("Zephyrix"))

		bob_row = next(
			r.name
			for r in frappe.get_all(
				"Course Instructor",
				filters={"parenttype": "LMS Course", "parent": self.course.name},
				fields=["name", "instructor"],
			)
			if r.instructor == "bob.z@example.com"
		)
		delete_index(frappe.get_doc("Course Instructor", bob_row))

		# Bob's entry is gone; Alice and the course remain searchable.
		self.assertFalse(self._course_found("Zephyrix"))
		self.assertTrue(self._course_found("Quibbleton"))
		self.assertTrue(self._course_found("probe"))

	def test_command_palette_routes_to_redisearch(self):
		from lms.command_palette import search_sqlite

		groups = search_sqlite("probe")
		courses = next((g["items"] for g in groups if g["title"] == "Courses"), [])
		self.assertIn(self.course.name, {c["name"] for c in courses})

	def test_parent_delete_drops_entries_even_without_child_rows(self):
		"""Deleting a course drops its own entry AND its denormalised instructor
		entries by querying the index, so it holds even when the child rows are
		already gone from SQL by the time the trash event runs."""
		# Simulate the delete flow where children are removed before the parent's
		# trash hook: blow the Course Instructor rows away from the DB first.
		frappe.db.delete(
			"Course Instructor",
			{"parenttype": "LMS Course", "parent": self.course.name},
		)
		delete_index(frappe.get_doc("LMS Course", self.course.name))
		names = {r["name"] for r in self.search.search("probe")["results"]}
		self.assertNotIn(self.course.name, names)

	def test_instructor_removed_via_course_edit_drops_from_search(self):
		"""Removing an instructor by editing the course (a child-row delete with
		no trash event) still drops it from search, because the parent update
		re-syncs all of its entries."""
		self._create_user("carl.x@example.com", "Carl", "Xylophone", ["Moderator", "Course Creator"])
		course = frappe.get_doc("LMS Course", self.course.name)
		course.append("instructors", {"instructor": "carl.x@example.com"})
		course.save()
		self.search.build_index()
		self.assertTrue(self._course_found("Xylophone"))

		# Remove Carl from the instructors table and save — fires update_index.
		course = frappe.get_doc("LMS Course", self.course.name)
		course.instructors = [i for i in course.instructors if i.instructor != "carl.x@example.com"]
		course.save()

		self.assertFalse(self._course_found("Xylophone"))
		self.assertTrue(self._course_found("probe"))

	def test_sqlite_backend_still_works_end_to_end(self):
		"""Regression: the SQLite backend keeps working when it is selected."""
		frappe.db.set_single_value("LMS Settings", "search_backend", "SQLite")
		try:
			from lms.sqlite import LearningSearch

			sqlite = LearningSearch()
			self.assertTrue(sqlite.is_search_enabled())
			sqlite.build_index()
			self.assertTrue(sqlite.index_exists())
			names = {r["name"] for r in sqlite.search("probe")["results"] if r["doctype"] == "LMS Course"}
			self.assertIn(self.course.name, names)
		finally:
			frappe.db.set_single_value("LMS Settings", "search_backend", "RediSearch")

	def test_sqlite_class_disabled_under_redisearch(self):
		from lms.sqlite import LearningSearch

		frappe.db.set_single_value("LMS Settings", "search_backend", "RediSearch")
		self.assertFalse(LearningSearch().is_search_enabled())
		frappe.db.set_single_value("LMS Settings", "search_backend", "SQLite")
		self.assertTrue(LearningSearch().is_search_enabled())
		frappe.db.set_single_value("LMS Settings", "search_backend", "RediSearch")
