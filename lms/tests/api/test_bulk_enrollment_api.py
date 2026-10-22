# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import json

import frappe

from lms.lms.api import add_students_to_batch
from lms.lms.test_helpers import BaseTestUtils


class TestBatchBulkEnrollment(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = frappe.generate_hash(length=6).lower()
		cls.instructor = cls._create_user(
			f"bulk-ins-{cls.hash}@example.com", "Bulk", "Instructor", ["Course Creator"]
		).name
		cls.evaluator = cls._create_user(
			f"bulk-eval-{cls.hash}@example.com", "Bulk", "Evaluator", ["Batch Evaluator"]
		).name
		cls.moderator = cls._create_user(
			f"bulk-mod-{cls.hash}@example.com", "Bulk", "Moderator", ["Moderator"]
		).name
		cls.students = [
			cls._create_user(
				f"bulk-stu{i}-{cls.hash}@example.com", "Bulk", f"Student{i}", ["LMS Student"]
			).name
			for i in range(3)
		]
		cls._create_evaluator(cls.instructor)
		cls.course = cls._create_course(f"Bulk Course {cls.hash}", instructor=cls.instructor)
		cls.batch = cls._create_batch(
			cls.course.name,
			instructor=cls.instructor,
			title=f"Bulk Batch {cls.hash}",
			evaluator=cls.instructor,
		).name
		frappe.db.set_value("LMS Batch", cls.batch, {"paid_batch": 1, "amount": 500, "currency": "INR"})
		cls.source = cls._create_source()

	@classmethod
	def _create_source(cls):
		return frappe.get_doc({"doctype": "LMS Source", "source": f"Bulk Source {cls.hash}"}).insert().name

	def _as(self, user):
		frappe.set_user(user)
		self.addCleanup(frappe.set_user, "Administrator")

	def _details(self):
		return {"amount": 500, "currency": "INR", "source": self.source}

	def _payment_count(self, member):
		return frappe.db.count("LMS Payment", {"member": member})

	def _make_payment(self, member, received=1, document=None):
		payment = frappe.get_doc(
			{
				"doctype": "LMS Payment",
				"member": member,
				"billing_name": member,
				"amount": 500,
				"currency": "INR",
				"source": self.source,
				"payment_for_document_type": "LMS Batch",
				"payment_for_document": document or self.batch,
				"payment_received": received,
			}
		).insert()
		return payment.name

	def _enrolled(self, member):
		return frappe.db.exists("LMS Batch Enrollment", {"batch": self.batch, "member": member})

	def test_plain_members_still_enroll_as_before(self):
		free = self._create_batch(
			self.course.name, instructor=self.instructor, title=f"Bulk Free Batch {self.hash}"
		).name
		self._as(self.instructor)
		result = add_students_to_batch(free, json.dumps(self.students[:2]))
		self.assertEqual(result, {"added": self.students[:2], "errors": []})

	def test_each_student_gets_a_received_payment_and_an_enrollment(self):
		self._as(self.instructor)
		result = add_students_to_batch(
			self.batch, json.dumps(self.students[:2]), payment_details=json.dumps(self._details())
		)
		self.assertEqual(result["added"], self.students[:2])
		for s in self.students[:2]:
			row = frappe.db.get_value("LMS Batch Enrollment", {"batch": self.batch, "member": s}, "payment")
			pay = frappe.db.get_value(
				"LMS Payment",
				row,
				[
					"member",
					"amount",
					"currency",
					"source",
					"payment_received",
					"payment_for_document_type",
					"payment_for_document",
					"payment_for_certificate",
					"billing_name",
					"address",
				],
				as_dict=True,
			)
			self.assertEqual(
				(
					pay.member,
					pay.amount,
					pay.currency,
					pay.payment_received,
					pay.payment_for_document_type,
					pay.payment_for_document,
					pay.payment_for_certificate,
					pay.address,
				),
				(s, 500, "INR", 1, "LMS Batch", self.batch, 0, None),
			)
			self.assertEqual(pay.source, self.source)
			self.assertEqual(pay.billing_name, frappe.db.get_value("User", s, "full_name"))

	def test_a_linked_payment_is_attached_and_not_duplicated(self):
		student = self.students[0]
		payment = self._make_payment(student)
		self._as(self.instructor)
		result = add_students_to_batch(
			self.batch, json.dumps([student]), linked_payments=json.dumps({student: payment})
		)
		self.assertEqual(result["added"], [student])
		self.assertEqual(
			frappe.db.get_value("LMS Batch Enrollment", {"batch": self.batch, "member": student}, "payment"),
			payment,
		)
		self.assertEqual(self._payment_count(student), 1)

	def test_a_differently_cased_email_still_matches_its_linked_payment(self):
		student = self.students[0]
		payment = self._make_payment(student)
		cased = student.upper()
		self._as(self.instructor)
		result = add_students_to_batch(
			self.batch, json.dumps([cased]), linked_payments=json.dumps({cased: payment})
		)
		self.assertEqual(result["added"], [cased])
		self.assertEqual(
			frappe.db.get_value("LMS Batch Enrollment", {"batch": self.batch, "member": student}, "payment"),
			payment,
		)

	def test_a_bad_linked_payment_skips_only_that_student(self):
		first, second = self.students[:2]
		other_payment = self._make_payment(second)
		before = self._payment_count(first)
		self._as(self.instructor)
		result = add_students_to_batch(
			self.batch,
			json.dumps([first, second]),
			payment_details=json.dumps(self._details()),
			linked_payments=json.dumps({first: other_payment}),
		)
		self.assertEqual(result["added"], [second])
		self.assertEqual(result["errors"][0]["member"], first)
		self.assertEqual(self._payment_count(first), before)
		self.assertFalse(self._enrolled(first))

	def test_an_unreceived_or_already_used_payment_cannot_be_linked(self):
		student = self.students[0]
		unreceived = self._make_payment(student, received=0)
		used = self._make_payment(student)
		other_batch = self._create_batch(
			self.course.name, instructor=self.instructor, title=f"Bulk Used Batch {self.hash}"
		).name
		frappe.get_doc(
			{"doctype": "LMS Batch Enrollment", "batch": other_batch, "member": student, "payment": used}
		).insert()
		wrong_document = self._make_payment(student, document=other_batch)
		self._as(self.instructor)
		for label, payment in (
			("unreceived", unreceived),
			("used", used),
			("wrong document", wrong_document),
		):
			with self.subTest(label):
				result = add_students_to_batch(
					self.batch, json.dumps([student]), linked_payments=json.dumps({student: payment})
				)
				self.assertEqual(result["added"], [])
				self.assertEqual(result["errors"][0]["member"], student)
				self.assertFalse(self._enrolled(student))

	def test_a_failed_enrollment_leaves_no_payment_behind(self):
		student = self.students[0]
		self._create_batch_enrollment(student, self.batch)
		before = self._payment_count(student)
		self._as(self.instructor)
		result = add_students_to_batch(
			self.batch, json.dumps([student]), payment_details=json.dumps(self._details())
		)
		self.assertEqual(result["added"], [])
		self.assertEqual(result["errors"][0]["member"], student)
		self.assertEqual(self._payment_count(student), before)

	def test_payment_arguments_are_refused_on_a_free_batch(self):
		free = self._create_batch(
			self.course.name, instructor=self.instructor, title=f"Bulk Free Batch {self.hash}"
		).name
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			add_students_to_batch(
				free, json.dumps(self.students[:1]), payment_details=json.dumps(self._details())
			)

	def test_an_unauthorised_caller_gets_permission_error_on_a_free_batch(self):
		free = self._create_batch(
			self.course.name, instructor=self.instructor, title=f"Bulk Free Batch {self.hash}"
		).name
		self._as(self.students[2])
		with self.assertRaises(frappe.PermissionError):
			add_students_to_batch(
				free, json.dumps(self.students[:1]), payment_details=json.dumps(self._details())
			)

	def test_the_permission_check_runs_before_payment_validation(self):
		self._as(self.students[2])
		with self.assertRaises(frappe.PermissionError):
			add_students_to_batch(self.batch, json.dumps(self.students[:1]), payment_details={"amount": "x"})

	def test_who_may_record_payments(self):
		for user in ("Guest", self.students[2], self.evaluator):
			with self.subTest(user):
				self._as(user)
				with self.assertRaises(frappe.PermissionError):
					add_students_to_batch(
						self.batch, json.dumps(self.students[:1]), payment_details=json.dumps(self._details())
					)
		for user, student in ((self.instructor, self.students[0]), (self.moderator, self.students[1])):
			with self.subTest(user):
				self._as(user)
				result = add_students_to_batch(
					self.batch, json.dumps([student]), payment_details=json.dumps(self._details())
				)
				self.assertEqual(result["added"], [student])

	def test_malformed_payment_details_are_rejected(self):
		good = self._details()
		bad = [
			{**good, "amount": -1},
			{**good, "amount": True},
			{**good, "currency": "XXX"},
			{**good, "source": "nope"},
			{**good, "extra": 1},
		]
		self._as(self.instructor)
		for details in bad:
			with self.subTest(details):
				with self.assertRaises(frappe.ValidationError):
					add_students_to_batch.__wrapped__(
						self.batch, json.dumps(self.students[:1]), payment_details=details
					)
				self.assertFalse(self._enrolled(self.students[0]))

	def test_a_moderator_skip_is_reported_per_student_for_a_missing_user(self):
		missing = f"nobody-{self.hash}@example.com"
		self._as(self.moderator)
		result = add_students_to_batch(
			self.batch, json.dumps([missing]), payment_details=json.dumps(self._details())
		)
		self.assertEqual(result["added"], [])
		self.assertIn("No user found", result["errors"][0]["error"])

	def test_a_disabled_user_is_reported_as_disabled(self):
		student = self.students[2]
		frappe.db.set_value("User", student, "enabled", 0)
		self._as(self.moderator)
		result = add_students_to_batch(
			self.batch, json.dumps([student]), payment_details=json.dumps(self._details())
		)
		self.assertEqual(result["added"], [])
		self.assertIn("is disabled", result["errors"][0]["error"])
