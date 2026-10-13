# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""A child row is taken out of somebody else's content by an ordinary parent save.

The sibling suite test_authored_content_child_row_moves.py covers the door where the
row is saved on its own. This one covers the door where no child is ever saved:
Document.update_child_table calls db_update() on every submitted row, db_update
issues `UPDATE ... WHERE name=%s` with no ownership check, and _init_child leaves
`__islocal` unset whenever the payload carries a `name`. So a Course Creator posts
frappe.client.save for their OWN quiz with `questions: [{"name": "<a row of
somebody else's quiz>"}]`, passes check_permission("write") on their own quiz, and
the row is re-parented. has_child_permission is never consulted, and doc_events on
the child do not fire when a parent saves its children — which is the property the
child-side gate relies on to argue it cannot break ordinary authoring.

Same predicate, second entry point. The refusal, the readmissions and the ordinary
authoring control are all measured here through the parent, not through the child.
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

TABLE_FIELDTYPES = ("Table", "Table MultiSelect")


class TestAuthoredContentParentSaveMoves(AuthoredContentChildRowActors):
	def _take_row_through_a_parent_save(
		self, child_doctype, row, destination, parenttype, parentfield, fields, user
	):
		"""The whole finding in one call: the thief's own parent, saved with a foreign row.

		The parent is read back and reposted the way the desk posts it, so `creation`,
		`owner` and `modified` are the parent's own. The child dict carries none of
		those: set_user_and_timestamp fills a child's missing `creation` and `owner`
		from the parent, which is why this door needs no such payload and why the
		stolen row's audit stamps end up naming the thief.
		"""
		payload = frappe.get_doc(parenttype, destination).as_dict()
		payload[parentfield] = [
			*[dict(existing) for existing in payload.get(parentfield) or []],
			{"doctype": child_doctype, "name": row, "idx": 99, **fields},
		]
		with self._acting_as(user):
			frappe.client.save(dict(payload))

	def test_a_bystander_cannot_take_a_child_row_through_a_save_of_their_own_content(self):
		for child_doctype, parenttype, parentfield, fields, source, destination in self._movable_cases():
			with self.subTest(child=child_doctype):
				row = self._seed_row(child_doctype, source, parenttype, parentfield, fields)
				self.assertTrue(
					frappe.has_permission(parenttype, "write", doc=destination, user=self.bystander.name),
					f"{child_doctype}: the bystander cannot write the destination, so a refusal proves nothing",
				)

				with self.assertRaises(frappe.PermissionError):
					self._take_row_through_a_parent_save(
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

	def test_an_author_still_adds_reorders_and_deletes_rows_on_their_own_content(self):
		"""The control that matters: the parent save is how the app actually writes a quiz.

		Add, reorder and delete, in that order, through Document.save — the path
		QuizQuestionForm.vue drives. A gate on the parent save that costs any of these
		is worse than the bug it closes.
		"""
		for child_doctype, parenttype, parentfield, fields, source, _ in self._movable_cases():
			with self.subTest(child=child_doctype):
				with self._acting_as(self.author.name):
					parent = frappe.get_doc(parenttype, source)
					added = parent.append(parentfield, fields)
					parent.save()
					self.assertTrue(frappe.db.exists(child_doctype, added.name))

					parent.reload()
					for position, existing in enumerate(reversed(parent.get(parentfield))):
						existing.idx = position + 1
					parent.save()

					parent.reload()
					parent.set(parentfield, [r for r in parent.get(parentfield) if r.name != added.name])
					parent.save()

				self.assertFalse(frappe.db.exists(child_doctype, added.name))

	def test_a_moderator_still_takes_a_child_row_through_a_parent_save(self):
		"""A hook can only subtract, and this app has locked its administrators out once."""
		child_doctype, parenttype, parentfield, fields, source, _ = self._movable_cases()[0]
		destination = self._content(parenttype, self.moderator.name, "Moderator Own")
		row = self._seed_row(child_doctype, source, parenttype, parentfield, fields)

		self._take_row_through_a_parent_save(
			child_doctype, row, destination, parenttype, parentfield, fields, self.moderator.name
		)

		self.assertEqual(frappe.db.get_value(child_doctype, row, "parent"), destination)

	def test_a_system_manager_still_takes_a_child_row_through_a_parent_save(self):
		"""The second readmission. A bare System Manager holds no authoring role at all."""
		child_doctype, parenttype, parentfield, fields, source, _ = self._movable_cases()[0]
		destination = self._content(parenttype, self.site_manager.name, "Manager Own")
		row = self._seed_row(child_doctype, source, parenttype, parentfield, fields)

		self._take_row_through_a_parent_save(
			child_doctype, row, destination, parenttype, parentfield, fields, self.site_manager.name
		)

		self.assertEqual(frappe.db.get_value(child_doctype, row, "parent"), destination)

	def test_a_bystander_cannot_strip_the_authors_row_that_locks_them_out(self):
		"""The escalation, through this door. Everything else here is an integrity bug.

		is_content_author falls back to `owner` when `authors` is empty, so on content
		that was handed over — inserted by the bystander, authored by somebody else —
		carrying the last `authors` row away in a save of the bystander's own quiz hands
		write back to the bystander. The final assertion reads has_permission again
		rather than trusting that.
		"""
		quiz = self._quiz(self.bystander.name, "Handed Over Quiz")
		destination = self._quiz(self.bystander.name, "Bystander Own Quiz")
		frappe.db.delete("LMS Content Author", {"parent": quiz, "parentfield": "authors"})
		row = self._seed_row("LMS Content Author", quiz, "LMS Quiz", "authors", {"author": self.author.name})
		self.assertEqual(stored_authors("LMS Quiz", quiz), [self.author.name])
		self.assertFalse(frappe.has_permission("LMS Quiz", "write", doc=quiz, user=self.bystander.name))

		with self.assertRaises(frappe.PermissionError):
			self._take_row_through_a_parent_save(
				"LMS Content Author",
				row,
				destination,
				"LMS Quiz",
				"authors",
				{"author": self.author.name},
				self.bystander.name,
			)

		self.assertEqual(stored_authors("LMS Quiz", quiz), [self.author.name])
		self.assertFalse(
			frappe.has_permission("LMS Quiz", "write", doc=quiz, user=self.bystander.name),
			"the bystander took write on content they do not author",
		)

	def test_every_gated_parent_is_registered_on_the_parent_save_entry_point(self):
		"""The child-side registration is inert here — the parent is what gets saved."""
		for parent in GATED_PARENTS:
			with self.subTest(parent=parent):
				self.assertIn(GATE, registered_validate_hooks(parent))

	def test_no_unregistered_doctype_carries_a_gated_child_table(self):
		"""The fourth-door pin: a sixth carrier would reach the same rows ungated.

		The parent-side entry point is a list of doctypes, and a list is only as good as
		what checks it. Custom Field is swept as well as DocField, because a Table
		custom field is a carrier the .json files do not show.
		"""
		gated_children = {
			field.options for parent in GATED_PARENTS for field in frappe.get_meta(parent).get_table_fields()
		}
		for child in sorted(gated_children):
			with self.subTest(child=child):
				filters = {"fieldtype": ("in", TABLE_FIELDTYPES), "options": child}
				carriers = frappe.get_all("DocField", filters=filters, pluck="parent")
				carriers += frappe.get_all("Custom Field", filters=filters, pluck="dt")
				self.assertEqual(set(carriers) - set(GATED_PARENTS), set())
