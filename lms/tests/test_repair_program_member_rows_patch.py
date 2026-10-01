import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.repair_program_member_rows import execute


class TestRepairProgramMemberRowsPatch(BaseTestUtils):
	"""Rows written by the old self-enrolment carry parentfield "members", which the
	program never loads. Seeded straight into the table, the way that code wrote them."""

	def setUp(self):
		super().setUp()
		self.hash = frappe.generate_hash(length=6)
		self.admin_added = self._user("admin-added")
		self.self_enrolled = self._user("self-enrolled")
		self.twice = self._user("twice")
		self.program = frappe.get_doc(
			{
				"doctype": "LMS Program",
				"title": f"Repair Program {self.hash}",
				"published": 1,
				"program_members": [{"member": self.admin_added}],
			}
		).insert()

	def _user(self, label):
		return self._create_user(
			f"repair-{label}-{self.hash}@example.com", label, "Member", ["LMS Student"]
		).name

	def _seed_row(self, member, parentfield, creation, parent=None, idx=0):
		row = frappe.new_doc("LMS Program Member")
		row.update(
			{
				"parent": parent or self.program.name,
				"parenttype": "LMS Program",
				"parentfield": parentfield,
				"member": member,
				"idx": idx,
			}
		)
		row.db_insert()
		frappe.db.set_value("LMS Program Member", row.name, "creation", creation, update_modified=False)
		return row.name

	def _seed_orphans(self):
		self._seed_row(self.self_enrolled, "members", "2025-09-01 10:00:00")
		oldest = self._seed_row(self.twice, "members", "2025-09-02 10:00:00")
		newer = self._seed_row(self.twice, "program_members", "2025-09-03 10:00:00", idx=2)
		return oldest, newer

	def _rows(self):
		return frappe.get_all(
			"LMS Program Member",
			filters={"parent": self.program.name},
			fields=["name", "member", "parenttype", "parentfield", "idx"],
			order_by="idx asc",
		)

	def test_orphaned_rows_are_repointed_into_the_program(self):
		self._seed_orphans()

		execute()

		program = frappe.get_doc("LMS Program", self.program.name)
		self.assertEqual(
			sorted(row.member for row in program.program_members),
			sorted([self.admin_added, self.self_enrolled, self.twice]),
		)
		self.assertEqual(program.member_count, 3)
		self.assertEqual({row.parentfield for row in self._rows()}, {"program_members"})

	def test_duplicates_keep_the_oldest_row(self):
		oldest, newer = self._seed_orphans()

		execute()

		twice_rows = [row.name for row in self._rows() if row.member == self.twice]
		self.assertEqual(twice_rows, [oldest])
		self.assertFalse(frappe.db.exists("LMS Program Member", newer))

	def test_idx_is_renumbered_with_existing_members_first(self):
		self._seed_orphans()

		execute()

		rows = self._rows()
		self.assertEqual([row.idx for row in rows], [1, 2, 3])
		self.assertEqual(rows[0].member, self.admin_added)

	def test_rows_of_a_deleted_program_are_removed(self):
		ghost = self._seed_row(self.self_enrolled, "members", "2025-09-01 10:00:00", parent="no-such-program")

		execute()

		self.assertFalse(frappe.db.exists("LMS Program Member", ghost))

	def test_running_twice_changes_nothing(self):
		self._seed_orphans()
		execute()
		first = self._rows()

		execute()

		self.assertEqual(self._rows(), first)
		self.assertEqual(frappe.db.get_value("LMS Program", self.program.name, "member_count"), 3)

	def test_a_clean_program_is_left_alone(self):
		before = self._rows()
		modified = frappe.db.get_value("LMS Program", self.program.name, "modified")

		execute()

		self.assertEqual(self._rows(), before)
		self.assertEqual(frappe.db.get_value("LMS Program", self.program.name, "modified"), modified)
