# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

"""Four actors and one movable child row per table, shared by the two move suites.

A child row is taken out of somebody else's content through two different doors —
saved on its own (lms/tests/security/test_authored_content_child_row_moves.py) and
carried along by a save of the thief's own parent
(lms/tests/security/test_authored_content_parent_save_moves.py) — and both suites
need the same fixture: an actor who authors the destination, a victim who authors
the source, and a seeded row in the source. Two copies of that fixture is one copy
that will drift, and these suites turn on properties of the actors (an exact role
set) that a copy which drifts stops proving.

A dedicated module rather than another method on BaseTestUtils, for the reason
lms/tests/permission_actors.py gives: this is one scenario spanning five child
tables, not a per-doctype builder, and the suites that want it name it
(apps/press/taste.md:18-19).

Every frappe.set_user below carries a `# nosemgrep: frappe-setuser`. Acting as each
actor is the measurement, not a lapse — the rule waives it for `**/test_*.py` and
this module is the fixture half of two such files, so only the filename differs.
"""

from contextlib import contextmanager

import frappe

from lms import hooks
from lms.lms.test_helpers import BaseTestUtils

AUTHORED_DOCTYPES = ("LMS Quiz", "LMS Programming Exercise", "LMS Assignment", "LMS Question")

# Every parent whose child rows the gate answers for. LMS Program is not in the tuple
# above -- it composes the write gate rather than registering on it -- but it carries
# `authors`, so its own child tables are reachable by the same move.
GATED_PARENTS = (*AUTHORED_DOCTYPES, "LMS Program")
GATE = "lms.lms.permissions.refuse_moving_child_rows_out_of_content_the_user_cannot_write"


def registered_validate_hooks(doctype):
	"""lms.hooks read off the module, not through frappe.get_hooks.

	get_hooks serves a redis-cached registry that in a worktree hands back the main
	checkout's registrations, so a suite asking it can pass on a branch that removed
	the entry. One doctype's `validate` is a string; normalise it to a list.
	"""
	registered = hooks.doc_events.get(doctype, {}).get("validate", [])
	return registered if isinstance(registered, list) else [registered]


class AuthoredContentChildRowActors(BaseTestUtils):
	"""An author, a bystander, a Moderator and a bare System Manager, plus the fixtures.

	No actor is the owner of the row a refusal is measured against, and the bystander
	holds neither of the two roles the gate readmits, because either would agree even
	with a wrong answer. Nothing trusts this docstring: setUp reads the role sets back.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")  # nosemgrep: frappe-setuser
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(f"acr-a-{self.hash}@example.com", "Ann", "Author", ["Course Creator"])
		self.bystander = self._create_user(
			f"acr-b-{self.hash}@example.com", "Bo", "Bystander", ["Course Creator"]
		)
		self.moderator = self._create_user(
			f"acr-m-{self.hash}@example.com", "Mo", "Moderator", ["Course Creator", "Moderator"]
		)
		self.site_manager = self._create_user(
			f"acr-s-{self.hash}@example.com", "Sam", "Manager", ["System Manager"], user_type="System User"
		)
		self._assert_the_actors_are_who_this_suite_needs()

	def tearDown(self):
		frappe.set_user("Administrator")  # nosemgrep: frappe-setuser
		super().tearDown()

	def _assert_the_actors_are_who_this_suite_needs(self):
		"""_create_user returns a pre-existing user and ignores its `roles` argument.

		A bystander who turned out to hold Moderator is readmitted by the gate, and
		every refusal below would then be measuring nothing.
		"""
		for user in (self.author, self.bystander, self.moderator):
			self.assertIn("Course Creator", frappe.get_roles(user.name))
		bystander_roles = set(frappe.get_roles(self.bystander.name))
		self.assertNotIn("Moderator", bystander_roles)
		self.assertNotIn("System Manager", bystander_roles)
		self.assertIn("Moderator", frappe.get_roles(self.moderator.name))
		manager_roles = set(frappe.get_roles(self.site_manager.name))
		self.assertIn("System Manager", manager_roles)
		self.assertNotIn("Moderator", manager_roles)

	@contextmanager
	def _acting_as(self, user):
		frappe.set_user(user)  # nosemgrep: frappe-setuser
		try:
			yield
		finally:
			frappe.set_user("Administrator")  # nosemgrep: frappe-setuser

	def _title(self, label):
		"""Unique per call. LMS Program autonames `field:title`, which forces unique=1,
		and _movable_cases rebuilds its fixtures on every call."""
		return f"{label} {self.hash} {frappe.generate_hash(length=4)}"

	def _insert_as(self, owner, payload):
		with self._acting_as(owner):
			doc = frappe.get_doc(payload).insert()
		return doc.name

	def _quiz(self, owner, label):
		return self._insert_as(
			owner,
			{"doctype": "LMS Quiz", "title": self._title(label), "passing_percentage": 70, "total_marks": 0},
		)

	def _exercise(self, owner, label):
		return self._insert_as(
			owner,
			{
				"doctype": "LMS Programming Exercise",
				"title": self._title(label),
				"language": "Python",
				"problem_statement": "<p>Add two numbers.</p>",
				"test_cases": [{"input": "1 2", "expected_output": "3"}],
			},
		)

	def _program(self, owner, label):
		return self._insert_as(owner, {"doctype": "LMS Program", "title": self._title(label)})

	def _question(self, owner, label):
		return self._insert_as(
			owner,
			{
				"doctype": "LMS Question",
				"question": f"{self._title(label)}?",
				"type": "Choices",
				"option_1": "Option 1",
				"is_correct_1": 1,
				"option_2": "Option 2",
				"is_correct_2": 0,
			},
		)

	def _content(self, parenttype, owner, label):
		"""One of the gated parents, by doctype, so a control can build its own destination."""
		builders = {
			"LMS Quiz": self._quiz,
			"LMS Programming Exercise": self._exercise,
			"LMS Program": self._program,
		}
		return builders[parenttype](owner, label)

	def _seed_row(self, child_doctype, parent, parenttype, parentfield, fields, idx=1):
		"""One child row, written straight to the table its parent owns.

		The parent is not loaded before or after, so this cannot be the case of a row
		inserted behind a loaded parent and dropped on its next save. The row is read
		back so a fixture that failed to land cannot pass as a refusal.
		"""
		# nosemgrep: lms-unjustified-ignore-permissions - the seed is the state under test, not the operation under test; the insert half is gated by test_authored_content_child_rows.py
		row = frappe.get_doc(
			{
				"doctype": child_doctype,
				"parent": parent,
				"parenttype": parenttype,
				"parentfield": parentfield,
				"idx": idx,
				**fields,
			}
		).insert(ignore_permissions=True)
		self.assertEqual(frappe.db.get_value(child_doctype, row.name, "parent"), parent)
		return row.name

	def _movable_cases(self):
		"""(child doctype, parenttype, parentfield, row fields, source, destination).

		Every child table the gated parents carry — asserted against the meta by
		test_every_child_table_the_authored_doctypes_carry_is_registered rather than
		trusted here. The source belongs to the author and the destination to the
		bystander, which is the direction a destination-only gate lets through: pushing
		a row the other way is already refused, because there the destination is the
		parent the bystander cannot write.
		"""
		return [
			(
				"LMS Quiz Question",
				"LMS Quiz",
				"questions",
				{"question": self._question(self.author.name, "Moved"), "marks": 1},
				self._quiz(self.author.name, "Source Quiz"),
				self._quiz(self.bystander.name, "Destination Quiz"),
			),
			(
				"LMS Test Case",
				"LMS Programming Exercise",
				"test_cases",
				{"input": "3 4", "expected_output": "7"},
				self._exercise(self.author.name, "Source Exercise"),
				self._exercise(self.bystander.name, "Destination Exercise"),
			),
			(
				"LMS Content Author",
				"LMS Quiz",
				"authors",
				{"author": self.author.name},
				self._quiz(self.author.name, "Source Authors Quiz"),
				self._quiz(self.bystander.name, "Destination Authors Quiz"),
			),
			(
				"LMS Program Course",
				"LMS Program",
				"program_courses",
				{"course": self._course_for_a_program()},
				self._program(self.author.name, "Source Program"),
				self._program(self.bystander.name, "Destination Program"),
			),
			(
				"LMS Program Member",
				"LMS Program",
				"program_members",
				{"member": self.bystander.name},
				self._program(self.author.name, "Source Member Program"),
				self._program(self.bystander.name, "Destination Member Program"),
			),
		]

	def _course_for_a_program(self):
		"""A course for a program row to point at, made by the author through the
		ordinary permission path -- a Course Creator holds create on LMS Course."""
		with self._acting_as(self.author.name):
			course = frappe.get_doc(
				{
					"doctype": "LMS Course",
					"title": self._title("Program Course"),
					"short_introduction": "Short",
					"description": "Description",
					"published": 1,
					"instructors": [{"instructor": self.author.name}],
				}
			).insert()
		return course.name
