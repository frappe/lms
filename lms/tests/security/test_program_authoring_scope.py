# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""Write, create and delete on LMS Program narrow to its `authors`. Read does not.

LMS Program is the fifth doctype carrying the field and the only one whose gate is
composed rather than registered: frappe takes one has_permission entry per doctype
and LMS Program's own hook already holds the published-or-enrolled read rule. Its
hook calls has_authored_content_permission instead, so the five stay one rule, and
this suite measures the composition rather than the shared predicate.

Every refusal is asserted against the resulting state -- the stored field is
unchanged, the row is still there -- and is preceded by a doctype-level
frappe.has_permission, which skips the controller hook and so reads the role grant
alone. That is what makes the refusal attributable to this gate rather than to a
DocPerm row the actor never held.
"""

from contextlib import contextmanager

import frappe
import frappe.client

from lms import hooks
from lms.lms.doctype.lms_program import lms_program
from lms.lms.permissions import has_authored_content_permission, stored_authors
from lms.lms.test_helpers import BaseTestUtils

GATE = "lms.lms.doctype.lms_program.lms_program.has_permission"
PQC = "lms.lms.doctype.lms_program.lms_program.get_permission_query_conditions"


class ProgramAuthoringActors(BaseTestUtils):
	"""An author, a same-role colleague, a Moderator and a student, plus one program."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(f"pas-a-{self.hash}@example.com", "Ann", "Author", ["Course Creator"])
		self.colleague = self._create_user(
			f"pas-c-{self.hash}@example.com", "Bo", "Colleague", ["Course Creator"]
		)
		self.moderator = self._create_user(f"pas-m-{self.hash}@example.com", "Di", "Moderator", ["Moderator"])
		self.student = self._create_user(f"pas-s-{self.hash}@example.com", "Ed", "Student", [])
		self._assert_the_actors_are_who_this_suite_needs()
		self.program = self._program(self.author.name, "Authored", published=1)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _assert_the_actors_are_who_this_suite_needs(self):
		"""_create_user returns a pre-existing user and ignores its `roles` argument.

		The emails are hash-suffixed so that cannot happen here, and the roles are read
		back anyway: a colleague who turned out to hold Moderator is readmitted by the
		gate, and every refusal below would then be measuring nothing.
		"""
		for user, role in (
			(self.author, "Course Creator"),
			(self.colleague, "Course Creator"),
			(self.moderator, "Moderator"),
		):
			self.assertIn(role, frappe.get_roles(user.name), f"{user.name} does not hold {role}")

		colleague_roles = set(frappe.get_roles(self.colleague.name))
		self.assertNotIn("Moderator", colleague_roles)
		self.assertNotIn("System Manager", colleague_roles)
		student_roles = set(frappe.get_roles(self.student.name))
		self.assertNotIn("Course Creator", student_roles)
		self.assertNotIn("Moderator", student_roles)

	@contextmanager
	def _acting_as(self, user):
		frappe.set_user(user)
		try:
			yield
		finally:
			frappe.set_user("Administrator")

	def _title(self, label):
		"""Unique per call: LMS Program autonames `field:title`, which forces unique=1."""
		return f"Program {label} {self.hash} {frappe.generate_hash(length=4)}"

	def _program(self, owner, label, published=1):
		"""Inserted as the actor, through the ordinary permission path.

		Not with ignore_permissions: `create` of one's own program is unscoped by
		design, and a create that stopped working for an authoring role is a
		regression this suite should fail on rather than wave through.
		"""
		with self._acting_as(owner):
			return frappe.get_doc(
				{"doctype": "LMS Program", "title": self._title(label), "published": published}
			).insert()

	def _course(self):
		"""A course for the program to hold, made by the author through the ordinary path."""
		with self._acting_as(self.author.name):
			return frappe.get_doc(
				{
					"doctype": "LMS Course",
					"title": f"Program Course {self.hash} {frappe.generate_hash(length=4)}",
					"short_introduction": "Short",
					"description": "Description",
					"published": 1,
					"instructors": [{"instructor": self.author.name}],
				}
			).insert()

	def _stored_order_flag(self, name):
		return frappe.db.get_value("LMS Program", name, "enforce_course_order")

	def _assert_write_and_delete_refused(self, name, user):
		before = self._stored_order_flag(name)
		for ptype in ("write", "delete"):
			self.assertTrue(
				frappe.has_permission("LMS Program", ptype, user=user),
				f"this actor holds no {ptype} grant, so a refusal proves nothing",
			)

		with self._acting_as(user):
			doc = frappe.get_doc("LMS Program", name)
			doc.enforce_course_order = 0 if before else 1
			with self.assertRaises(frappe.PermissionError):
				doc.save()
			with self.assertRaises(frappe.PermissionError):
				frappe.delete_doc("LMS Program", name)

		self.assertEqual(self._stored_order_flag(name), before, "a refused write landed anyway")
		self.assertTrue(frappe.db.exists("LMS Program", name), "a refused delete removed the row")


class TestProgramAuthoringScope(ProgramAuthoringActors):
	def test_the_author_writes_and_deletes_the_program_they_made(self):
		"""CONTROL. Read this before any refusal count below."""
		self.assertEqual(stored_authors("LMS Program", self.program.name), [self.author.name])

		with self._acting_as(self.author.name):
			doc = frappe.get_doc("LMS Program", self.program.name)
			doc.enforce_course_order = 1
			doc.save()
		self.assertEqual(self._stored_order_flag(self.program.name), 1)

		disposable = self._program(self.author.name, "Disposable", published=0)
		with self._acting_as(self.author.name):
			frappe.delete_doc("LMS Program", disposable.name)
		self.assertFalse(frappe.db.exists("LMS Program", disposable.name))

	def test_a_moderator_writes_and_deletes_a_program_they_did_not_make(self):
		"""CONTROL. A site always keeps one role that can reach every program."""
		with self._acting_as(self.moderator.name):
			doc = frappe.get_doc("LMS Program", self.program.name)
			doc.enforce_course_order = 1
			doc.save()
			frappe.delete_doc("LMS Program", self.program.name)
		self.assertFalse(frappe.db.exists("LMS Program", self.program.name))

	def test_another_course_creator_may_not_write_or_delete_a_program_they_did_not_make(self):
		"""The finding: LMS Program's hook admitted the whole Course Creator role."""
		self._assert_write_and_delete_refused(self.program.name, self.colleague.name)

	def test_another_course_creator_may_not_write_through_the_api_resource_path(self):
		"""The same refusal on the door the SPA uses. frappe.client.set_value loads the
		doc, so the composed hook is reached; frappe.db.set_value would not be."""
		self.assertTrue(frappe.has_permission("LMS Program", "write", user=self.colleague.name))
		with self._acting_as(self.colleague.name):
			with self.assertRaises(frappe.PermissionError):
				frappe.client.set_value("LMS Program", self.program.name, "enforce_course_order", 1)
		self.assertFalse(self._stored_order_flag(self.program.name))

	def test_a_named_co_author_writes_the_program(self):
		"""`authors` is several people and reassignable, which is why owner cannot do it."""
		with self._acting_as(self.author.name):
			doc = frappe.get_doc("LMS Program", self.program.name)
			doc.append("authors", {"author": self.colleague.name})
			doc.save()

		self.assertIn(self.colleague.name, stored_authors("LMS Program", self.program.name))
		with self._acting_as(self.colleague.name):
			doc = frappe.get_doc("LMS Program", self.program.name)
			doc.enforce_course_order = 1
			doc.save()
		self.assertEqual(self._stored_order_flag(self.program.name), 1)

	def test_a_program_with_no_authors_row_falls_back_to_its_owner(self):
		"""Why no backfill patch ships: every program written before the field exists
		carries an empty `authors`, and nothing fills them."""
		frappe.db.delete("LMS Content Author", {"parent": self.program.name, "parenttype": "LMS Program"})
		self.assertEqual(stored_authors("LMS Program", self.program.name), [])

		with self._acting_as(self.author.name):
			doc = frappe.get_doc("LMS Program", self.program.name)
			doc.enforce_course_order = 1
			doc.save()
		self.assertEqual(self._stored_order_flag(self.program.name), 1)
		self._assert_write_and_delete_refused(self.program.name, self.colleague.name)

	def test_another_course_creator_may_not_add_child_rows_to_a_program_they_did_not_make(self):
		"""A child row's insert is checked against its PARENT, which is why `create` is
		narrowed as well as `write`. This is the shape ProgramForm.vue's two list
		resources post."""
		for parentfield, doctype, payload in (
			("program_courses", "LMS Program Course", {"course": self._course().name}),
			("program_members", "LMS Program Member", {"member": self.student.name}),
		):
			with self.subTest(parentfield=parentfield):
				self.assertTrue(
					frappe.has_permission("LMS Program", "create", user=self.colleague.name),
					"this actor holds no create grant, so a refusal proves nothing",
				)
				with self._acting_as(self.colleague.name):
					row = frappe.get_doc(
						{
							"doctype": doctype,
							"parent": self.program.name,
							"parenttype": "LMS Program",
							"parentfield": parentfield,
							**payload,
						}
					)
					with self.assertRaises(frappe.PermissionError):
						row.insert()
				self.assertEqual(frappe.db.count(doctype, {"parent": self.program.name}), 0)

	def test_another_course_creator_may_not_move_a_course_row_out_of_a_program(self):
		"""has_child_permission is only ever shown the destination parent, so the
		move-from half is asked by the doc_events gate the four siblings share."""
		course = self._course()
		with self._acting_as(self.author.name):
			doc = frappe.get_doc("LMS Program", self.program.name)
			doc.append("program_courses", {"course": course.name})
			doc.save()
		row = frappe.db.get_value("LMS Program Course", {"parent": self.program.name}, "name")
		self.assertTrue(row, "the fixture row was dropped, so the move below proves nothing")

		mine = self._program(self.colleague.name, "Destination", published=0)
		with self._acting_as(self.colleague.name):
			stolen = frappe.get_doc("LMS Program Course", row)
			stolen.parent = mine.name
			with self.assertRaises(frappe.PermissionError):
				stolen.save()

		self.assertEqual(
			frappe.db.get_value("LMS Program Course", row, "parent"),
			self.program.name,
			"a refused move landed anyway",
		)


class TestProgramReadIsNotNarrowed(ProgramAuthoringActors):
	"""The catalogue half, and the pairing between the hook and its query condition."""

	def test_the_single_doc_read_is_unchanged_for_every_actor(self):
		unpublished = self._program(self.author.name, "Unpublished", published=0)

		self.assertTrue(
			frappe.has_permission("LMS Program", "read", doc=self.program.name, user=self.student.name),
			"a published program stopped being readable by a student",
		)
		self.assertFalse(
			frappe.has_permission("LMS Program", "read", doc=unpublished.name, user=self.student.name)
		)
		self.assertTrue(
			frappe.has_permission("LMS Program", "read", doc=unpublished.name, user=self.colleague.name),
			"a non-author Course Creator lost the catalogue read this gate must not narrow",
		)

	def test_the_list_read_agrees_with_the_single_doc_read(self):
		"""The pair. A has_permission hook is not consulted on a list query, so the two
		halves are separate code and only a test holds them together."""
		unpublished = self._program(self.author.name, "Unpublished", published=0)

		for user, expected in (
			(self.colleague.name, {self.program.name: True, unpublished.name: True}),
			(self.student.name, {self.program.name: True, unpublished.name: False}),
			(self.moderator.name, {self.program.name: True, unpublished.name: True}),
		):
			with self._acting_as(user):
				listed = set(frappe.get_list("LMS Program", pluck="name", limit_page_length=0))
				via_api = {row.name for row in frappe.client.get_list("LMS Program", limit_page_length=0)}
			for name, visible in expected.items():
				with self.subTest(user=user, program=name):
					self.assertIs(name in listed, visible, "frappe.get_list disagrees with the hook")
					self.assertIs(name in via_api, visible, "/api/resource disagrees with the hook")
					self.assertIs(frappe.has_permission("LMS Program", "read", doc=name, user=user), visible)

	def test_both_halves_are_registered_and_read_the_same_role_list(self):
		self.assertEqual(hooks.has_permission["LMS Program"], GATE)
		self.assertEqual(hooks.permission_query_conditions["LMS Program"], PQC)
		self.assertIs(lms_program.has_authored_content_permission, has_authored_content_permission)

		for user in (self.author.name, self.colleague.name, self.moderator.name):
			with self.subTest(user=user):
				self.assertTrue(lms_program.has_authoring_role(user))
				self.assertEqual(lms_program.get_permission_query_conditions(user), "")
		self.assertFalse(lms_program.has_authoring_role(self.student.name))
		self.assertIn("tabLMS Program Member", lms_program.get_permission_query_conditions(self.student.name))


class TestProgramCompositionDidNotWiden(ProgramAuthoringActors):
	"""Everything the old hook refused must still be refused. A hook can only subtract,
	so a composition that granted anything new would be a bug in this branch, not a
	widening frappe would have allowed anyway."""

	def test_a_bare_system_manager_is_refused_exactly_as_it_was_before(self):
		"""Pre-existing and upstream, pinned here so this branch is not blamed for it.

		LMS Program's hook names Moderator and Course Creator and consults
		is_site_administrator nowhere, on develop too -- so a System Manager holding
		neither role is denied every non-read type its own DocPerm row grants. The role
		test runs BEFORE the shared predicate for exactly this reason: routing it into
		has_authored_content_permission would readmit it through is_site_administrator,
		which would be a widening.
		"""
		manager = self._create_user(
			f"pas-sm-{self.hash}@example.com", "Sy", "Manager", ["System Manager"], user_type="System User"
		)
		roles = set(frappe.get_roles(manager.name))
		self.assertNotIn("Moderator", roles)
		self.assertNotIn("Course Creator", roles)

		self.assertTrue(frappe.has_permission("LMS Program", "write", user=manager.name))
		self.assertFalse(
			frappe.has_permission("LMS Program", "write", doc=self.program.name, user=manager.name)
		)
		self.assertTrue(
			frappe.has_permission("LMS Program", "read", doc=self.program.name, user=manager.name)
		)

	def test_a_student_is_refused_every_authoring_type_as_before(self):
		for ptype in ("write", "delete", "create", "email", "share"):
			with self.subTest(ptype=ptype):
				self.assertFalse(
					frappe.has_permission("LMS Program", ptype, doc=self.program.name, user=self.student.name)
				)

	def test_a_role_holder_keeps_every_type_this_gate_does_not_narrow(self):
		"""The gate answers write, delete and create. Nothing else moves, including the
		ptype-less ask get_doc_permissions makes."""
		for ptype in ("read", "select", "print", "share", "export", "report", "email"):
			with self.subTest(ptype=ptype):
				self.assertTrue(
					lms_program.has_permission(
						frappe.get_doc("LMS Program", self.program.name), ptype, self.colleague.name
					),
					f"a non-author Course Creator lost {ptype}, which this gate does not narrow",
				)
		self.assertTrue(
			lms_program.has_permission(
				frappe.get_doc("LMS Program", self.program.name), None, self.colleague.name
			),
			"the ptype-less ask changed answer for a role holder",
		)
