# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""An `authors` row naming nobody must not decide who may write the content.

`LMS Content Author.author` is a Link, and a Link with no value stores NULL. A
table holding one such row is still a non-empty list, so is_content_author took
the "somebody is named" branch, skipped the `owner` fallback, and answered False
for every user alive — the creator lost write and delete on their own quiz, with
no way back short of a Moderator.

Two layers are measured separately because they close different halves. Dropping
the empty value in stored_authors is what heals a row already stored, and it is
the only half that can: `reqd` is a save-time check and no save is involved in
reading a permission. Making `author` mandatory is what stops the row being
written at all, and it is the only half that can: stored_authors can hide a row
that means nothing, but hiding it leaves it in the table for the next reader.
"""

import frappe

from lms.lms.permissions import is_content_author, stored_authors
from lms.lms.test_helpers import BaseTestUtils


class TestBlankAuthorRow(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(f"bar-a-{self.hash}@example.com", "Ann", "Author", ["Course Creator"])
		self.moderator = self._create_user(
			f"bar-m-{self.hash}@example.com", "Mo", "Moderator", ["Course Creator", "Moderator"]
		)
		self._assert_the_actors_are_who_this_suite_needs()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _assert_the_actors_are_who_this_suite_needs(self):
		"""_create_user returns a pre-existing user and ignores its `roles` argument.

		An author who turned out to hold Moderator is readmitted by the gate before it
		ever reads `authors`, and every assertion below would then measure nothing.
		"""
		author_roles = set(frappe.get_roles(self.author.name))
		self.assertIn("Course Creator", author_roles)
		self.assertNotIn("Moderator", author_roles)
		self.assertNotIn("System Manager", author_roles)
		self.assertIn("Moderator", frappe.get_roles(self.moderator.name))

	def _quiz_with_blank_author_row(self):
		"""A quiz carrying one `authors` row that names nobody.

		ignore_mandatory is how a row stored before `author` became required is put
		back: this suite has to keep measuring the stored-row half after the field is
		mandatory, and a fixture that the second layer makes unbuildable stops testing
		the first one.
		"""
		frappe.set_user(self.author.name)
		quiz = frappe.get_doc(
			{"doctype": "LMS Quiz", "title": f"Blank author quiz {self.hash}", "authors": [{}]}
		).insert(ignore_mandatory=True)
		frappe.set_user("Administrator")
		self.assertEqual(
			frappe.get_all(
				"LMS Content Author",
				filters={"parent": quiz.name, "parenttype": "LMS Quiz"},
				pluck="author",
			),
			[None],
			"the fixture stored no blank row, so nothing below is measured",
		)
		return quiz

	def test_a_control_the_author_writes_a_quiz_whose_authors_row_names_them(self):
		"""The gate answers yes on the ordinary shape, so a refusal below is the blank row."""
		frappe.set_user(self.author.name)
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"Named author quiz {self.hash}",
				"authors": [{"author": self.author.name}],
			}
		).insert()
		frappe.set_user("Administrator")

		self.assertEqual(stored_authors("LMS Quiz", quiz.name), [self.author.name])
		self.assertTrue(frappe.has_permission("LMS Quiz", "write", doc=quiz.name, user=self.author.name))

	def test_a_control_a_moderator_writes_a_quiz_carrying_a_blank_row(self):
		"""A gate that refuses everyone is not this gate."""
		quiz = self._quiz_with_blank_author_row()

		self.assertTrue(frappe.has_permission("LMS Quiz", "write", doc=quiz.name, user=self.moderator.name))

	def test_a_blank_row_leaves_the_creator_writing_their_own_quiz(self):
		"""The half that heals a row already in the table: an empty author is not a name."""
		quiz = self._quiz_with_blank_author_row()

		self.assertEqual(stored_authors("LMS Quiz", quiz.name), [])
		self.assertTrue(is_content_author("LMS Quiz", quiz.name, self.author.name))
		self.assertTrue(frappe.has_permission("LMS Quiz", "write", doc=quiz.name, user=self.author.name))
		self.assertTrue(frappe.has_permission("LMS Quiz", "delete", doc=quiz.name, user=self.author.name))

	def test_a_blank_row_does_not_hand_the_quiz_to_a_bystander(self):
		"""Dropping the empty value restores the `owner` fallback, it does not open the row.

		A quiz whose only author row is blank answers to whoever inserted it, and the
		Moderator above is readmitted by role. Nobody else arrives.
		"""
		quiz = self._quiz_with_blank_author_row()
		bystander = self._create_user(f"bar-b-{self.hash}@example.com", "Bo", "Bystander", ["Course Creator"])
		self.assertNotIn("Moderator", frappe.get_roles(bystander.name))

		self.assertFalse(is_content_author("LMS Quiz", quiz.name, bystander.name))
		self.assertFalse(frappe.has_permission("LMS Quiz", "write", doc=quiz.name, user=bystander.name))

	def test_a_blank_author_row_cannot_be_stored_in_the_first_place(self):
		"""The half stored_authors cannot do: the row never reaches the table.

		A frappe.client.save payload carrying `authors: [{}]`, and a desk grid row
		added and saved, both arrive here. The error names the field, which is what
		tells whoever sent it what to fix.
		"""
		frappe.set_user(self.author.name)
		try:
			with self.assertRaises(frappe.MandatoryError) as caught:
				frappe.get_doc(
					{"doctype": "LMS Quiz", "title": f"Refused quiz {self.hash}", "authors": [{}]}
				).insert()
		finally:
			frappe.set_user("Administrator")

		self.assertIn("author", str(caught.exception).lower())
		self.assertFalse(frappe.db.exists("LMS Quiz", {"title": f"Refused quiz {self.hash}"}))

	def test_the_seeded_author_row_still_saves_with_the_field_required(self):
		"""AuthoredDocument.before_insert fills the table, so mandatory must not block it.

		This is the path every ordinary create takes — nothing in the app posts an
		`authors` list — and a `reqd` that broke it would refuse every new quiz.
		"""
		frappe.set_user(self.author.name)
		quiz = frappe.get_doc({"doctype": "LMS Quiz", "title": f"Seeded quiz {self.hash}"}).insert()
		frappe.set_user("Administrator")

		self.assertEqual(stored_authors("LMS Quiz", quiz.name), [self.author.name])
