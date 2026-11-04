from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import enroll_in_program


class TestProgramSelfEnrollment(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.hash = frappe.generate_hash(length=6)
		self.student = self._create_user(
			f"prog-enrol-{self.hash}@example.com", "Prog", "Learner", ["LMS Student"]
		)
		self.program = self._program(published=1)

	def _program(self, published):
		return frappe.get_doc(
			{
				"doctype": "LMS Program",
				"title": f"Enrol Program {self.hash} {frappe.generate_hash(length=4)}",
				"published": published,
			}
		).insert()

	def _enrol(self, program=None):
		frappe.set_user(self.student.name)
		try:
			enroll_in_program((program or self.program).name)
		finally:
			frappe.set_user("Administrator")

	def _member_rows(self):
		return frappe.get_all(
			"LMS Program Member",
			filters={"parent": self.program.name, "member": self.student.name},
			fields=["parenttype", "parentfield", "idx"],
		)

	def test_self_enrolment_is_a_member_of_the_program(self):
		"""Self-enrolment wrote parentfield "members" since #1686, outside program_members.
		Added for audit finding #20 on branch fix/program-enrol-member-row."""
		self._enrol()

		program = frappe.get_doc("LMS Program", self.program.name)
		self.assertEqual([row.member for row in program.program_members], [self.student.name])
		self.assertEqual(program.member_count, 1)
		self.assertEqual(
			self._member_rows(), [{"parenttype": "LMS Program", "parentfield": "program_members", "idx": 1}]
		)

	def test_enrolling_twice_keeps_one_row(self):
		self._enrol()
		self._enrol()

		self.assertEqual(len(self._member_rows()), 1)
		self.assertEqual(frappe.db.get_value("LMS Program", self.program.name, "member_count"), 1)

	def test_a_self_enrolled_member_cannot_be_added_again(self):
		"""Re-adding a self-enrolled learner duplicated them since #1686.
		Added for audit finding #20 on branch fix/program-enrol-member-row."""
		self._enrol()
		program = frappe.get_doc("LMS Program", self.program.name)
		program.append("program_members", {"member": self.student.name})

		with self.assertRaises(frappe.ValidationError):
			program.save()

	def test_enrolment_does_not_rewrite_the_other_member_rows(self):
		program = frappe.get_doc("LMS Program", self.program.name)
		program.append("program_members", {"member": "Administrator"})
		program.save()
		existing = program.program_members[0].name
		before = frappe.db.get_value("LMS Program Member", existing, "modified")

		self._enrol()

		self.assertEqual(frappe.db.get_value("LMS Program Member", existing, "modified"), before)
		self.assertEqual(frappe.db.get_value("LMS Program", self.program.name, "member_count"), 2)

	def test_enrolment_locks_the_program_before_reading_its_members(self):
		"""Two requests that both read "not a member" would both append, so the program
		row lock must come before the membership check."""
		real_get_value, real_exists = frappe.db.get_value, frappe.db.exists
		calls = []

		def get_value(doctype, *args, **kwargs):
			if doctype == "LMS Program" and kwargs.get("for_update"):
				calls.append("lock")
			return real_get_value(doctype, *args, **kwargs)

		def exists(doctype, *args, **kwargs):
			if doctype == "LMS Program Member":
				calls.append("check")
			return real_exists(doctype, *args, **kwargs)

		with patch.object(frappe.db, "get_value", get_value), patch.object(frappe.db, "exists", exists):
			self._enrol()

		self.assertEqual(calls[:2], ["lock", "check"])
