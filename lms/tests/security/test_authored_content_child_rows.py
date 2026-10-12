# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""Appending a child row to authored content answers to the parent's `authors`.

A child row can be inserted on its own, with the parent named on the row and the
parent itself never saved. frappe.permissions.has_permission routes an istable
doctype to has_child_permission, which ends at
has_permission(parent_doctype, ptype=ptype, doc=<the parent's name>) — the
parent's own gate, asked `create`, with the parent attached. A suite that drives
doc.save() or frappe.delete_doc never reaches that call, so this one drives the
insert QuizQuestionForm.vue posts.

The `authors` cases are the sharpest of them: `authors` is the list the gate
reads, so an insert into it writes the answer to the question being asked.
"""

from contextlib import contextmanager

import frappe

from lms.lms.permissions import stored_authors
from lms.lms.test_helpers import BaseTestUtils

AUTHORED_DOCTYPES = ("LMS Quiz", "LMS Programming Exercise", "LMS Assignment", "LMS Question")

PARENT_PAYLOAD = {
	"LMS Quiz": {"title": "Child Row Quiz", "passing_percentage": 70, "total_marks": 0},
	"LMS Programming Exercise": {
		"title": "Child Row Exercise",
		"language": "Python",
		"problem_statement": "<p>Add two numbers.</p>",
		"test_cases": [{"input": "1 2", "expected_output": "3"}],
	},
	"LMS Assignment": {"title": "Child Row Assignment", "type": "Text", "question": "<p>Explain.</p>"},
	"LMS Question": {
		"question": "Child Row Question?",
		"type": "Choices",
		"option_1": "Option 1",
		"is_correct_1": 1,
		"option_2": "Option 2",
		"is_correct_2": 0,
	},
}


class TestAuthoredContentChildRows(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(f"acr-a-{self.hash}@example.com", "Ann", "Author", ["Course Creator"])
		self.colleague = self._create_user(
			f"acr-c-{self.hash}@example.com", "Bo", "Colleague", ["Course Creator"]
		)
		self._assert_the_actors_are_who_this_suite_needs()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _assert_the_actors_are_who_this_suite_needs(self):
		"""_create_user returns a pre-existing user and ignores its `roles` argument.

		The emails are hash-suffixed so that cannot happen, and the roles are read back
		anyway: a colleague who turned out to hold Moderator or System Manager is
		short-circuited by the gate and every refusal below would be measuring nothing.
		"""
		for user in (self.author, self.colleague):
			roles = set(frappe.get_roles(user.name))
			self.assertIn("Course Creator", roles, f"{user.name} does not hold Course Creator")
		bystander_roles = set(frappe.get_roles(self.colleague.name))
		self.assertNotIn("Moderator", bystander_roles)
		self.assertNotIn("System Manager", bystander_roles)
		self.assertNotEqual(self.colleague.name, "Administrator")

	@contextmanager
	def _acting_as(self, user):
		frappe.set_user(user)
		try:
			yield
		finally:
			frappe.set_user("Administrator")

	def _insert(self, doctype, as_user):
		"""A parent row, inserted as the actor through the ordinary permission path."""
		payload = dict(PARENT_PAYLOAD[doctype])
		titled = "question" if doctype == "LMS Question" else "title"
		payload[titled] = f"{payload[titled]} {self.hash}"
		with self._acting_as(as_user):
			doc = frappe.get_doc({"doctype": doctype, **payload}).insert()
		return doc.name

	def _child_row_cases(self):
		"""(parent doctype, parentfield, child doctype, the row's own fields).

		Every child table an authored document carries. `question` on the quiz row
		names a question authored by someone who may write it, so the only thing the
		refusal can be attributed to is the quiz.
		"""
		question = self._insert("LMS Question", self.author.name)
		cases = [
			("LMS Quiz", "questions", "LMS Quiz Question", {"question": question, "marks": 1}),
			(
				"LMS Programming Exercise",
				"test_cases",
				"LMS Test Case",
				{"input": "3 4", "expected_output": "7"},
			),
		]
		cases += [
			(doctype, "authors", "LMS Content Author", {"author": self.colleague.name})
			for doctype in AUTHORED_DOCTYPES
		]
		return cases

	def _append_as(self, parent_doctype, name, parentfield, child_doctype, row, user):
		"""One child row, in the shape frappe.client.insert posts it.

		QuizQuestionForm.vue posts exactly this — doctype, parent, parenttype,
		parentfield and the row's own fields — and saves no parent.
		"""
		with self._acting_as(user):
			frappe.get_doc(
				{
					"doctype": child_doctype,
					"parent": name,
					"parenttype": parent_doctype,
					"parentfield": parentfield,
					**row,
				}
			).insert()

	def _count(self, child_doctype, parent_doctype, name, parentfield):
		return frappe.db.count(
			child_doctype,
			{"parent": name, "parenttype": parent_doctype, "parentfield": parentfield},
		)

	def test_a_bystander_cannot_append_a_child_row_to_another_authors_content(self):
		for parent_doctype, parentfield, child_doctype, row in self._child_row_cases():
			with self.subTest(parent=parent_doctype, parentfield=parentfield):
				name = self._insert(parent_doctype, self.author.name)
				before = self._count(child_doctype, parent_doctype, name, parentfield)

				self.assertTrue(
					frappe.has_permission(parent_doctype, "create", user=self.colleague.name),
					f"{parent_doctype}: this actor holds no create grant, so a refusal proves nothing",
				)
				with self.assertRaises(frappe.PermissionError):
					self._append_as(
						parent_doctype, name, parentfield, child_doctype, row, self.colleague.name
					)

				self.assertEqual(
					self._count(child_doctype, parent_doctype, name, parentfield),
					before,
					f"{parent_doctype}.{parentfield}: a refused child row landed anyway",
				)

	def test_a_bystander_cannot_insert_themselves_into_the_authors_list(self):
		"""The escalation stated on its own, because it is the one that compounds.

		The doc-layer suite proves a bystander cannot save themselves into `authors`.
		Inserting the child row reaches the same list without saving the parent, and a
		row that lands there makes every later write and delete legitimate.
		"""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.author.name)
				with self.assertRaises(frappe.PermissionError):
					self._append_as(
						doctype,
						name,
						"authors",
						"LMS Content Author",
						{"author": self.colleague.name},
						self.colleague.name,
					)
				self.assertEqual(stored_authors(doctype, name), [self.author.name])
				self.assertFalse(
					frappe.has_permission(doctype, "write", doc=name, user=self.colleague.name),
					f"{doctype}: the bystander came out of this holding write",
				)

	def test_an_author_still_appends_child_rows_to_their_own_content(self):
		"""The control. It has to pass before the narrowing and after it."""
		for parent_doctype, parentfield, child_doctype, row in self._child_row_cases():
			with self.subTest(parent=parent_doctype, parentfield=parentfield):
				name = self._insert(parent_doctype, self.author.name)
				before = self._count(child_doctype, parent_doctype, name, parentfield)

				self._append_as(parent_doctype, name, parentfield, child_doctype, row, self.author.name)

				self.assertEqual(
					self._count(child_doctype, parent_doctype, name, parentfield),
					before + 1,
					f"{parent_doctype}.{parentfield}: an author lost their own child insert",
				)

	def test_creating_a_new_row_of_ones_own_is_still_unscoped(self):
		"""`create` is narrowed only where a parent is attached to the question.

		Document.insert sets __islocal and calls check_permission("create") before
		set_new_name, so a row being created reaches the gate with no name and is
		answered by the unscoped branch. This is the control for that claim, and a
		failure here means the narrowing took the create path with it.
		"""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				name = self._insert(doctype, self.colleague.name)
				self.assertEqual(stored_authors(doctype, name), [self.colleague.name])
