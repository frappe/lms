# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import io
from contextlib import redirect_stdout

import frappe
from frappe.tests import IntegrationTestCase

from lms.lms.docperm_shadow import (
	LMS_MANAGED_CUSTOM_DOCPERM_DOCTYPES,
	get_shadowed_permlevel_rows,
	warn_about_shadowed_permlevels,
)

ALERT_TITLE_FRAGMENT = "Custom DocPerm"


class TestDocPermShadow(IntegrationTestCase):
	"""A Custom DocPerm row replaces a doctype's shipped permissions wholesale
	(frappe.model.meta.Meta.set_custom_permissions), so a shipped permlevel > 0 row
	stops applying with no error and no log line. These pin what the migrate-time
	alert reports, and what it stays quiet about."""

	def setUp(self):
		super().setUp()
		self.moved_permlevels: list[tuple[str, int]] = []
		self.added_custom_perms: list[str] = []
		self.touched_doctypes: set[str] = set()

	def tearDown(self):
		# IntegrationTestCase rolls the transaction back once per class, not per test,
		# so a DocPerm row moved here is still moved when the next test reads it.
		# Restore the shared rows by hand, newest first.
		for name, permlevel in reversed(self.moved_permlevels):
			frappe.db.set_value("DocPerm", name, "permlevel", permlevel)
		for name in reversed(self.added_custom_perms):
			# nosemgrep: lms-unjustified-ignore-permissions - removes a row this test itself added
			frappe.delete_doc("Custom DocPerm", name, ignore_permissions=True)
		for doctype in self.touched_doctypes:
			frappe.clear_cache(doctype=doctype)
		super().tearDown()

	def ship_permlevel_row(self, doctype: str, permlevel: int = 1) -> tuple[str, int]:
		"""Move one shipped DocPerm row up a permlevel, the way Tier 2 will ship it."""
		row = frappe.db.get_value(
			"DocPerm",
			{"parent": doctype, "parenttype": "DocType", "permlevel": 0},
			["name", "role"],
			as_dict=True,
		)
		self.assertIsNotNone(row, f"{doctype} ships no permlevel 0 DocPerm row to move")
		self.moved_permlevels.append((row.name, 0))
		frappe.db.set_value("DocPerm", row.name, "permlevel", permlevel)
		self.touched_doctypes.add(doctype)
		return row.role, permlevel

	def add_custom_docperm(self, doctype: str, role: str) -> None:
		"""What frappe writes the moment an admin saves a row in Role Permissions Manager."""
		perm = frappe.new_doc("Custom DocPerm")
		perm.update(
			{
				"parent": doctype,
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": role,
				"read": 1,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - stands in for the admin action under test
		perm.insert(ignore_permissions=True)
		self.added_custom_perms.append(perm.name)
		self.touched_doctypes.add(doctype)

	def get_alert(self) -> str:
		log = frappe.get_all(
			"Error Log",
			filters={"method": ("like", f"%{ALERT_TITLE_FRAGMENT}%")},
			fields=["method", "error"],
			order_by="creation desc",
			limit=1,
		)
		self.assertTrue(log, "the alert wrote no Error Log row")
		return log[0].error

	def test_a_stock_site_reports_nothing(self):
		"""The control every other test moves away from: LMS ships no permlevel > 0 row
		yet, so nothing is shadowed until one of these tests arranges it. If this fails,
		an earlier test leaked a DocPerm row rather than the detector being wrong."""
		self.assertEqual(get_shadowed_permlevel_rows(), {})

	def test_a_custom_docperm_shadowing_a_shipped_permlevel_row_is_reported(self):
		role, permlevel = self.ship_permlevel_row("LMS Course")
		self.add_custom_docperm("LMS Course", "Moderator")

		shadowed = get_shadowed_permlevel_rows()

		self.assertIn("LMS Course", shadowed)
		self.assertEqual(shadowed["LMS Course"], [(role, permlevel)])

	def test_a_custom_docperm_without_a_shipped_permlevel_row_is_not_reported(self):
		self.add_custom_docperm("LMS Batch", "Moderator")

		self.assertEqual(
			frappe.db.count("DocPerm", {"parent": "LMS Batch", "permlevel": (">", 0)}),
			0,
			"LMS Batch was expected to ship no permlevel > 0 row",
		)
		self.assertNotIn("LMS Batch", get_shadowed_permlevel_rows())

	def test_a_shipped_permlevel_row_without_custom_docperms_is_not_reported(self):
		self.ship_permlevel_row("LMS Quiz")

		self.assertEqual(frappe.db.count("Custom DocPerm", {"parent": "LMS Quiz"}), 0)
		self.assertNotIn("LMS Quiz", get_shadowed_permlevel_rows())

	def test_the_discussion_shadow_lms_ships_is_not_reported(self):
		"""lms/patches/v1_0/custom_perm_for_discussions.py puts Custom DocPerm rows on
		Discussion Topic and Discussion Reply on every site. That shadow is LMS's own."""
		for doctype in ("Discussion Topic", "Discussion Reply"):
			self.assertTrue(
				frappe.db.count("Custom DocPerm", {"parent": doctype}),
				f"{doctype} carries no Custom DocPerm rows - the v1_0 patch did not run",
			)
			self.ship_permlevel_row(doctype)

		# The same shape on a doctype LMS owns, so the silence below is the exclusion
		# doing its job and not the absence of anything to report.
		role, permlevel = self.ship_permlevel_row("LMS Course")
		self.add_custom_docperm("LMS Course", "Moderator")

		shadowed = get_shadowed_permlevel_rows()

		self.assertEqual(shadowed["LMS Course"], [(role, permlevel)])
		self.assertNotIn("Discussion Topic", shadowed)
		self.assertNotIn("Discussion Reply", shadowed)

	def test_a_doctype_lms_does_not_own_is_not_reported(self):
		"""User satisfies both halves on every LMS site: install.py writes the Custom
		DocPerm rows and frappe ships a permlevel 1 row. It is not LMS's to report."""
		self.assertTrue(frappe.db.count("Custom DocPerm", {"parent": "User"}))
		self.assertTrue(frappe.db.count("DocPerm", {"parent": "User", "permlevel": (">", 0)}))

		self.assertNotIn("User", get_shadowed_permlevel_rows())

	def test_every_doctype_lms_deliberately_shadows_is_excluded(self):
		for doctype in LMS_MANAGED_CUSTOM_DOCPERM_DOCTYPES:
			self.ship_permlevel_row(doctype)

		shadowed = get_shadowed_permlevel_rows()

		for doctype in LMS_MANAGED_CUSTOM_DOCPERM_DOCTYPES:
			self.assertNotIn(doctype, shadowed)

	def test_the_alert_names_the_doctype_the_rows_and_what_to_do(self):
		role, permlevel = self.ship_permlevel_row("LMS Course")
		self.add_custom_docperm("LMS Course", "Moderator")

		stdout = io.StringIO()
		with redirect_stdout(stdout):
			warn_about_shadowed_permlevels()

		alert = self.get_alert()
		self.assertIn("LMS Course", alert)
		self.assertIn(role, alert)
		self.assertIn(f"permlevel {permlevel}", alert)
		self.assertIn("Role Permissions Manager", alert)
		self.assertIn("LMS Course", stdout.getvalue())

	def test_the_alert_stays_quiet_when_nothing_is_shadowed(self):
		errors_before = frappe.db.count("Error Log")

		stdout = io.StringIO()
		with redirect_stdout(stdout):
			warn_about_shadowed_permlevels()

		self.assertEqual(frappe.db.count("Error Log"), errors_before)
		self.assertEqual(stdout.getvalue(), "")
