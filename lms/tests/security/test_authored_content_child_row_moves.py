# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""Moving a child row out of authored content answers to the parent it leaves.

frappe.permissions.has_child_permission reads `parenttype` and `parent` off the
row it is handed, and on a save that row is the caller's own submission. The
destination parent is therefore the only one the gate ever sees: a Course Creator
who authors any quiz passes `write` while rewriting `parent` on a question row
that belongs to somebody else, and the row leaves with its marks. The parent is
never saved, so the doc-layer suites never reach this call.

This is the door where the row is saved on its own. The other door — the same row
carried along by a save of the thief's own parent, where no child save happens at
all — is test_authored_content_parent_save_moves.py. One rule answers both; the
fixture they share is lms/tests/authored_content_actors.py.

The sibling suite test_authored_content_child_rows.py covers the insert half, closed
by `create` in NARROWED_PTYPES. That cannot reach this one: an existing row is saved
with `write`, and `write` was already narrowed — it was simply asked about the wrong
parent.
"""

import frappe
import frappe.client

from lms.lms.permissions import stored_authors
from lms.tests.authored_content_actors import (
	GATE,
	GATED_PARENTS,
	AuthoredContentChildRowActors,
	registered_validate_hooks,
)


class TestAuthoredContentChildRowMoves(AuthoredContentChildRowActors):
	def _move(self, child_doctype, row, destination, parenttype, parentfield, fields, user):
		"""The move, in the shape frappe.client.save posts it — the whole row, restated.

		`creation` and `owner` are part of that shape: without them the save is stopped
		by validate_set_only_once, which runs after the permission check and would make a
		refusal look like a gate that had held. That is true of this door only — a parent
		save fills a child's missing `creation` and `owner` from the parent instead.
		"""
		stored = frappe.db.get_value(child_doctype, row, ["modified", "creation", "owner"], as_dict=True)
		with self._acting_as(user):
			frappe.client.save(
				{
					"doctype": child_doctype,
					"name": row,
					"parent": destination,
					"parenttype": parenttype,
					"parentfield": parentfield,
					"idx": 1,
					"modified": str(stored.modified),
					"creation": str(stored.creation),
					"owner": stored.owner,
					"docstatus": 0,
					**fields,
				}
			)

	def test_a_bystander_cannot_move_a_child_row_out_of_another_authors_content(self):
		for child_doctype, parenttype, parentfield, fields, source, destination in self._movable_cases():
			with self.subTest(child=child_doctype):
				row = self._seed_row(child_doctype, source, parenttype, parentfield, fields)
				self.assertTrue(
					frappe.has_permission(parenttype, "write", doc=destination, user=self.bystander.name),
					f"{child_doctype}: the bystander cannot write the destination, so a refusal proves nothing",
				)

				with self.assertRaises(frappe.PermissionError):
					self._move(
						child_doctype,
						row,
						destination,
						parenttype,
						parentfield,
						fields,
						self.bystander.name,
					)

				self.assertEqual(
					frappe.db.get_value(child_doctype, row, "parent"),
					source,
					f"{child_doctype}: the row left its parent anyway",
				)

	def test_an_author_still_moves_a_child_row_between_content_they_author(self):
		"""The control. Every case above is a legitimate operation for its owner."""
		for child_doctype, parenttype, parentfield, fields, source, _ in self._movable_cases():
			with self.subTest(child=child_doctype):
				destination = self._content(parenttype, self.author.name, "Own")
				row = self._seed_row(child_doctype, source, parenttype, parentfield, fields)

				self._move(child_doctype, row, destination, parenttype, parentfield, fields, self.author.name)

				self.assertEqual(frappe.db.get_value(child_doctype, row, "parent"), destination)

	def test_a_moderator_still_moves_a_child_row_out_of_content_they_did_not_author(self):
		"""The readmission control — a gate that refuses everyone is not this gate."""
		child_doctype, parenttype, parentfield, fields, source, destination = self._movable_cases()[0]
		row = self._seed_row(child_doctype, source, parenttype, parentfield, fields)

		self._move(child_doctype, row, destination, parenttype, parentfield, fields, self.moderator.name)

		self.assertEqual(frappe.db.get_value(child_doctype, row, "parent"), destination)

	def test_a_bystander_cannot_strip_the_authors_row_that_locks_them_out(self):
		"""The one case where the move is a privilege change and not only an integrity one.

		is_content_author falls back to `owner` when `authors` is empty, so on content
		that was handed over — inserted by one person and authored by another — taking
		the last `authors` row out hands write back to the inserter. The second half of
		this test moves the same row as Administrator to show that is what the refusal
		is holding back, rather than asserting it.
		"""
		quiz = self._quiz(self.bystander.name, "Handed Over Quiz")
		destination = self._quiz(self.bystander.name, "Bystander Own Quiz")
		frappe.db.delete("LMS Content Author", {"parent": quiz, "parentfield": "authors"})
		row = self._seed_row("LMS Content Author", quiz, "LMS Quiz", "authors", {"author": self.author.name})
		self.assertEqual(stored_authors("LMS Quiz", quiz), [self.author.name])
		self.assertFalse(frappe.has_permission("LMS Quiz", "write", doc=quiz, user=self.bystander.name))

		with self.assertRaises(frappe.PermissionError):
			self._move(
				"LMS Content Author",
				row,
				destination,
				"LMS Quiz",
				"authors",
				{"author": self.author.name},
				self.bystander.name,
			)

		self.assertEqual(stored_authors("LMS Quiz", quiz), [self.author.name])
		self.assertFalse(frappe.has_permission("LMS Quiz", "write", doc=quiz, user=self.bystander.name))
		self._move(
			"LMS Content Author",
			row,
			destination,
			"LMS Quiz",
			"authors",
			{"author": self.author.name},
			"Administrator",
		)
		self.assertEqual(stored_authors("LMS Quiz", quiz), [])
		self.assertTrue(
			frappe.has_permission("LMS Quiz", "write", doc=quiz, user=self.bystander.name),
			"the stripped row was not what was holding the bystander out",
		)

	def test_a_row_whose_stored_parent_is_gone_is_refused_not_reported_missing(self):
		"""An orphan row's move is a refusal, not a 404.

		frappe.permissions.has_permission resolves a docname with get_lazy_doc, which
		raises DoesNotExistError for a parent that has been deleted, so the gate answered
		a move out of a deleted parent with a 404 instead of the refusal it intended.
		Orphan rows in that state exist wherever an exercise was destroyed by the bulk
		`frappe.db.delete` this branch replaced, which left its `LMS Test Case` rows
		standing.

		Nobody is readmitted, Administrator included: a parent that no longer exists is
		not one anybody can be shown to have write on. The second half asserts that
		rather than leaving it to be discovered — it is the price of failing closed, and
		it costs nothing this app can reach, since an orphan row is loaded by no parent
		and can only arrive in a hand-written payload.
		"""
		fields = {"input": "3 4", "expected_output": "7"}
		source = self._exercise(self.author.name, "Deleted Source Exercise")
		row = self._seed_row("LMS Test Case", source, "LMS Programming Exercise", "test_cases", fields)
		destination = self._exercise(self.bystander.name, "Orphan Destination Exercise")
		frappe.db.delete("LMS Programming Exercise", {"name": source})
		self.assertFalse(frappe.db.exists("LMS Programming Exercise", source))

		for user in (self.bystander.name, "Administrator"):
			with self.subTest(user=user):
				with self.assertRaises(frappe.PermissionError) as refusal:
					self._move(
						"LMS Test Case",
						row,
						destination,
						"LMS Programming Exercise",
						"test_cases",
						fields,
						user,
					)
				self.assertIn(source, str(refusal.exception))
				self.assertEqual(frappe.db.get_value("LMS Test Case", row, "parent"), source)

	def test_every_child_table_the_authored_doctypes_carry_is_registered(self):
		"""The coverage pin, read off the parents rather than off a list.

		A child table added to one of these doctypes later would be gated by nothing and
		no test above would notice, so the registration is compared against the meta.
		"""
		for parent in GATED_PARENTS:
			for field in frappe.get_meta(parent).get_table_fields():
				with self.subTest(parent=parent, parentfield=field.fieldname):
					self.assertIn(GATE, registered_validate_hooks(field.options))
