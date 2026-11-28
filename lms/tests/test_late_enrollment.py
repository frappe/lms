# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.api import verify_billing_access
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import build_batch_details, enroll_in_batch


class TestLateEnrollment(BaseTestUtils):
	"""Enrolment closes on the start date unless late enrolment keeps it open through
	the last enrolment date. Dates are the site's."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"late-ins-{suffix}@example.com", "In", "Structor", ["Course Creator"]
		)
		cls.course = cls._create_course(title=f"Late Course {suffix}", instructor=cls.instructor.name)
		cls.suffix = suffix

	def make_batch(self, start_offset, **fields):
		batch = frappe.new_doc("LMS Batch")
		batch.update(
			{
				"title": f"Late Batch {frappe.generate_hash(length=6)}",
				"start_date": add_days(nowdate(), start_offset),
				"end_date": add_days(nowdate(), 30),
				"start_time": "00:00:01",
				"end_time": "23:59:00",
				"timezone": "Asia/Kolkata",
				"description": "Late",
				"batch_details": "Late",
				"published": 1,
				"allow_self_enrollment": 1,
				"instructors": [{"instructor": self.instructor.name}],
				"courses": [{"course": self.course.name}],
				**fields,
			}
		)
		batch.insert()
		return batch

	def student(self):
		return self._create_user(
			f"late-stu-{frappe.generate_hash(length=6)}@example.com", "Stu", "Dent", ["LMS Student"]
		).name

	def as_student(self, fn, user=None):
		frappe.set_user(user or self.student())
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	def billing(self, batch):
		return self.as_student(lambda: verify_billing_access("LMS Batch", batch.name, "batch"))

	def enrolls(self, batch):
		self.as_student(lambda: enroll_in_batch(batch.name))

	def test_a_batch_yet_to_start_takes_learners(self):
		batch = self.make_batch(3)
		self.assertEqual(self.billing(batch), (True, ""))
		self.enrolls(batch)

	def test_a_started_batch_without_late_enrolment_is_closed(self):
		batch = self.make_batch(-2)
		self.assertEqual(self.billing(batch), (False, "Enrollment for this batch is closed."))
		with self.assertRaisesRegex(frappe.ValidationError, "closed"):
			self.enrolls(batch)
		self.assertFalse(build_batch_details(batch.name).accept_enrollments)

	def test_late_enrolment_stays_open_through_the_last_date(self):
		batch = self.make_batch(-2, allow_late_enrollment=1, last_enrollment_date=nowdate())
		self.assertEqual(self.billing(batch), (True, ""))
		self.enrolls(batch)
		details = build_batch_details(batch.name)
		self.assertTrue(details.accept_enrollments)
		self.assertEqual(str(details.enrollment_closes_on), nowdate())

	def test_late_enrolment_closes_after_the_last_date(self):
		batch = self.make_batch(-3, allow_late_enrollment=1, last_enrollment_date=add_days(nowdate(), -1))
		self.assertFalse(self.billing(batch)[0])
		with self.assertRaisesRegex(frappe.ValidationError, "closed"):
			self.enrolls(batch)

	def test_a_full_batch_stays_full_during_late_enrolment(self):
		batch = self.make_batch(-2, allow_late_enrollment=1, last_enrollment_date=nowdate(), seat_count=1)
		self.enrolls(batch)
		self.assertEqual(self.billing(batch), (False, "Batch is sold out."))

	def test_the_last_date_falls_within_the_batch(self):
		with self.assertRaisesRegex(frappe.ValidationError, "between the batch's start and end"):
			self.make_batch(-2, allow_late_enrollment=1, last_enrollment_date=add_days(nowdate(), 40))
		with self.assertRaisesRegex(frappe.ValidationError, "last enrolment date"):
			self.make_batch(-2, allow_late_enrollment=1)

	def test_staff_still_enroll_learners_after_the_window(self):
		batch = self.make_batch(-2)
		enrollment = frappe.get_doc(
			{"doctype": "LMS Batch Enrollment", "batch": batch.name, "member": self.student()}
		)
		enrollment.insert()
