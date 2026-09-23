# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""Write and delete on reusable content narrow to its `authors`. Read does not.

Every refusal here is asserted against the resulting state — the stored field is
unchanged, the row is still there — because a bare assertRaises passes on any
PermissionError the save path can raise, including one from a DocPerm row the
actor never held. Each refusal is therefore preceded by a doctype-level
frappe.has_permission, which skips the controller hook entirely and so reads the
role grant and nothing else: it says the actor holds the grant this gate is
narrowing, which is what makes the refusal that follows attributable to the gate.
"""

from contextlib import contextmanager

import frappe

from lms import hooks
from lms.lms.permissions import has_authored_content_permission, stored_authors
from lms.lms.test_helpers import BaseTestUtils

AUTHORED_DOCTYPES = ("LMS Quiz", "LMS Programming Exercise", "LMS Assignment", "LMS Question")

# LMS Program is the one other doctype in this family and deliberately does NOT
# carry `authors` yet. frappe allows one has_permission hook per doctype and
# LMS Program's own hook already holds its read rule, so giving it the field means
# composing this gate into that hook rather than registering on it -- a different
# change, on its own branch. What is pinned here is that the field never reaches a
# doctype whose gate does not read it.

# LMS Question carries no Batch Evaluator DocPerm row. The grant was decided and
# never written, and it is to be treated as not existing — so an evaluator is not
# an actor on that doctype and a refusal there would prove the missing row, not
# this gate.
EVALUATOR_DOCTYPES = ("LMS Quiz", "LMS Programming Exercise", "LMS Assignment")

# The field each doctype's write is measured on.
EDITED_FIELD = {
	"LMS Quiz": "title",
	"LMS Programming Exercise": "title",
	"LMS Assignment": "title",
	"LMS Question": "question",
}

GATE = "lms.lms.permissions.has_authored_content_permission"


class TestAuthoredContentScope(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(f"acs-a-{self.hash}@example.com", "Ann", "Author", ["Course Creator"])
		self.colleague = self._create_user(
			f"acs-c-{self.hash}@example.com", "Bo", "Colleague", ["Course Creator"]
		)
		self.evaluator = self._create_user(
			f"acs-e-{self.hash}@example.com", "Cy", "Evaluator", ["Batch Evaluator"]
		)
		self.moderator = self._create_user(f"acs-m-{self.hash}@example.com", "Di", "Moderator", ["Moderator"])
		self._assert_the_actors_are_who_this_suite_needs()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _assert_the_actors_are_who_this_suite_needs(self):
		"""_create_user returns a pre-existing user and ignores its `roles` argument.

		The emails are hash-suffixed so that cannot happen here, and the roles are
		read back anyway: a bystander who turned out to hold Moderator, System
		Manager or Administrator is short-circuited by the gate, and every refusal
		below would then be measuring nothing.
		"""
		for user, role in (
			(self.author, "Course Creator"),
			(self.colleague, "Course Creator"),
			(self.evaluator, "Batch Evaluator"),
			(self.moderator, "Moderator"),
		):
			roles = frappe.get_roles(user.name)
			self.assertIn(role, roles, f"{user.name} does not hold {role}")

		for bystander in (self.colleague, self.evaluator):
			roles = set(frappe.get_roles(bystander.name))
			self.assertNotIn("Moderator", roles)
			self.assertNotIn("System Manager", roles)
			self.assertNotEqual(bystander.name, "Administrator")

	@contextmanager
	def _acting_as(self, user):
		frappe.set_user(user)
		try:
			yield
		finally:
			frappe.set_user("Administrator")

	def _payload(self, doctype):
		if doctype == "LMS Quiz":
			return {"title": f"Scoped Quiz {self.hash}", "passing_percentage": 70, "total_marks": 0}
		if doctype == "LMS Programming Exercise":
			return {
				"title": f"Scoped Exercise {self.hash}",
				"language": "Python",
				"problem_statement": "<p>Add two numbers.</p>",
				"test_cases": [{"input": "1 2", "expected_output": "3"}],
			}
		if doctype == "LMS Assignment":
			return {"title": f"Scoped Assignment {self.hash}", "type": "Text", "question": "<p>Explain.</p>"}
		return {
			"question": f"Scoped Question {self.hash}?",
			"type": "Choices",
			"option_1": "Option 1",
			"is_correct_1": 1,
			"option_2": "Option 2",
			"is_correct_2": 0,
		}

	def _insert(self, doctype, as_user):
		"""Inserted as the actor, through the ordinary permission path.

		Not with ignore_permissions: `create` is unscoped by design, and a create
		that stopped working for an authoring role is a regression this suite should
		fail on rather than wave through.
		"""
		with self._acting_as(as_user):
			doc = frappe.get_doc({"doctype": doctype, **self._payload(doctype)}).insert()
		return doc.name

	def _stored(self, doctype, name):
		return frappe.db.get_value(doctype, name, EDITED_FIELD[doctype])

	def _edit_as(self, doctype, name, user, value):
		with self._acting_as(user):
			doc = frappe.get_doc(doctype, name)
			doc.set(EDITED_FIELD[doctype], value)
			doc.save()

	def _assert_refused(self, doctype, name, user):
		"""Write and delete both refused, asserted on what the row still holds."""
		before = self._stored(doctype, name)
		for ptype in ("write", "delete"):
			self.assertTrue(
				frappe.has_permission(doctype, ptype, user=user),
				f"{doctype}: this actor holds no {ptype} grant, so a refusal proves nothing",
			)

		with self._acting_as(user):
			doc = frappe.get_doc(doctype, name)
			doc.set(EDITED_FIELD[doctype], f"Rewritten by a bystander {self.hash}")
			with self.assertRaises(frappe.PermissionError):
				doc.save()
			with self.assertRaises(frappe.PermissionError):
				frappe.delete_doc(doctype, name)

		self.assertEqual(self._stored(doctype, name), before, f"{doctype}: a refused write landed anyway")
		self.assertTrue(frappe.db.exists(doctype, name), f"{doctype}: a refused delete removed the row")

	def test_an_author_writes_and_deletes_the_row_they_authored(self):
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.author.name)
				self.assertEqual(stored_authors(doctype, name), [self.author.name])

				self._edit_as(doctype, name, self.author.name, f"Edited by its author {self.hash}")
				self.assertEqual(self._stored(doctype, name), f"Edited by its author {self.hash}")

				with self._acting_as(self.author.name):
					frappe.delete_doc(doctype, name)
				self.assertFalse(frappe.db.exists(doctype, name))

	def test_another_holder_of_the_authoring_role_may_not_write_or_delete(self):
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.author.name)
				self._assert_refused(doctype, name, self.colleague.name)

	def test_a_batch_evaluator_who_is_not_an_author_may_not_write_or_delete(self):
		for doctype in EVALUATOR_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.author.name)
				self._assert_refused(doctype, name, self.evaluator.name)

	def test_lms_question_still_grants_a_batch_evaluator_nothing(self):
		"""The grant was decided and never written, and this commit did not write it.

		is_correct_1..10 live on LMS Question, so a site-wide row there would hand
		every Batch Evaluator every answer key on the site off /api/resource, with
		no batch and no tag bounding it.
		"""
		for ptype in ("read", "write", "create", "delete"):
			with self.subTest(ptype=ptype):
				self.assertFalse(
					frappe.has_permission("LMS Question", ptype, user=self.evaluator.name),
					f"LMS Question granted a Batch Evaluator {ptype}",
				)

	def test_a_moderator_writes_and_deletes_content_they_did_not_author(self):
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.author.name)
				self._edit_as(doctype, name, self.moderator.name, f"Edited by a moderator {self.hash}")
				self.assertEqual(self._stored(doctype, name), f"Edited by a moderator {self.hash}")

				with self._acting_as(self.moderator.name):
					frappe.delete_doc(doctype, name)
				self.assertFalse(frappe.db.exists(doctype, name))

	def test_read_is_unchanged_for_both_authoring_roles(self):
		"""The regression that matters: the whole rule is read wide, write narrow.

		Both surfaces, because frappe.get_all sets ignore_permissions=True and only
		frappe.get_list runs the list-read path a query condition would narrow.
		"""
		for doctype in AUTHORED_DOCTYPES:
			readers = [self.colleague] + ([self.evaluator] if doctype in EVALUATOR_DOCTYPES else [])
			name = self._insert(doctype, self.author.name)
			for reader in readers:
				with self.subTest(doctype=doctype, reader=reader.name):
					self.assertTrue(
						frappe.has_permission(doctype, "read", doc=name, user=reader.name),
						f"{doctype}: a non-author lost the single-doc read",
					)
					with self._acting_as(reader.name):
						visible = frappe.get_list(doctype, pluck="name", limit_page_length=0)
					self.assertIn(name, visible, f"{doctype}: a non-author lost the list read")

	def test_a_row_from_before_the_field_existed_answers_to_its_owner(self):
		"""The assertion the no-backfill decision rests on.

		Deleting the child rows reproduces exactly the state of every row on a live
		site: `authors` empty, `owner` the only record of who made it.
		"""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.author.name)
				frappe.db.delete("LMS Content Author", {"parent": name, "parenttype": doctype})
				self.assertEqual(stored_authors(doctype, name), [], "the fixture still names an author")

				self._edit_as(doctype, name, self.author.name, f"Edited by its owner {self.hash}")
				self.assertEqual(self._stored(doctype, name), f"Edited by its owner {self.hash}")
				self._assert_refused(doctype, name, self.colleague.name)

	def test_a_bystander_cannot_write_themselves_into_the_authors_list(self):
		"""A gate that does not cover the field it reads is a suggestion.

		`authors` is an ordinary editable field on a document any holder of the role
		could save until this commit, so the list that decides who may write was
		writable by anyone who wanted to be on it.
		"""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.author.name)
				with self._acting_as(self.colleague.name):
					doc = frappe.get_doc(doctype, name)
					doc.set("authors", [{"author": self.colleague.name}])
					with self.assertRaises(frappe.PermissionError):
						doc.save()
				self.assertEqual(stored_authors(doctype, name), [self.author.name])

	def test_an_assignment_author_may_delete_the_assignment_they_authored(self):
		"""The case that could not be expressed before the grant widened.

		Neither authoring role held delete on LMS Assignment, and a has_permission
		hook can only subtract, so the DocPerm had to widen before the gate had
		anything to narrow. Both halves are asserted: the grant, doctype-level,
		which skips the hook; and the gate, on a row each actor did not author.
		"""
		for actor in (self.author, self.evaluator):
			with self.subTest(actor=actor.name):
				self.assertTrue(
					frappe.has_permission("LMS Assignment", "delete", user=actor.name),
					f"{actor.name} holds no delete grant on LMS Assignment",
				)

		name = self._insert("LMS Assignment", self.evaluator.name)
		self.assertEqual(stored_authors("LMS Assignment", name), [self.evaluator.name])
		self._assert_refused("LMS Assignment", name, self.colleague.name)

		with self._acting_as(self.evaluator.name):
			frappe.delete_doc("LMS Assignment", name)
		self.assertFalse(frappe.db.exists("LMS Assignment", name))

	def test_every_doctype_carrying_the_authors_field_is_registered_on_this_gate(self):
		"""A fifth doctype given the field and not the hook is silently ungated.

		hooks.has_permission is read from the module namespace, not through
		frappe.get_hooks, which serves a redis-cached registry that in a worktree can
		hand back another branch's registrations.
		"""
		carriers = set(
			frappe.get_all(
				"DocField",
				filters={
					"fieldname": "authors",
					"options": "LMS Content Author",
					"parenttype": "DocType",
				},
				pluck="parent",
			)
		)
		self.assertEqual(
			carriers,
			set(AUTHORED_DOCTYPES),
			"a doctype gained or lost the authors field",
		)

		gated = {doctype for doctype, target in hooks.has_permission.items() if target == GATE}
		self.assertEqual(
			gated, set(AUTHORED_DOCTYPES), "a doctype carries the field without the gate that reads it"
		)
