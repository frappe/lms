# Copyright (c) 2022, Frappe and Contributors
# See license.txt

import frappe
from frappe.utils import add_days, getdate

from lms.lms.test_helpers import BaseTestUtils, MemberOwnershipTestMixin


class TestLMSCertificateRequest(MemberOwnershipTestMixin, BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.student_a = cls._create_user("rtv.cr.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		cls.student_b = cls._create_user("rtv.cr.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		cls.moderator = cls._create_user("rtv.cr.moderator@example.com", "Mod", "Erator", ["Moderator"])
		cls.evaluator_user = cls._create_user(
			"rtv.cr.evaluator@example.com", "Eval", "Uator", ["Batch Evaluator"]
		)
		cls._create_evaluator("rtv.cr.evaluator@example.com")
		# _create_course() defaults instructor="frappe@example.com"; create it so the
		# course's instructor Link resolves on a fresh DB (mirrors TestLMSCourse.setUp).
		cls.instructor = cls._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		cls.course = cls._create_course()

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

	def _new_doc(self, member=None, variant=0):
		return self._new_request(member=member, day_offset=variant)
