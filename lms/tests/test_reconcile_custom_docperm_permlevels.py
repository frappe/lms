# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import io
from contextlib import redirect_stdout

import frappe
from frappe.client import get as client_get
from frappe.permissions import rights
from frappe.tests import IntegrationTestCase
from frappe.utils import cint

from lms.lms.docperm_shadow import get_shadowed_permlevel_rows, warn_about_shadowed_permlevels
from lms.patches.v2_0.reconcile_custom_docperm_permlevels import reconcile

ASSIGNMENT_DOCTYPE = "LMS Assignment"
ASSIGNMENT_FIELD = "answer"
ASSIGNMENT_PERMLEVEL_ROLES = ("System Manager", "Moderator", "Course Creator", "Batch Evaluator")
TEST_MODERATOR_EMAIL = "reconcile-permlevels-test-moderator@example.com"


class TestReconcileCustomDocPermPermlevels(IntegrationTestCase):
	"""lms.patches.v2_0.reconcile_custom_docperm_permlevels.reconcile() re-adds, to the
	Custom DocPerm set of each doctype it is handed, the shipped permlevel > 0 DocPerm
	rows that set has shadowed (frappe.model.meta.Meta.set_custom_permissions replaces a
	doctype's permissions wholesale the moment it has any Custom DocPerm row -- see
	lms/lms/docperm_shadow.py). The shipped rows are read from tabDocPerm, the table that
	replacement never touches, and no doctype outside the list is written to."""

	def setUp(self):
		super().setUp()
		self.added_docperms: list[str] = []
		self.moved_docperm_permlevels: list[tuple[str, int]] = []
		self.moved_field_permlevels: list[tuple[str, int]] = []
		self.created_users: list[str] = []
		self.created_docs: list[tuple[str, str]] = []
		self.touched_doctypes: set[str] = set()
		# Cleanup is by snapshot-diff rather than by tracked name: reconcile() inserts
		# Custom DocPerm rows this file never names, so the only honest record of what a
		# test added is what was not there before it. Site-wide, because the doctype a
		# test arranges is no longer always LMS Assignment.
		self.custom_perm_baseline = set(frappe.get_all("Custom DocPerm", pluck="name"))

	def tearDown(self):
		# IntegrationTestCase rolls the transaction back once per class, not per test, so
		# a row written here is still there when the next test reads it. Restore the
		# shared rows by hand, newest first.
		frappe.set_user("Administrator")

		leaked = set(frappe.get_all("Custom DocPerm", pluck="name")) - self.custom_perm_baseline
		for name in leaked:
			if frappe.db.exists("Custom DocPerm", name):
				# nosemgrep: lms-unjustified-ignore-permissions - removes a row this test (or reconcile() under test) added
				frappe.delete_doc("Custom DocPerm", name, ignore_permissions=True)

		for doctype, name in reversed(self.created_docs):
			if frappe.db.exists(doctype, name):
				# nosemgrep: lms-unjustified-ignore-permissions - removes a fixture doc this test created
				frappe.delete_doc(doctype, name, ignore_permissions=True, force=True)

		for email in reversed(self.created_users):
			if frappe.db.exists("User", email):
				# nosemgrep: lms-unjustified-ignore-permissions - removes a fixture user this test created
				frappe.delete_doc("User", email, ignore_permissions=True, force=True)

		for name in reversed(self.added_docperms):
			if frappe.db.exists("DocPerm", name):
				# nosemgrep: lms-unjustified-ignore-permissions - removes a shipped-row fixture this test itself added
				frappe.delete_doc("DocPerm", name, ignore_permissions=True)

		for name, permlevel in reversed(self.moved_docperm_permlevels):
			frappe.db.set_value("DocPerm", name, "permlevel", permlevel)

		for name, permlevel in reversed(self.moved_field_permlevels):
			frappe.db.set_value("DocField", name, "permlevel", permlevel)

		for doctype in self.touched_doctypes:
			frappe.clear_cache(doctype=doctype)

		super().tearDown()

	# -- fixtures --------------------------------------------------------------------

	def ensure_shipped_assignment_permlevel(self) -> None:
		"""Arrange (and remember to undo) LMS Assignment.answer at permlevel 1 with its
		four shipped permlevel-1 DocPerm rows (System Manager, Moderator, Course Creator,
		Batch Evaluator), in case this site predates PR 2778. f38 already carries both,
		so this is a no-op there; a fresh CI site does not, so this test must not assume
		either -- it arranges the precondition itself and restores it."""
		field = frappe.db.get_value(
			"DocField",
			{"parent": ASSIGNMENT_DOCTYPE, "fieldname": ASSIGNMENT_FIELD},
			["name", "permlevel"],
			as_dict=True,
		)
		self.assertIsNotNone(field, f"{ASSIGNMENT_DOCTYPE} ships no {ASSIGNMENT_FIELD} field")
		if cint(field.permlevel) != 1:
			self.moved_field_permlevels.append((field.name, cint(field.permlevel)))
			frappe.db.set_value("DocField", field.name, "permlevel", 1)
			self.touched_doctypes.add(ASSIGNMENT_DOCTYPE)

		for role in ASSIGNMENT_PERMLEVEL_ROLES:
			if frappe.db.exists(
				"DocPerm",
				{"parent": ASSIGNMENT_DOCTYPE, "parenttype": "DocType", "role": role, "permlevel": 1},
			):
				continue
			perm = frappe.get_doc(
				{
					"doctype": "DocPerm",
					"parent": ASSIGNMENT_DOCTYPE,
					"parenttype": "DocType",
					"parentfield": "permissions",
					"role": role,
					"permlevel": 1,
					"read": 1,
					"write": 1,
				}
			)
			# nosemgrep: lms-unjustified-ignore-permissions - test arranges the shipped-row fixture PR 2778 will ship
			perm.insert(ignore_permissions=True)
			self.added_docperms.append(perm.name)
			self.touched_doctypes.add(ASSIGNMENT_DOCTYPE)

	def arrange_pre_upgrade_custom_docperm_shadow(self, doctype: str) -> None:
		"""Reproduce what frappe.permissions.copy_perms wrote before any permlevel > 0
		row shipped for `doctype`: the permlevel-0 shipped rows copied into Custom
		DocPerm, and nothing at permlevel 1. This is the state a site that customised
		the doctype before PR 2778 is still in."""
		shipped_level0 = frappe.get_all(
			"DocPerm",
			filters={"parent": doctype, "parenttype": "DocType", "permlevel": 0},
			fields=["role", *rights],
		)
		self.assertTrue(shipped_level0, f"{doctype} ships no permlevel 0 DocPerm row to copy")
		for row in shipped_level0:
			perm = frappe.new_doc("Custom DocPerm")
			perm.update(
				{"parent": doctype, "parenttype": "DocType", "parentfield": "permissions", "permlevel": 0}
			)
			perm.update(row)
			# nosemgrep: lms-unjustified-ignore-permissions - test arranges the pre-upgrade admin-customisation fixture
			perm.insert(ignore_permissions=True)
		self.touched_doctypes.add(doctype)

	def ship_permlevel_row(self, doctype: str, permlevel: int = 1) -> tuple[str, int]:
		"""Move one shipped DocPerm row up a permlevel, the way a future Tier 2 field
		will ship it, without touching Custom DocPerm at all."""
		row = frappe.db.get_value(
			"DocPerm",
			{"parent": doctype, "parenttype": "DocType", "permlevel": 0},
			["name", "role"],
			as_dict=True,
		)
		self.assertIsNotNone(row, f"{doctype} ships no permlevel 0 DocPerm row to move")
		self.moved_docperm_permlevels.append((row.name, 0))
		frappe.db.set_value("DocPerm", row.name, "permlevel", permlevel)
		self.touched_doctypes.add(doctype)
		return row.role, permlevel

	def create_moderator(self) -> "frappe.model.document.Document":
		if frappe.db.exists("User", TEST_MODERATOR_EMAIL):
			# nosemgrep: lms-unjustified-ignore-permissions - clears a leftover fixture user from a previous run before recreating it
			frappe.delete_doc("User", TEST_MODERATOR_EMAIL, ignore_permissions=True, force=True)
		user = frappe.new_doc("User")
		user.update(
			{
				"email": TEST_MODERATOR_EMAIL,
				"first_name": "Reconcile",
				"last_name": "Moderator",
				"user_type": "Website User",
				"send_welcome_email": False,
			}
		)
		user.append("roles", {"role": "Moderator"})
		# nosemgrep: lms-unjustified-ignore-permissions - test creates its own fixture user
		user.insert(ignore_permissions=True)
		self.created_users.append(user.name)
		return user

	def create_assignment_with_answer(
		self, answer: str = "The model answer is 4."
	) -> "frappe.model.document.Document":
		doc = frappe.get_doc(
			{
				"doctype": ASSIGNMENT_DOCTYPE,
				"title": "Reconcile Permlevel Test Assignment",
				"type": "Text",
				"question": "What is 2 + 2?",
				"show_answer": 1,
				"answer": answer,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test creates its own fixture assignment as Administrator
		doc.insert(ignore_permissions=True)
		self.created_docs.append((ASSIGNMENT_DOCTYPE, doc.name))
		return doc

	# -- tests -------------------------------------------------------------------------

	def test_control_lms_assignment_starts_with_no_custom_docperm_rows(self):
		"""The control every other test in this file depends on: LMS Assignment ships no
		Custom DocPerm rows on a clean site, so the pre-upgrade shadow the other tests
		arrange is their own fixture, not a leftover. If this fails, an earlier test
		leaked a Custom DocPerm row on LMS Assignment rather than the patch being wrong."""
		self.assertEqual(frappe.db.count("Custom DocPerm", {"parent": ASSIGNMENT_DOCTYPE}), 0)

	def test_moderator_regains_the_model_answer(self):
		"""Pins the fix's whole point: a Moderator who lost read access to
		LMS Assignment.answer because a pre-upgrade Custom DocPerm snapshot shadowed the
		shipped permlevel-1 rows regains it once reconcile() reconciles that snapshot.
		Arranges the permlevel-1 precondition itself (see ensure_shipped_assignment_permlevel)
		so this is meaningful whether or not the site already carries PR 2778."""
		self.ensure_shipped_assignment_permlevel()
		assignment = self.create_assignment_with_answer()
		self.arrange_pre_upgrade_custom_docperm_shadow(ASSIGNMENT_DOCTYPE)
		moderator = self.create_moderator()

		frappe.set_user(moderator.name)
		try:
			# Red-phase control: before the patch runs, the pre-upgrade shadow leaves
			# the Moderator without the answer key at all.
			before = client_get(ASSIGNMENT_DOCTYPE, assignment.name)
			self.assertNotIn(
				"answer",
				before,
				"control failed: Moderator already reads the answer before the patch runs",
			)
		finally:
			frappe.set_user("Administrator")

		reconcile([ASSIGNMENT_DOCTYPE])
		frappe.clear_cache(doctype=ASSIGNMENT_DOCTYPE)

		frappe.set_user(moderator.name)
		try:
			after = client_get(ASSIGNMENT_DOCTYPE, assignment.name)
			self.assertEqual(after.get("answer"), assignment.answer)
		finally:
			frappe.set_user("Administrator")

	def test_second_run_inserts_nothing(self):
		"""Idempotence: once reconcile() has reconciled a doctype's Custom DocPerm set, a
		second run must not insert any more rows there -- a row count, not merely 'it did
		not throw'."""
		self.ensure_shipped_assignment_permlevel()
		self.arrange_pre_upgrade_custom_docperm_shadow(ASSIGNMENT_DOCTYPE)

		reconcile([ASSIGNMENT_DOCTYPE])
		frappe.clear_cache(doctype=ASSIGNMENT_DOCTYPE)
		count_after_first_run = frappe.db.count("Custom DocPerm", {"parent": ASSIGNMENT_DOCTYPE})
		self.assertGreater(
			count_after_first_run, 0, "the first run inserted no rows to prove idempotence over"
		)

		reconcile([ASSIGNMENT_DOCTYPE])
		frappe.clear_cache(doctype=ASSIGNMENT_DOCTYPE)
		count_after_second_run = frappe.db.count("Custom DocPerm", {"parent": ASSIGNMENT_DOCTYPE})

		self.assertEqual(count_after_second_run, count_after_first_run)

	def test_a_doctype_with_no_custom_docperm_rows_is_untouched(self):
		"""A doctype that ships a permlevel > 0 row but carries no Custom DocPerm rows at
		all is never a shadow candidate (that scoping is docperm_shadow.get_shadowed_permlevel_rows,
		which only looks at doctypes with an existing Custom DocPerm row), so reconcile()
		must add nothing to it even when it is named. 'Untouched' is proven two ways: the doctype's own Custom
		DocPerm count, and the site-wide Custom DocPerm total -- f38's real 19 rows on
		User/Event/Discussion Topic/Discussion Reply cannot be deleted to make a truly
		empty site, so the site-wide total is the honest stand-in for 'nothing anywhere
		gained a row'."""
		doctype = "LMS Quiz"
		self.ship_permlevel_row(doctype)
		self.assertEqual(frappe.db.count("Custom DocPerm", {"parent": doctype}), 0)

		site_wide_before = frappe.db.count("Custom DocPerm")

		reconcile([doctype])

		self.assertEqual(frappe.db.count("Custom DocPerm", {"parent": doctype}), 0)
		self.assertEqual(frappe.db.count("Custom DocPerm"), site_wide_before)

	def test_a_shadowed_doctype_that_is_not_named_is_untouched(self):
		"""The named-doctypes contract, and the reason reconcile() takes a list at all:
		a doctype that is genuinely shadowed -- Custom DocPerm rows, plus a shipped
		permlevel-1 row missing from them -- is still left alone when the caller does not
		name it, so a later release can never recreate a row an admin had the chance to
		revoke. LMS Assignment is reconciled in the same run as the positive control, and
		naming LMS Quiz afterwards is the counterfactual: it proves the fixture really was
		reconcilable, so a fixture that silently failed to arrange the shadow cannot pass
		this test as a green."""
		unnamed = "LMS Quiz"
		self.arrange_pre_upgrade_custom_docperm_shadow(unnamed)
		role, permlevel = self.ship_permlevel_row(unnamed)
		self.assertIn(
			(role, permlevel),
			get_shadowed_permlevel_rows().get(unnamed, []),
			f"fixture failed: {unnamed} is not a shadow candidate, so not naming it proves nothing",
		)

		self.ensure_shipped_assignment_permlevel()
		self.arrange_pre_upgrade_custom_docperm_shadow(ASSIGNMENT_DOCTYPE)

		reconcile([ASSIGNMENT_DOCTYPE])

		self.assertEqual(
			frappe.db.count("Custom DocPerm", {"parent": unnamed, "permlevel": permlevel}),
			0,
			f"reconcile() wrote to {unnamed}, which it was not handed",
		)
		self.assertTrue(
			frappe.db.exists("Custom DocPerm", {"parent": ASSIGNMENT_DOCTYPE, "permlevel": 1}),
			"control failed: reconcile() wrote nothing at all, so the untouched doctype proves nothing",
		)

		reconcile([unnamed])

		self.assertEqual(
			frappe.db.count("Custom DocPerm", {"parent": unnamed, "role": role, "permlevel": permlevel}),
			1,
			f"counterfactual failed: naming {unnamed} did not reconcile it either",
		)

	def test_deleted_row_is_not_re_added_by_the_alert_hook(self):
		"""warn_about_shadowed_permlevels() (the after_migrate alert from PR 2777) only
		ever reports and logs -- it must never write. Runs reconcile(), deletes one row it
		inserted (an admin overriding the reconciliation), then proves the alert hook
		does not put it back."""
		self.ensure_shipped_assignment_permlevel()
		self.arrange_pre_upgrade_custom_docperm_shadow(ASSIGNMENT_DOCTYPE)

		reconcile([ASSIGNMENT_DOCTYPE])
		frappe.clear_cache(doctype=ASSIGNMENT_DOCTYPE)
		inserted = frappe.get_all(
			"Custom DocPerm", filters={"parent": ASSIGNMENT_DOCTYPE, "permlevel": 1}, pluck="name"
		)
		self.assertTrue(inserted, "reconcile() inserted no permlevel 1 rows to delete")

		# nosemgrep: lms-unjustified-ignore-permissions - removes a row the patch itself just inserted, to test the alert never re-adds it
		frappe.delete_doc("Custom DocPerm", inserted[0], ignore_permissions=True)
		frappe.clear_cache(doctype=ASSIGNMENT_DOCTYPE)

		count_before_alert = frappe.db.count("Custom DocPerm", {"parent": ASSIGNMENT_DOCTYPE})
		stdout = io.StringIO()
		with redirect_stdout(stdout):
			warn_about_shadowed_permlevels()
		count_after_alert = frappe.db.count("Custom DocPerm", {"parent": ASSIGNMENT_DOCTYPE})

		self.assertEqual(count_after_alert, count_before_alert)
