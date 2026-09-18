# Copyright (c) 2021, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils, MemberOwnershipTestMixin


class TestLMSAssignmentSubmission(MemberOwnershipTestMixin, BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.student_a = cls._create_user("rtv.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		cls.student_b = cls._create_user("rtv.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		cls.moderator = cls._create_user("rtv.moderator@example.com", "Mod", "Erator", ["Moderator"])
		cls.assignment = cls._create_assignment()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _new_submission(self, member=None, answer="submission answer"):
		doc = frappe.new_doc("LMS Assignment Submission")
		doc.assignment = self.assignment.name
		if member is not None:
			doc.member = member
		doc.answer = answer
		return doc

	def _new_doc(self, member=None, variant=0):
		return self._new_submission(member=member)

	def test_student_cannot_reassign_member_on_update(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		doc.member = self.student_b.name
		with self.assertRaises(frappe.PermissionError):
			doc.save()

	def test_privileged_user_can_reassign_member_on_update(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		doc.member = self.student_b.name
		doc.save()
		self.assertEqual(doc.member, self.student_b.name)
