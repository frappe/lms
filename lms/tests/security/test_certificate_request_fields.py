# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.utils import add_days, getdate

from lms.lms.test_helpers import BaseTestUtils


class TestCertificateRequestFields(BaseTestUtils):
	"""A learner books a slot; the server decides who evaluates it, what the meeting
	link is and what state it is in. Only staff may set those themselves."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"crf-stud-{hash}@example.com", "Sam", "Stud", ["LMS Student"]).name
		cls.moderator = cls._create_user(f"crf-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.evaluator = cls._create_user(
			f"crf-eval-{hash}@example.com", "Eve", "Eval", ["Batch Evaluator"]
		).name
		cls.other_evaluator = cls._create_user(
			f"crf-other-{hash}@example.com", "Oona", "Eval", ["Batch Evaluator"]
		).name
		cls._create_evaluator(cls.evaluator)
		cls._create_evaluator(cls.other_evaluator)
		instructor = cls._create_user(
			f"crf-instr-{hash}@example.com", "Ivy", "Instr", ["Course Creator"]
		).name
		cls.course = cls._create_course(f"Certificate Fields {hash}", instructor=instructor).name
		frappe.db.set_value("LMS Course", cls.course, "evaluator", cls.evaluator)
		cls._create_enrollment(cls.student, cls.course)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _request(self, day_offset, **fields):
		doc = frappe.new_doc("LMS Certificate Request")
		doc.update(
			{
				"course": self.course,
				# Before the evaluators' unavailable window (today + 5..12). A distinct
				# day per test keeps validate_slot out of the way.
				"date": add_days(getdate(), day_offset),
				"start_time": "10:00:00",
				"end_time": "10:30:00",
				**fields,
			}
		)
		return doc

	def test_a_learner_gets_the_courses_evaluator(self):
		frappe.set_user(self.student)
		doc = self._request(1).insert()
		self.assertEqual(doc.evaluator, self.evaluator)
		self.assertEqual(doc.evaluator_name, "Eve Eval")
		self.assertEqual(doc.status, "Upcoming")
		self.assertFalse(doc.google_meet_link)

	def test_a_learner_cannot_pick_the_evaluator(self):
		frappe.set_user(self.student)
		with self.assertRaises(frappe.PermissionError):
			self._request(2, evaluator=self.other_evaluator).insert()
		# Naming the assigned one is harmless.
		doc = self._request(2, evaluator=self.evaluator).insert()
		self.assertEqual(doc.evaluator, self.evaluator)

	def test_a_learners_link_and_status_are_dropped(self):
		frappe.set_user(self.student)
		doc = self._request(
			3, google_meet_link="https://example.com/not-the-meeting", status="Completed"
		).insert()
		self.assertFalse(doc.google_meet_link)
		self.assertEqual(doc.status, "Upcoming")
		self.assertEqual(frappe.db.get_value("LMS Certificate Request", doc.name, "status"), "Upcoming")

	def test_a_learner_cannot_change_them_on_a_saved_request(self):
		frappe.set_user(self.student)
		doc = self._request(4).insert()
		frappe.db.set_value(
			"LMS Certificate Request", doc.name, "google_meet_link", "https://meet.example.com/real"
		)
		doc.reload()
		doc.google_meet_link = "https://example.com/planted"
		doc.status = "Completed"
		doc.save(ignore_permissions=True)
		self.assertEqual(doc.google_meet_link, "https://meet.example.com/real")
		self.assertEqual(doc.status, "Upcoming")

	def test_a_learner_keeps_the_evaluator_a_saved_request_was_given(self):
		"""Staff may book a learner with another evaluator, and the course's default
		may change later; neither may block the learner's own save."""
		frappe.set_user(self.moderator)
		doc = self._request(
			3, start_time="12:00:00", end_time="12:30:00", member=self.student, evaluator=self.other_evaluator
		).insert()
		frappe.set_user(self.student)
		doc.reload()
		doc.date = add_days(getdate(), 4)
		doc.save(ignore_permissions=True)
		self.assertEqual(doc.evaluator, self.other_evaluator)

		frappe.db.set_value("LMS Course", self.course, "evaluator", self.other_evaluator)
		self.addCleanup(frappe.db.set_value, "LMS Course", self.course, "evaluator", self.evaluator)
		doc.reload()
		doc.date = add_days(getdate(), 3)
		doc.save(ignore_permissions=True)
		self.assertEqual(doc.evaluator, self.other_evaluator)
		# Changing it is still refused.
		doc.evaluator = self.evaluator
		with self.assertRaises(frappe.PermissionError):
			doc.save(ignore_permissions=True)

	def test_staff_still_set_them(self):
		frappe.set_user(self.moderator)
		doc = self._request(
			4,
			start_time="11:00:00",
			end_time="11:30:00",
			member=self.student,
			evaluator=self.other_evaluator,
			google_meet_link="https://meet.example.com/staff",
			status="Completed",
		).insert()
		self.assertEqual(doc.evaluator, self.other_evaluator)
		self.assertEqual(doc.evaluator_name, "Oona Eval")
		self.assertEqual(doc.google_meet_link, "https://meet.example.com/staff")
		self.assertEqual(doc.status, "Completed")
