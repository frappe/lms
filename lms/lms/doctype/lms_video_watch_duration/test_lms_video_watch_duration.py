# Copyright (c) 2025, Frappe and Contributors
# See license.txt

import frappe
from frappe.tests import UnitTestCase

from lms.lms.doctype.lms_video_watch_duration.lms_video_watch_duration import on_doctype_update


class UnitTestLMSVideoWatchDuration(UnitTestCase):
	"""Schema-level tests for LMS Video Watch Duration (no fixtures required)."""

	def test_lookup_index_exists(self):
		"""The (member, lesson, source) lookup in track_video_watch_duration
		must be index-backed; guards against the index being dropped."""
		self.assertTrue(frappe.db.has_index("tabLMS Video Watch Duration", "member_lesson_source_index"))

	def test_on_doctype_update_creates_index(self):
		"""on_doctype_update backs the new-site path (the one-time patch is
		marked complete-without-running on fresh installs). Drop the index and
		confirm a doctype sync recreates it."""
		frappe.db.sql_ddl("DROP INDEX IF EXISTS member_lesson_source_index ON `tabLMS Video Watch Duration`")
		self.assertFalse(frappe.db.has_index("tabLMS Video Watch Duration", "member_lesson_source_index"))
		on_doctype_update()
		self.assertTrue(frappe.db.has_index("tabLMS Video Watch Duration", "member_lesson_source_index"))
