# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.client import get as client_get
from frappe.permissions import rights

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_assignment
from lms.patches.v2_0 import reconcile_custom_docperm_permlevels

# What frappe.get_roles answers for each actor, read live in setUp. LMS Student is
# on every one of them: lms.lms.user.add_lms_student_role is registered on
# User.before_insert and appends it unconditionally. Asserted rather than declared
# because BaseTestUtils._create_user returns a pre-existing User and ignores its
# `roles` argument entirely (lms/lms/test_helpers.py:43-44), so the hash suffix on
# every email below is what makes the declaration true and the assertion is what
# proves it.
ACTOR_ROLES = {
	"student": {"All", "Guest", "LMS Student"},
	"creator": {"All", "Course Creator", "Guest", "LMS Student"},
	"evaluator": {"All", "Batch Evaluator", "Guest", "LMS Student"},
	"moderator": {"All", "Guest", "LMS Student", "Moderator"},
	"sysmanager": {"All", "Desk User", "Guest", "LMS Student", "System Manager"},
}

GRADING_ACTORS = ("creator", "evaluator", "moderator", "sysmanager")

MODEL_ANSWER = "<p>THE-MODEL-ANSWER-NO-STUDENT-MAY-READ</p>"
ABSENT = "<absent>"


class TestAssignmentAnswerScope(BaseTestUtils):
	"""`answer` is the model answer on a row every account on the site can read.

	`LMS Assignment` grants `LMS Student` read at permlevel 0, and every account
	holds that role, so before this field carried a permlevel the answer key of
	every assignment on the site was one `frappe.client.get` away — and one
	`frappe.get_list` away, which is the half a single-doc gate would have missed.

	`show_answer` is not the gate people assume it is. It exists in
	lms_assignment.json and in the generated frontend type and is read **nowhere**
	on the server or the client, so there is no reveal path for this suite to
	preserve. What narrows the field is the permlevel plus the DocPerm rows that
	ship with it; a permlevel with no rows at that level hides the field from
	everyone, Moderators included, with no error, which is why the moderator below
	is a control and not an afterthought.

	Three read paths, because they fail independently: `frappe.client.get` (the
	REST single-doc read), `frappe.get_list` (which no single-doc gate is consulted
	on) and `lms.lms.utils.get_assignment` (the whitelisted endpoint the grading UI
	calls). Every role holding a permlevel-1 grant is an actor, System Manager
	included -- a role granted the field and never read back is a row nothing keeps
	honest.

	Administrator is deliberately not an actor: it returns from
	`Document.apply_fieldlevel_read_permissions` before reading any permlevel
	(frappe/model/document.py:1254), so it agrees with a wrong answer.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)
		self.student = self._create_user(f"aas-s-{hash}@example.com", "Sam", "Student", ["LMS Student"])
		self.creator = self._create_user(f"aas-c-{hash}@example.com", "Cara", "Creator", ["Course Creator"])
		self.evaluator = self._create_user(
			f"aas-e-{hash}@example.com", "Eli", "Evaluator", ["Batch Evaluator"]
		)
		self.moderator = self._create_user(f"aas-m-{hash}@example.com", "Mo", "Moderator", ["Moderator"])
		self.sysmanager = self._create_user(
			f"aas-sm-{hash}@example.com",
			"Sy",
			"Manager",
			["System Manager"],
			user_type="System User",
		)
		self.assignment = self._create_answered_assignment(hash)
		self._assert_actor_roles()
		self.custom_docperms: list[str] = []

	def tearDown(self):
		frappe.set_user("Administrator")
		# A `Custom DocPerm` row outlives the savepoint BaseTestUtils rolls back, so the
		# shadow this suite arranges has to be removed by hand or the next test reads a
		# doctype whose shipped permissions are still replaced.
		for name in reversed(self.custom_docperms):
			if frappe.db.exists("Custom DocPerm", name):
				# nosemgrep: lms-unjustified-ignore-permissions - removes a row this test itself added
				frappe.delete_doc("Custom DocPerm", name, ignore_permissions=True)
		if self.custom_docperms:
			frappe.clear_cache(doctype="LMS Assignment")
		super().tearDown()

	def _create_answered_assignment(self, hash):
		"""An assignment with a filled `answer`, made here rather than by the shared
		helper: `_create_assignment` writes no answer, and widening it would change
		what every other suite's fixture carries."""
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": f"Answer Scope {hash}",
				"type": "Text",
				"question": "<p>What is the answer?</p>",
				"show_answer": 1,
				"answer": MODEL_ANSWER,
			}
		).insert()
		return assignment

	def _assert_actor_roles(self):
		for label, expected in ACTOR_ROLES.items():
			self.assertEqual(
				set(frappe.get_roles(getattr(self, label).name)),
				expected,
				f"{label}: holds roles this suite's expectations were not derived against",
			)

	def _single_doc_read(self, label):
		"""The REST single-doc path. `frappe.get_doc` runs no permission check at all,
		so the read has to go through the endpoint that applies field-level ones."""
		frappe.set_user(getattr(self, label).name)
		try:
			return client_get("LMS Assignment", self.assignment.name)
		finally:
			frappe.set_user("Administrator")

	def _list_read(self, label):
		"""`frappe.get_list`, never `frappe.get_all` — get_all sets
		ignore_permissions=True and would bypass the rule under test."""
		frappe.set_user(getattr(self, label).name)
		try:
			rows = frappe.get_list(
				"LMS Assignment",
				filters={"name": self.assignment.name},
				fields=["name", "answer"],
			)
			return rows[0] if rows else None
		finally:
			frappe.set_user("Administrator")

	def _endpoint_read(self, label):
		"""`lms.lms.utils.get_assignment`, the whitelisted path Assignment.vue:292
		actually calls. It applies the field-level permissions itself, then returns
		`doc.as_dict()` — and `as_dict` puts the key back with a None value, so this
		path answers None where the two above drop the key. Asserting absence here
		would fail on a payload that withheld the field correctly."""
		frappe.set_user(getattr(self, label).name)
		try:
			return get_assignment(self.assignment.name)
		finally:
			frappe.set_user("Administrator")

	def test_a_control_every_grading_role_still_reads_the_answer(self):
		"""Read this before the refusals below. A red phase where the control also
		fails is a broken environment, not a finding."""
		for label in GRADING_ACTORS:
			self.assertEqual(
				self._single_doc_read(label).get("answer", ABSENT),
				MODEL_ANSWER,
				f"{label} lost the model answer on the single-doc read; graders need it",
			)
			self.assertEqual(
				self._list_read(label).get("answer", ABSENT),
				MODEL_ANSWER,
				f"{label} lost the model answer on the list read; graders need it",
			)
			self.assertEqual(
				self._endpoint_read(label).get("answer", ABSENT),
				MODEL_ANSWER,
				f"{label} lost the model answer on get_assignment, the grading UI's path",
			)

	def test_a_control_the_student_still_reads_the_row_itself(self):
		"""This narrows a field, not access. A student sitting the assignment reads
		its title and its question exactly as before."""
		doc = self._single_doc_read("student")
		self.assertEqual(doc.get("title"), self.assignment.title)
		self.assertEqual(doc.get("question"), self.assignment.question)
		self.assertEqual(self._list_read("student").get("name"), self.assignment.name)

	def test_a_student_gets_no_answer_on_the_single_doc_read(self):
		self.assertEqual(
			self._single_doc_read("student").get("answer", ABSENT),
			ABSENT,
			"a student read the model answer through frappe.client.get",
		)

	def test_a_student_gets_no_answer_on_a_list_read(self):
		self.assertEqual(
			self._list_read("student").get("answer", ABSENT),
			ABSENT,
			"a student read the model answer through frappe.get_list, which no "
			"single-doc gate is consulted on",
		)

	def test_a_student_gets_no_answer_from_the_get_assignment_endpoint(self):
		"""The endpoint keeps the key and answers None -- see `_endpoint_read`."""
		self.assertIsNone(
			self._endpoint_read("student").get("answer"),
			"a student read the model answer through lms.lms.utils.get_assignment",
		)

	def test_a_control_the_student_still_reads_the_row_itself_from_the_endpoint(self):
		"""The endpoint withholds one field and still serves the assignment."""
		payload = self._endpoint_read("student")
		self.assertEqual(payload.get("title"), self.assignment.title)
		self.assertEqual(payload.get("question"), self.assignment.question)

	def _snapshot_shipped_perms_into_custom_docperm(self, doctype):
		"""What `frappe.permissions.copy_perms` left behind on a site whose administrator
		opened Role Permissions Manager before this change: the permlevel-0 shipped rows
		copied into `Custom DocPerm`, and nothing at permlevel 1."""
		shipped = frappe.get_all(
			"DocPerm",
			filters={"parent": doctype, "parenttype": "DocType", "permlevel": 0},
			fields=["role", *rights],
		)
		self.assertTrue(shipped, f"{doctype} ships no permlevel 0 DocPerm row to snapshot")
		for row in shipped:
			perm = frappe.new_doc("Custom DocPerm")
			perm.update(
				{
					"parent": doctype,
					"parenttype": "DocType",
					"parentfield": "permissions",
					"permlevel": 0,
				}
			)
			perm.update(row)
			# nosemgrep: lms-unjustified-ignore-permissions - stands in for the administrator action under test
			perm.insert(ignore_permissions=True)
			self.custom_docperms.append(perm.name)
		frappe.clear_cache(doctype=doctype)

	def test_the_reconcile_patch_gives_the_graders_back_what_a_custom_docperm_set_took(self):
		"""The `patches.txt` re-run line is what carries the four rows this change ships
		onto a site whose administrator has already used Role Permissions Manager here.

		`Meta.set_custom_permissions` replaces the shipped rows with that site's
		`Custom DocPerm` set wholesale, and `copy_perms` snapshotted that set before these
		rows existed, so on such a site the narrowing **over-applies**: the graders lose
		the field too. The first loop is that state, asserted rather than assumed -- if it
		ever stops holding there is nothing for the patch to repair and the rest of this
		test proves nothing. The student assertion at the end is the other half: the
		repair must not be one that also hands the answer back to the people sitting the
		assignment."""
		self._snapshot_shipped_perms_into_custom_docperm("LMS Assignment")

		for label in GRADING_ACTORS:
			self.assertEqual(
				self._single_doc_read(label).get("answer", ABSENT),
				ABSENT,
				f"{label} still reads the model answer under a pre-upgrade Custom DocPerm "
				"set, so this test is no longer measuring the over-application it names",
			)

		reconcile_custom_docperm_permlevels.reconcile(["LMS Assignment"])
		frappe.clear_cache(doctype="LMS Assignment")

		for label in GRADING_ACTORS:
			self.assertEqual(
				self._single_doc_read(label).get("answer", ABSENT),
				MODEL_ANSWER,
				f"{label} did not get the model answer back after the reconcile patch ran",
			)
		self.assertEqual(
			self._single_doc_read("student").get("answer", ABSENT),
			ABSENT,
			"the reconcile patch handed the model answer back to a student",
		)
