# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils

EXPLANATION_FIELDS = tuple(f"explanation_{i}" for i in range(1, 11))
CORRECTNESS_FIELDS = tuple(f"is_correct_{i}" for i in range(1, 11))
LEVEL_1_ROLES = ("System Manager", "Moderator", "Course Creator")

# A role that holds permlevel-0 read on LMS Question and no permlevel-1 row, which is
# the shape the permlevel exists to refuse. No such role ships with the app -- see
# TestTheLevel1RowsAreWhatMakeItInert -- so the suite makes one rather than pretending.
PROBE_ROLE = "LMS Question Permlevel Probe"


def seed(doc: dict):
	"""Insert a fixture row past the gate this suite measures."""
	# nosemgrep: lms-unjustified-ignore-permissions - test fixture, see docstring
	return frappe.get_doc(doc).insert(ignore_permissions=True)


def seed_save(doc):
	"""Save a fixture document past the gate this suite measures, as seed() does."""
	# nosemgrep: lms-unjustified-ignore-permissions - test fixture, see docstring
	doc.save(ignore_permissions=True)
	return doc


def docperm_rows():
	return frappe.get_all(
		"DocPerm",
		filters={"parent": "LMS Question"},
		fields=["name", "role", "permlevel", "read", "write"],
		order_by="permlevel, role",
	)


class DocPermFixture(BaseTestUtils):
	"""Mutate DocPerm rows inside a test without leaking them into the shared site:
	restore the snapshot in tearDownClass (a DocPerm write commits past the runner's
	rollback) and clear the meta cache in tearDown (a savepoint rollback does not)."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._docperm_backup = frappe.get_all("DocPerm", filters={"parent": "LMS Question"}, fields=["*"])
		cls._probe_role_existed = bool(frappe.db.exists("Role", PROBE_ROLE))

	def tearDown(self):
		super().tearDown()
		frappe.clear_cache()

	@classmethod
	def tearDownClass(cls):
		kept = {row["name"] for row in cls._docperm_backup}
		for extra in frappe.get_all("DocPerm", filters={"parent": "LMS Question"}, pluck="name"):
			if extra not in kept:
				frappe.db.delete("DocPerm", {"name": extra})
		for row in cls._docperm_backup:
			if not frappe.db.exists("DocPerm", row["name"]):
				restored = frappe.new_doc("DocPerm")
				restored.update(row)
				restored.flags.name_set = True
				restored.db_insert()
			else:
				frappe.db.set_value(
					"DocPerm",
					row["name"],
					{"read": row["read"], "write": row["write"]},
					update_modified=False,
				)
		if not cls._probe_role_existed and frappe.db.exists("Role", PROBE_ROLE):
			frappe.db.delete("Has Role", {"role": PROBE_ROLE})
			frappe.db.delete("DocPerm", {"role": PROBE_ROLE})
			frappe.db.delete("Role", {"name": PROBE_ROLE})
		frappe.clear_cache()
		super().tearDownClass()


class TestTheFieldsThatMoved(BaseTestUtils):
	"""explanation_1..10 moved to permlevel 1; is_correct_1..10 stayed at 0."""

	def test_every_explanation_field_is_at_permlevel_1(self):
		meta = frappe.get_meta("LMS Question")
		for fieldname in EXPLANATION_FIELDS:
			with self.subTest(fieldname=fieldname):
				self.assertEqual(meta.get_field(fieldname).permlevel, 1)

	def test_no_correctness_field_moved(self):
		"""is_correct_1..10 grades the answer and must stay readable at permlevel 0."""
		meta = frappe.get_meta("LMS Question")
		for fieldname in CORRECTNESS_FIELDS:
			with self.subTest(fieldname=fieldname):
				self.assertEqual(meta.get_field(fieldname).permlevel, 0)

	def test_the_level_1_rows_ship_with_the_fields(self):
		"""Half a permlevel change is worse than none: the fields move and nobody can
		read them back."""
		rows = {row.role: row for row in docperm_rows() if row.permlevel == 1}
		self.assertEqual(set(rows), set(LEVEL_1_ROLES))
		for role, row in rows.items():
			with self.subTest(role=role):
				self.assertTrue(row.read, role)
				self.assertTrue(row.write, role)


class TestTheLevel1RowsAreWhatMakeItInert(DocPermFixture):
	"""Every role with permlevel-0 read also holds the new permlevel-1 row, so this
	change withholds the explanation from nobody who can reach the doctype today.
	Its effect is only prospective, for a role granted access later."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.suffix = frappe.generate_hash(length=6)
		self.question = seed(
			{
				"doctype": "LMS Question",
				"question": f"Permlevel probe {self.suffix}?",
				"type": "Choices",
				"option_1": "Option 1",
				"is_correct_1": 1,
				"explanation_1": f"the rationale {self.suffix}",
				"option_2": "Option 2",
				"is_correct_2": 0,
			}
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _grant_probe_role_level_0_read(self):
		# nosemgrep: lms-exists-then-insert - a single-threaded test fixture; the
		# concurrency the rule guards against cannot arise inside one test process
		if not frappe.db.exists("Role", PROBE_ROLE):
			seed({"doctype": "Role", "role_name": PROBE_ROLE, "desk_access": 0})
		seed(
			{
				"doctype": "DocPerm",
				"parent": "LMS Question",
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": PROBE_ROLE,
				"permlevel": 0,
				"read": 1,
			}
		)
		frappe.clear_cache()

	def _read_as(self, user):
		original = frappe.session.user
		frappe.set_user(user)
		try:
			return frappe.client.get("LMS Question", self.question.name)
		finally:
			frappe.set_user(original)

	def test_every_role_holding_a_grant_today_also_holds_the_level_1_row(self):
		"""The inertness, stated as an assertion so it cannot be read past."""
		level_0 = {row.role for row in docperm_rows() if row.permlevel == 0}
		level_1 = {row.role for row in docperm_rows() if row.permlevel == 1}
		self.assertEqual(
			level_0 - level_1,
			set(),
			"a role holds permlevel 0 and not permlevel 1, so this permlevel now withholds "
			"the explanation from a role that ships with the app -- update this test's "
			"docstring, which says it withholds it from nobody",
		)

	def test_a_course_creator_still_reads_the_explanation(self):
		author = self._create_user(
			f"qfs-author-{self.suffix}@example.com", "Amy", "Author", ["Course Creator"]
		)
		frappe.db.set_value("LMS Question", self.question.name, "owner", author.name)
		doc = self._read_as(author.name)
		self.assertEqual(doc.get("explanation_1"), f"the rationale {self.suffix}")
		self.assertEqual(doc.get("is_correct_1"), 1)

	def test_a_role_with_no_level_1_row_gets_the_row_without_the_explanation(self):
		"""The mechanism, proven on a role made for the purpose. It is the only way to
		show the permlevel works, because no shipped role is in this position."""
		self._grant_probe_role_level_0_read()
		probe = self._create_user(f"qfs-probe-{self.suffix}@example.com", "Pro", "Be", [PROBE_ROLE])
		frappe.db.set_value("LMS Question", self.question.name, "owner", probe.name)
		doc = self._read_as(probe.name)
		self.assertEqual(doc.get("question"), f"Permlevel probe {self.suffix}?")
		self.assertIsNone(doc.get("explanation_1"))
		self.assertEqual(
			doc.get("is_correct_1"),
			1,
			"is_correct_1 stayed at permlevel 0, so it should still come back",
		)


class TestTheLevel1WriteRowIsLoadBearing(DocPermFixture):
	"""A read-only permlevel-1 row would silently blank the field on every save the
	session user makes through frappe.client, since Document resets any field above
	the caller's write level. The write bit on the shipped rows prevents that."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.suffix = frappe.generate_hash(length=6)
		self.author = self._create_user(
			f"qfw-author-{self.suffix}@example.com", "Amy", "Author", ["Course Creator"]
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _insert_as_author(self, explanation):
		frappe.set_user(self.author.name)
		try:
			return frappe.client.insert(
				{
					"doctype": "LMS Question",
					"question": f"Write probe {self.suffix}?",
					"type": "Choices",
					"option_1": "Option 1",
					"is_correct_1": 1,
					"explanation_1": explanation,
					"option_2": "Option 2",
					"is_correct_2": 0,
				}
			)
		finally:
			frappe.set_user("Administrator")

	def _set_value_as_author(self, name, explanation):
		frappe.set_user(self.author.name)
		try:
			frappe.client.set_value("LMS Question", name, "explanation_1", explanation)
		finally:
			frappe.set_user("Administrator")

	def _revoke_level_1_write(self):
		row = next(r for r in docperm_rows() if r.permlevel == 1 and r.role == "Course Creator")
		frappe.db.set_value("DocPerm", row.name, "write", 0, update_modified=False)
		frappe.clear_cache()

	def test_an_author_creating_a_question_keeps_the_explanation(self):
		doc = self._insert_as_author(f"kept on insert {self.suffix}")
		self.assertEqual(
			frappe.db.get_value("LMS Question", doc.get("name"), "explanation_1"),
			f"kept on insert {self.suffix}",
		)

	def test_an_author_editing_a_question_keeps_the_explanation(self):
		doc = self._insert_as_author(f"first {self.suffix}")
		self._set_value_as_author(doc.get("name"), f"second {self.suffix}")
		self.assertEqual(
			frappe.db.get_value("LMS Question", doc.get("name"), "explanation_1"),
			f"second {self.suffix}",
		)

	def test_without_the_level_1_write_row_the_same_save_blanks_it(self):
		"""The control: revoke the row and the identical insert silently drops the
		field with no error and no toast."""
		self._revoke_level_1_write()
		doc = self._insert_as_author(f"lost on insert {self.suffix}")
		self.assertIsNone(frappe.db.get_value("LMS Question", doc.get("name"), "explanation_1"))
		self.assertEqual(
			frappe.db.get_value("LMS Question", doc.get("name"), "is_correct_1"),
			1,
			"is_correct_1 is permlevel 0 and must be unaffected, or this control is "
			"measuring the save failing rather than the permlevel biting",
		)
