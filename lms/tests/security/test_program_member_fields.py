# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A published program is readable by every learner, but who is in it is for
its staff: the member rows name people by their login email."""

import frappe
from frappe.client import get

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_program_details


class TestProgramMemberFields(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.learner = cls._create_user(f"pmf-learn-{hash}@example.com", "Le", "Arner", ["LMS Student"]).name
		cls.member = cls._create_user(f"pmf-member-{hash}@example.com", "Me", "Mber", ["LMS Student"]).name
		cls.moderator = cls._create_user(f"pmf-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.creator = cls._create_user(
			f"pmf-creator-{hash}@example.com", "Cr", "Eator", ["Course Creator"]
		).name
		cls.program = (
			frappe.get_doc(
				{
					"doctype": "LMS Program",
					"title": f"Program {hash}",
					"published": 1,
					"program_members": [{"member": cls.member}],
				}
			)
			.insert()
			.name
		)

	def _members_seen_by(self, user):
		frappe.set_user(user)
		return [
			(row.get("member"), row.get("full_name"))
			for row in get("LMS Program", self.program)["program_members"]
		]

	def test_a_learner_reads_the_program_without_its_members(self):
		self.assertEqual(self._members_seen_by(self.learner), [(None, None)])

	def test_the_single_doc_read_drops_them_too(self):
		frappe.set_user(self.learner)
		doc = frappe.get_doc("LMS Program", self.program)
		doc.apply_fieldlevel_read_permissions()
		self.assertIsNone(doc.program_members[0].get("member"))

	def test_staff_read_the_members(self):
		for user in (self.moderator, self.creator):
			with self.subTest(user=user):
				self.assertEqual(self._members_seen_by(user), [(self.member, "Me Mber")])

	def test_the_program_page_still_works_for_a_learner(self):
		frappe.set_user(self.learner)
		details = get_program_details(self.program)
		self.assertEqual(details["name"], self.program)
		self.assertNotIn("program_members", details)

	def test_the_program_page_tells_a_member_from_a_visitor(self):
		"""The page can't ask the generic API: filtering the member rows by `member`
		needs a read only the program's staff have."""
		for user, expected in ((self.member, True), (self.learner, False)):
			with self.subTest(user=user):
				frappe.set_user(user)
				self.assertIs(get_program_details(self.program)["is_member"], expected)

	def test_staff_still_add_a_member(self):
		frappe.set_user(self.moderator)
		program = frappe.get_doc("LMS Program", self.program)
		program.append("program_members", {"member": self.learner})
		program.save()
		self.assertIn(self.learner, [row.member for row in program.program_members])
