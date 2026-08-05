# Copyright (c) 2021, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSAssignmentSubmission(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.student_a = self._create_user("rtv.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		self.student_b = self._create_user("rtv.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		self.moderator = self._create_user("rtv.moderator@example.com", "Mod", "Erator", ["Moderator"])
		self.assignment = self._create_assignment()

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

	def test_student_cannot_submit_for_another_member(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_b.name)
		with self.assertRaises(frappe.PermissionError):
			doc.insert()

	def test_student_member_defaults_to_session_user(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=None)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_student_can_submit_for_self(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_privileged_user_can_submit_on_behalf_of_member(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_submission(member=self.student_b.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_b.name)

	def test_student_cannot_reassign_member_on_update(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		doc.member = self.student_b.name
		with self.assertRaises(frappe.PermissionError):
			doc.save()

	def test_privileged_user_can_reassign_member_on_update(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		doc.member = self.student_b.name
		doc.save()
		self.assertEqual(doc.member, self.student_b.name)
