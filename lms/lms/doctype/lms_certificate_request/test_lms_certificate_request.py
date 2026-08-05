# Copyright (c) 2022, Frappe and Contributors
# See license.txt

import frappe
from frappe.utils import add_days, getdate

from lms.lms.test_helpers import BaseTestUtils


class TestLMSCertificateRequest(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.student_a = self._create_user(
			"rtv.cr.student.a@example.com", "Student", "Alpha", ["LMS Student"]
		)
		self.student_b = self._create_user(
			"rtv.cr.student.b@example.com", "Student", "Bravo", ["LMS Student"]
		)
		self.moderator = self._create_user("rtv.cr.moderator@example.com", "Mod", "Erator", ["Moderator"])
		self.evaluator_user = self._create_user(
			"rtv.cr.evaluator@example.com", "Eval", "Uator", ["Batch Evaluator"]
		)
		self._create_evaluator("rtv.cr.evaluator@example.com")
		# _create_course() defaults instructor="frappe@example.com"; create it so the
		# course's instructor Link resolves on a fresh DB (mirrors TestLMSCourse.setUp).
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self.course = self._create_course()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _new_request(self, member=None, day_offset=3):
		doc = frappe.new_doc("LMS Certificate Request")
		doc.course = self.course.name
		doc.evaluator = self.evaluator_user.name
		# A future date, before the evaluator's unavailable window (nowdate + 5..12).
		# Each test uses a distinct offset so `validate_slot` never couples them.
		doc.date = add_days(getdate(), day_offset)
		doc.start_time = "10:00:00"
		doc.end_time = "10:30:00"
		if member is not None:
			doc.member = member
		return doc

	def test_student_cannot_book_for_another_member(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_request(member=self.student_b.name, day_offset=1)
		with self.assertRaises(frappe.PermissionError):
			doc.insert()

	def test_student_member_defaults_to_session_user(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_request(member=None, day_offset=2)
		doc.insert()
		self.cleanup_items.append(("LMS Certificate Request", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_student_can_book_for_self(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_request(member=self.student_a.name, day_offset=3)
		doc.insert()
		self.cleanup_items.append(("LMS Certificate Request", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_privileged_user_can_book_on_behalf_of_member(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_request(member=self.student_b.name, day_offset=4)
		doc.insert()
		self.cleanup_items.append(("LMS Certificate Request", doc.name))
		self.assertEqual(doc.member, self.student_b.name)
