# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.search.sqlite_search import SQLiteSearch
from frappe.search.sqlite_search import build_index as framework_build_index
from frappe.tests.utils import FrappeTestCase

from lms.install import build_search_index
from lms.sqlite import LearningSearch


class TestSearchIndexBuild(FrappeTestCase):
	"""Frappe builds, resumes and schedules the Learning index itself (issue #2859)."""

	def test_frappe_can_build_and_resume_the_index(self):
		# Frappe passes is_continuation on every build; an override without it raised TypeError.
		framework_build_index(LearningSearch, force=True)
		framework_build_index(LearningSearch, force=True, is_continuation=True)

		self.assertTrue(LearningSearch().index_exists())

	def test_build_index_is_frappes_own(self):
		self.assertIs(LearningSearch.build_index, SQLiteSearch.build_index)

	def test_install_queues_the_first_build(self):
		with (
			patch("lms.sqlite.LearningSearch.index_exists", return_value=False),
			patch("frappe.search.sqlite_search.os.path.exists", return_value=False),
			patch("frappe.search.sqlite_search.frappe.enqueue") as enqueue,
		):
			build_search_index()

		paths = [call.kwargs.get("search_class_path") for call in enqueue.call_args_list]
		self.assertIn("lms.sqlite.LearningSearch", paths)

	def test_lms_schedules_no_build_of_its_own(self):
		# A second scheduler that resets progress re-indexed every document on each tick.
		hooks = frappe.get_hooks("scheduler_events").get("all", []) + frappe.get_hooks("after_migrate")
		self.assertFalse([hook for hook in hooks if hook.startswith("lms.sqlite.")])
