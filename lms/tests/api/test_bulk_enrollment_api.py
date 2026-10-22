# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import json
from unittest.mock import patch

import frappe

from lms.lms.api import (
	add_students_to_batch,
	enroll_students_in_course,
	get_bulk_enrollment_preview,
	search_users_to_enroll,
)
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

	# Regression from the bulk-enroll PR (feat/bulk-enroll): the paid batch path skipped
	# the fifty-student cap, so one call could write a payment row per member unbounded.
	def test_more_than_fifty_students_with_payments_are_refused(self):
		emails = [f"bulk-many{i}-{self.hash}@example.com" for i in range(51)]
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			add_students_to_batch(self.batch, json.dumps(emails), payment_details=json.dumps(self._details()))
		self.assertEqual(frappe.db.count("LMS Payment", {"member": ["in", emails]}), 0)

	def test_a_plain_list_of_more_than_fifty_is_not_capped(self):
		free = self._create_batch(
			self.course.name, instructor=self.instructor, title=f"Bulk Uncapped Batch {self.hash}"
		).name
		emails = [f"bulk-many{i}-{self.hash}@example.com" for i in range(51)]
		self._as(self.instructor)
		result = add_students_to_batch(free, json.dumps(emails))
		self.assertEqual(len(result["errors"]), 51)

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

	def _address(self, **extra):
		return {"address_line1": "1 Main St", "city": "Pune", "country": "India", **extra}

	def _enroll_with(self, members, details=None, per_member=None):
		self._as(self.instructor)
		return add_students_to_batch(
			self.batch,
			json.dumps(members),
			payment_details=json.dumps(details or self._details()),
			member_payment_details=None if per_member is None else json.dumps(per_member),
		)

	def _payment_of(self, member):
		name = frappe.db.get_value("LMS Batch Enrollment", {"batch": self.batch, "member": member}, "payment")
		return frappe.get_doc("LMS Payment", name)

	def test_a_per_student_value_beats_the_common_value_beats_the_default(self):
		a, b = self.students[:2]
		result = self._enroll_with(
			[a, b],
			per_member={a: {"amount": 250, "billing_name": "Alice Pay", "source": self.source}},
		)
		self.assertEqual(result["errors"], [])
		first, second = self._payment_of(a), self._payment_of(b)
		self.assertEqual((first.amount, first.billing_name), (250, "Alice Pay"))
		self.assertEqual(
			(second.amount, second.billing_name), (500, frappe.db.get_value("User", b, "full_name"))
		)

	def test_a_differently_cased_member_key_still_matches(self):
		a = self.students[0]
		self._enroll_with([a], per_member={a.upper(): {"amount": 125}})
		self.assertEqual(self._payment_of(a).amount, 125)

	def test_a_common_address_is_created_for_every_student(self):
		a, b = self.students[:2]
		details = {**self._details(), "address": self._address(pincode="411001")}
		self._enroll_with([a, b], details=details)
		names = set()
		for s in (a, b):
			pay = self._payment_of(s)
			self.assertTrue(pay.address)
			names.add(pay.address)
			addr = frappe.get_doc("Address", pay.address)
			self.assertEqual(
				(addr.address_type, addr.email_id, addr.address_title, addr.address_line1, addr.city),
				("Billing", s, pay.billing_name, "1 Main St", "Pune"),
			)
			self.assertEqual(addr.country, "India")
			self.assertEqual([(d.link_doctype, d.link_name) for d in addr.links], [("User", s)])
		self.assertEqual(len(names), 2)

	def test_a_member_address_replaces_the_common_one_entirely(self):
		a, b = self.students[:2]
		common = self._address(address_line2="Andheri", state="MH", pincode="400053", phone="+91 1")
		own = {"address_line1": "10 Downing St", "city": "London", "country": "United Kingdom"}
		self._enroll_with(
			[a, b], details={**self._details(), "address": common}, per_member={a: {"address": own}}
		)
		addr = frappe.get_doc("Address", self._payment_of(a).address)
		self.assertEqual(
			(addr.address_line1, addr.city, addr.country), ("10 Downing St", "London", "United Kingdom")
		)
		self.assertEqual(
			[addr.get(k) for k in ("address_line2", "state", "pincode", "phone")], [None, None, None, None]
		)
		self.assertEqual(frappe.db.get_value("Address", self._payment_of(b).address, "pincode"), "400053")

	def test_an_empty_member_address_opts_that_student_out_of_the_common_one(self):
		a, b = self.students[:2]
		details = {**self._details(), "address": self._address()}
		self._enroll_with([a, b], details=details, per_member={a: {"address": {"city": " "}}})
		self.assertFalse(self._payment_of(a).address)
		self.assertTrue(self._payment_of(b).address)

	def test_a_member_address_alone_makes_an_address_only_for_that_student(self):
		a, b = self.students[:2]
		self._enroll_with([a, b], per_member={a: {"address": self._address()}})
		self.assertTrue(self._payment_of(a).address)
		self.assertFalse(self._payment_of(b).address)

	# Regression from the bulk-enroll PR (feat/bulk-enroll): a partial address was saved
	# as is, leaving Billing addresses with no line 1, city or country.
	def test_a_partial_address_is_refused_naming_its_missing_fields_before_any_write(self):
		a, b = self.students[:2]
		before = frappe.db.count("Address")
		self._as(self.instructor)
		for kwargs, message in (
			(
				{"payment_details": {**self._details(), "address": {"city": "Pune"}}},
				"The common address is missing Address Line 1, Country",
			),
			(
				{
					"payment_details": self._details(),
					"member_payment_details": {
						a: {"address": self._address(city=" ")},
						b: {"address": self._address()},
					},
				},
				f"The address for {a} is missing City",
			),
		):
			with self.subTest(message):
				with self.assertRaisesRegex(frappe.ValidationError, message):
					add_students_to_batch.__wrapped__(self.batch, json.dumps([a, b]), **kwargs)
				self.assertEqual(self._payment_count(a) + self._payment_count(b), 0)
				self.assertEqual(frappe.db.count("Address"), before)

	def _saved_address(self, owner, title):
		self._as(owner)
		doc = frappe.get_doc(
			{
				"doctype": "Address",
				"address_title": f"{title} {self.hash}",
				"address_type": "Billing",
				**self._address(),
			}
		).insert()
		frappe.set_user("Administrator")
		return doc.name

	def test_a_common_address_name_links_that_address_for_every_student(self):
		a, b = self.students[:2]
		saved = self._saved_address(self.instructor, "Common")
		before = frappe.db.count("Address")
		self._enroll_with([a, b], details={**self._details(), "address": saved})
		self.assertEqual((self._payment_of(a).address, self._payment_of(b).address), (saved, saved))
		self.assertEqual(frappe.db.count("Address"), before)

	def test_a_member_address_name_links_that_address_for_that_student(self):
		a, b = self.students[:2]
		saved = self._saved_address(self.instructor, "Own")
		self._enroll_with(
			[a, b],
			details={**self._details(), "address": self._address()},
			per_member={a: {"address": saved}},
		)
		self.assertEqual(self._payment_of(a).address, saved)
		self.assertNotIn(self._payment_of(b).address, (None, saved))

	def test_an_unknown_or_unreadable_address_name_is_refused(self):
		a = self.students[0]
		unreadable = self._saved_address("Administrator", "Admin")
		self._as(self.instructor)
		for name in (f"missing-{self.hash}", unreadable, " "):
			for kwargs in (
				{"payment_details": {**self._details(), "address": name}},
				{"payment_details": self._details(), "member_payment_details": {a: {"address": name}}},
			):
				with self.subTest(name=name, kwargs=kwargs):
					with self.assertRaisesRegex(frappe.ValidationError, "does not exist"):
						add_students_to_batch.__wrapped__(self.batch, json.dumps([a]), **kwargs)
					self.assertEqual(self._payment_count(a), 0)

	def test_a_bad_member_value_fails_the_whole_call_before_any_write(self):
		a, b = self.students[:2]
		before = frappe.db.count("Address")
		self._as(self.instructor)
		bad = [
			({a: {"address": self._address(country="Atlantis")}}, "Atlantis does not exist"),
			({a: {"currency": "XXX"}}, "XXX does not exist"),
			({a: {"source": "nope"}}, "nope does not exist"),
		]
		for per_member, message in bad:
			with self.subTest(per_member):
				with self.assertRaisesRegex(frappe.ValidationError, message):
					add_students_to_batch.__wrapped__(
						self.batch,
						json.dumps([a, b]),
						payment_details=self._details(),
						member_payment_details={**per_member, b: {"address": self._address()}},
					)
				self.assertFalse(self._enrolled(b))
				self.assertEqual(self._payment_count(b), 0)
				self.assertEqual(frappe.db.count("Address"), before)

	def test_a_bad_common_address_fails_once_for_the_whole_call(self):
		a, b = self.students[:2]
		self._as(self.instructor)
		for address, message in (
			(f"missing-{self.hash}", "does not exist"),
			(self._address(country="Atlantis"), "Atlantis does not exist"),
		):
			with self.subTest(address):
				with self.assertRaisesRegex(frappe.ValidationError, message):
					add_students_to_batch.__wrapped__(
						self.batch,
						json.dumps([a, b]),
						payment_details={**self._details(), "address": address},
					)
				self.assertEqual(self._payment_count(a) + self._payment_count(b), 0)

	def test_an_override_for_a_member_with_a_linked_payment_is_refused(self):
		a = self.students[0]
		payment = self._make_payment(a)
		self._as(self.instructor)
		with self.assertRaisesRegex(frappe.ValidationError, "linked payment"):
			add_students_to_batch.__wrapped__(
				self.batch,
				json.dumps([a]),
				payment_details=self._details(),
				linked_payments={a: payment},
				member_payment_details={a.upper(): {"amount": 1}},
			)
		self.assertFalse(self._enrolled(a))

	def test_member_keys_that_differ_only_by_case_are_refused(self):
		a = self.students[0]
		self._as(self.instructor)
		with self.assertRaisesRegex(frappe.ValidationError, "more than once"):
			add_students_to_batch.__wrapped__(
				self.batch,
				json.dumps([a]),
				payment_details=self._details(),
				member_payment_details={a: {"amount": 1}, a.upper(): {"amount": 2}},
			)
		self.assertFalse(self._enrolled(a))

	def test_error_messages_name_fields_with_their_labels(self):
		a = self.students[0]
		self._as(self.instructor)
		for per_member, message in (
			({a: {"billing_name": ""}}, "Billing Name for .* cannot be empty"),
			({a: {"source": 5}}, "Source for .* must be text"),
		):
			with self.subTest(per_member):
				with self.assertRaisesRegex(frappe.ValidationError, message):
					add_students_to_batch.__wrapped__(
						self.batch,
						json.dumps([a]),
						payment_details=self._details(),
						member_payment_details=per_member,
					)

	def test_malformed_member_payment_details_fail_the_whole_call(self):
		a, b = self.students[:2]
		bad = [
			{a: {"extra": 1}},
			{a: {"amount": -1}},
			{a: {"amount": True}},
			{a: {"amount": float("inf")}},
			{a: {"billing_name": 5}},
			{a: {"billing_name": ""}},
			{a: {"address": {"nope": "x"}}},
			{a: {"address": {"city": 5}}},
			{a: {"address": "Pune"}},
			{a: {"address": ["x"]}},
			{a: {"address": 5}},
			{a: "x"},
			{f"stranger-{self.hash}@example.com": {"amount": 1}},
			[],
			"[]",
			"not json",
			5,
		]
		self._as(self.instructor)
		for per_member in bad:
			with self.subTest(per_member):
				with self.assertRaises(frappe.ValidationError):
					add_students_to_batch.__wrapped__(
						self.batch,
						json.dumps([a, b]),
						payment_details=self._details(),
						member_payment_details=per_member,
					)
				self.assertFalse(self._enrolled(a))
				self.assertEqual(self._payment_count(a), 0)

	def test_malformed_common_address_fails_the_whole_call(self):
		a = self.students[0]
		self._as(self.instructor)
		for address in ({"nope": "x"}, {"city": 5}, "Pune", ["x"], 5, None):
			with self.subTest(address):
				with self.assertRaises(frappe.ValidationError):
					add_students_to_batch.__wrapped__(
						self.batch,
						json.dumps([a]),
						payment_details={**self._details(), "address": address},
					)
				self.assertEqual(self._payment_count(a), 0)

	def test_member_payment_details_need_common_payment_details(self):
		a = self.students[0]
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			add_students_to_batch.__wrapped__(
				self.batch, json.dumps([a]), member_payment_details={a: {"amount": 1}}
			)

	def test_a_failed_enrollment_leaves_no_address_behind(self):
		a = self.students[0]
		self._enroll_with([a])
		before = frappe.db.count("Address")
		result = self._enroll_with([a], per_member={a: {"address": self._address()}})
		self.assertEqual(result["added"], [])
		self.assertEqual(frappe.db.count("Address"), before)

	def test_source_is_optional_in_common_details(self):
		a, b, c = self.students[:3]
		for member, details in (
			(a, {"amount": 500, "currency": "INR"}),
			(b, {"amount": 500, "currency": "INR", "source": None}),
			(c, {"amount": 500, "currency": "INR", "source": ""}),
		):
			with self.subTest(details):
				result = self._enroll_with([member], details)
				self.assertEqual(result["errors"], [])
				pay = self._payment_of(member)
				self.assertFalse(pay.source)
				required = [f.fieldname for f in pay.meta.fields if f.reqd and f.fieldname != "source"]
				self.assertEqual([f for f in required if not pay.get(f)], [])
				self.assertEqual(pay.payment_received, 1)

	def test_a_member_source_may_be_null_or_empty(self):
		a, b = self.students[:2]
		details = {"amount": 500, "currency": "INR"}
		self._enroll_with([a, b], details, {a: {"source": None}, b: {"source": ""}})
		self.assertFalse(self._payment_of(a).source)
		self.assertFalse(self._payment_of(b).source)

	def test_a_member_source_beats_a_missing_common_source(self):
		a = self.students[0]
		self._enroll_with([a], {"amount": 500, "currency": "INR"}, {a: {"source": self.source}})
		self.assertEqual(self._payment_of(a).source, self.source)

	# Regression from the bulk-enroll PR (feat/bulk-enroll): dropping reqd on Source let
	# any insert skip it. Only staff recording on a student's behalf may.
	def test_a_direct_payment_without_source_is_still_refused(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "LMS Payment",
					"member": self.students[0],
					"billing_name": "x",
					"amount": 1,
					"currency": "INR",
					"payment_for_document_type": "LMS Batch",
					"payment_for_document": self.batch,
				}
			).insert()

	# Regression from the bulk-enroll PR (feat/bulk-enroll): the staff flag must waive
	# Source alone, not every mandatory field the way ignore_mandatory would.
	def test_the_staff_flag_waives_only_the_source(self):
		values = {
			"doctype": "LMS Payment",
			"member": self.students[0],
			"billing_name": "x",
			"amount": 1,
			"currency": "INR",
			"payment_for_document_type": "LMS Batch",
			"payment_for_document": self.batch,
		}
		for missing in ("member", "billing_name", "amount", "payment_for_document"):
			with self.subTest(missing), self.assertRaises(frappe.MandatoryError):
				payment = frappe.get_doc({**values, missing: None})
				payment.flags.recorded_by_staff = True
				payment.insert()
		payment = frappe.get_doc(values)
		payment.flags.recorded_by_staff = True
		self.assertFalse(payment.insert().source)

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


class TestCourseBulkEnrollment(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = frappe.generate_hash(length=6).lower()
		cls.instructor = cls._create_user(
			f"cbulk-ins-{cls.hash}@example.com", "Bulk", "Instructor", ["Course Creator"]
		).name
		cls.other_creator = cls._create_user(
			f"cbulk-oth-{cls.hash}@example.com", "Bulk", "Other", ["Course Creator"]
		).name
		cls.moderator = cls._create_user(
			f"cbulk-mod-{cls.hash}@example.com", "Bulk", "Moderator", ["Moderator"]
		).name
		cls.students = [
			cls._create_user(
				f"cbulk-stu{i}-{cls.hash}@example.com", "Bulk", f"Student{i}", ["LMS Student"]
			).name
			for i in range(4)
		]
		cls.free_course = cls._create_course(f"Bulk Free Course {cls.hash}", instructor=cls.instructor).name
		frappe.db.set_value(
			"LMS Course",
			cls.free_course,
			{"published": 1, "paid_certificate": 1, "course_price": 999, "currency": "INR"},
		)
		cls.cert_course = cls.free_course
		cls.paid_course = cls._create_course(f"Bulk Paid Course {cls.hash}", instructor=cls.instructor).name
		frappe.db.set_value(
			"LMS Course",
			cls.paid_course,
			{"published": 1, "paid_course": 1, "course_price": 4999, "currency": "INR"},
		)
		cls.source = TestBatchBulkEnrollment._create_source.__func__(cls)

	def _as(self, user):
		frappe.set_user(user)
		self.addCleanup(frappe.set_user, "Administrator")

	def _details(self, amount):
		return {"amount": amount, "currency": "INR", "source": self.source}

	def _enrollment(self, course, member):
		return frappe.db.get_value(
			"LMS Enrollment",
			{"course": course, "member": member},
			["name", "purchased_certificate", "payment"],
			as_dict=True,
		)

	def _counter(self, course):
		return frappe.db.get_value("LMS Course", course, "enrollments")

	def test_an_instructor_enrolls_several_students_in_a_free_course(self):
		course = self._create_course(f"Bulk Plain Course {self.hash}", instructor=self.instructor).name
		frappe.db.set_value("LMS Course", course, "published", 1)
		before = self._counter(course) or 0
		self._as(self.instructor)
		result = enroll_students_in_course(course, json.dumps(self.students[:3]))
		self.assertEqual(result, {"added": self.students[:3], "upgraded": [], "errors": []})
		for s in self.students[:3]:
			self.assertTrue(self._enrollment(course, s))
		self.assertEqual(self._counter(course), before + 3)

	def test_each_paid_course_student_gets_a_received_payment(self):
		self._as(self.instructor)
		result = enroll_students_in_course(
			self.paid_course, json.dumps(self.students[:2]), payment_details=json.dumps(self._details(4999))
		)
		self.assertEqual(result["added"], self.students[:2])
		for s in self.students[:2]:
			row = self._enrollment(self.paid_course, s)
			pay = frappe.db.get_value(
				"LMS Payment",
				row.payment,
				["member", "payment_received", "payment_for_document", "payment_for_certificate"],
				as_dict=True,
			)
			self.assertEqual(
				(pay.member, pay.payment_received, pay.payment_for_document, pay.payment_for_certificate),
				(s, 1, self.paid_course, 0),
			)

	def test_course_payments_take_per_student_values_and_addresses(self):
		a, b = self.students[:2]
		self._as(self.instructor)
		result = enroll_students_in_course(
			self.paid_course,
			json.dumps([a, b]),
			payment_details=json.dumps(self._details(4999)),
			member_payment_details=json.dumps(
				{
					a: {
						"amount": 100,
						"billing_name": "Alice Pay",
						"address": {"address_line1": "1 Main St", "city": "Pune", "country": "India"},
					}
				}
			),
		)
		self.assertEqual(result["added"], [a, b])
		first = frappe.get_doc("LMS Payment", self._enrollment(self.paid_course, a).payment)
		second = frappe.get_doc("LMS Payment", self._enrollment(self.paid_course, b).payment)
		self.assertEqual((first.amount, first.billing_name), (100, "Alice Pay"))
		self.assertTrue(first.address)
		self.assertEqual(second.amount, 4999)
		self.assertFalse(second.address)

	def test_the_certificate_switch_enrolls_new_and_upgrades_enrolled(self):
		self._create_enrollment(self.students[0], self.cert_course)
		self._as(self.instructor)
		result = enroll_students_in_course(
			self.cert_course,
			json.dumps(self.students[:2]),
			purchased_certificate=True,
			payment_details=json.dumps(self._details(999)),
		)
		self.assertEqual(result["upgraded"], [self.students[0]])
		self.assertEqual(result["added"], [self.students[1]])
		for s in self.students[:2]:
			row = self._enrollment(self.cert_course, s)
			self.assertEqual(row.purchased_certificate, 1)
			self.assertEqual(frappe.db.get_value("LMS Payment", row.payment, "payment_for_certificate"), 1)

	def test_a_student_who_already_bought_the_certificate_is_skipped(self):
		student = self.students[0]
		self._create_enrollment(student, self.cert_course)
		self._as(self.instructor)
		kwargs = {"purchased_certificate": True, "payment_details": json.dumps(self._details(999))}
		enroll_students_in_course(self.cert_course, json.dumps([student]), **kwargs)
		payments = frappe.db.count("LMS Payment", {"member": student})
		result = enroll_students_in_course(self.cert_course, json.dumps([student]), **kwargs)
		self.assertEqual((result["added"], result["upgraded"]), ([], []))
		self.assertEqual(result["errors"][0]["member"], student)
		self.assertIn("already purchased", result["errors"][0]["error"])
		self.assertEqual(frappe.db.count("LMS Payment", {"member": student}), payments)

	def test_an_enrolled_student_without_the_switch_is_skipped(self):
		student = self.students[0]
		self._create_enrollment(student, self.free_course)
		self._as(self.instructor)
		result = enroll_students_in_course(self.free_course, json.dumps([student]))
		self.assertEqual(result["added"], [])
		self.assertIn("already enrolled", result["errors"][0]["error"])

	def test_more_than_fifty_students_are_refused(self):
		emails = [f"cbulk-many{i}-{self.hash}@example.com" for i in range(51)]
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			enroll_students_in_course(self.free_course, json.dumps(emails))
		self.assertEqual(frappe.db.count("LMS Enrollment", {"member": ["in", emails]}), 0)

	def test_only_course_staff_may_bulk_enroll(self):
		for user in ("Guest", self.students[3], self.other_creator):
			with self.subTest(user=user):
				self._as(user)
				with self.assertRaises(frappe.PermissionError):
					enroll_students_in_course(self.free_course, json.dumps(self.students[:1]))

	def test_the_permission_check_runs_before_member_validation(self):
		self._as(self.students[3])
		with self.assertRaises(frappe.PermissionError):
			enroll_students_in_course(self.free_course, "not json")

	def test_malformed_members_are_rejected(self):
		self._as(self.instructor)
		for members in ([1], [""], {"a": 1}):
			with self.subTest(members=members):
				with self.assertRaises(frappe.ValidationError):
					enroll_students_in_course.__wrapped__(self.free_course, members)

	def test_payment_arguments_are_refused_on_a_free_course_without_the_switch(self):
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			enroll_students_in_course(
				self.free_course,
				json.dumps(self.students[:1]),
				payment_details=json.dumps(self._details(999)),
			)
		self.assertFalse(self._enrollment(self.free_course, self.students[0]))

	def test_a_moderator_may_bulk_enroll_and_a_differently_cased_email_is_canonicalised(self):
		student = self.students[2]
		self._as(self.moderator)
		result = enroll_students_in_course(self.free_course, json.dumps([student.upper()]))
		self.assertEqual(result["added"], [student.upper()])
		self.assertTrue(self._enrollment(self.free_course, student))

	def _make_payment(self, member, course, for_certificate, amount=999):
		return (
			frappe.get_doc(
				{
					"doctype": "LMS Payment",
					"member": member,
					"billing_name": member,
					"amount": amount,
					"currency": "INR",
					"source": self.source,
					"payment_for_document_type": "LMS Course",
					"payment_for_document": course,
					"payment_for_certificate": int(for_certificate),
					"payment_received": 1,
				}
			)
			.insert()
			.name
		)

	def _enroll_with_payment(self, member, payment):
		return frappe.get_doc(
			{"doctype": "LMS Enrollment", "course": self.cert_course, "member": member, "payment": payment}
		).insert()

	def test_a_paid_course_refuses_the_certificate_switch(self):
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			enroll_students_in_course(
				self.paid_course,
				json.dumps(self.students[:1]),
				purchased_certificate=True,
				payment_details=json.dumps(self._details(4999)),
			)
		self.assertFalse(self._enrollment(self.paid_course, self.students[0]))

	def test_an_upgrade_without_payment_arguments_keeps_the_existing_payment(self):
		student = self.students[0]
		payment = self._make_payment(student, self.cert_course, False)
		self._enroll_with_payment(student, payment)
		self._as(self.instructor)
		result = enroll_students_in_course(
			self.cert_course, json.dumps([student]), purchased_certificate=True
		)
		self.assertEqual(result["upgraded"], [student])
		row = self._enrollment(self.cert_course, student)
		self.assertEqual((row.purchased_certificate, row.payment), (1, payment))

	def test_an_upgrade_leaves_the_enrollment_counter_alone(self):
		student = self.students[1]
		self._create_enrollment(student, self.cert_course)
		before = self._counter(self.cert_course)
		self._as(self.instructor)
		enroll_students_in_course(
			self.cert_course,
			json.dumps([student]),
			purchased_certificate=True,
			payment_details=json.dumps(self._details(999)),
		)
		self.assertEqual(self._counter(self.cert_course), before)

	def test_a_linked_certificate_payment_is_accepted_on_upgrade(self):
		student = self.students[2]
		self._create_enrollment(student, self.cert_course)
		payment = self._make_payment(student, self.cert_course, True)
		self._as(self.instructor)
		result = enroll_students_in_course(
			self.cert_course,
			json.dumps([student]),
			purchased_certificate=True,
			linked_payments=json.dumps({student: payment}),
		)
		self.assertEqual(result["upgraded"], [student])
		self.assertEqual(self._enrollment(self.cert_course, student).payment, payment)


class BulkEnrollmentQueryCase(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = frappe.generate_hash(length=6).lower()
		cls.instructor = cls._create_user(
			f"bulk-qins-{cls.hash}@example.com", "Bulk", "Instructor", ["Course Creator"]
		).name
		cls.other_creator = cls._create_user(
			f"bulk-qoth-{cls.hash}@example.com", "Bulk", "Other", ["Course Creator"]
		).name
		cls.moderator = cls._create_user(
			f"bulk-qmod-{cls.hash}@example.com", "Bulk", "Moderator", ["Moderator"]
		).name
		cls.students = [
			cls._create_user(
				f"bulk-qstu{i}-{cls.hash}@example.com", "Bulk", f"QStudent{i}", ["LMS Student"]
			).name
			for i in range(12)
		]
		cls.disabled = cls._create_user(
			f"bulk-qdis-{cls.hash}@example.com", "Bulk", "Disabled", ["LMS Student"]
		).name
		frappe.db.set_value("User", cls.disabled, "enabled", 0)
		cls._create_evaluator(cls.instructor)
		cls.course = cls._create_course(f"Bulk QCourse {cls.hash}", instructor=cls.instructor).name
		frappe.db.set_value(
			"LMS Course",
			cls.course,
			{
				"published": 1,
				"paid_course": 1,
				"paid_certificate": 1,
				"course_price": 4999,
				"currency": "INR",
			},
		)
		cls.cert_course = cls._create_course(f"Bulk QCert Course {cls.hash}", instructor=cls.instructor).name
		frappe.db.set_value(
			"LMS Course",
			cls.cert_course,
			{"published": 1, "paid_certificate": 1, "course_price": 999, "currency": "INR"},
		)
		cls.batch = cls._create_batch(
			cls.course, instructor=cls.instructor, title=f"Bulk Batch Q {cls.hash}", evaluator=cls.instructor
		).name
		frappe.db.set_value(
			"LMS Batch",
			cls.batch,
			{"paid_batch": 1, "amount": 500, "currency": "USD", "seat_count": 3},
		)
		cls.source = (
			frappe.get_doc({"doctype": "LMS Source", "source": f"Bulk QSource {cls.hash}"}).insert().name
		)

	def _as(self, user):
		frappe.set_user(user)
		self.addCleanup(frappe.set_user, "Administrator")

	def _make_payment(self, member, doctype="LMS Course", document=None, for_certificate=0, received=1):
		return (
			frappe.get_doc(
				{
					"doctype": "LMS Payment",
					"member": member,
					"billing_name": member,
					"amount": 100,
					"currency": "INR",
					"source": self.source,
					"payment_for_document_type": doctype,
					"payment_for_document": document or self.course,
					"payment_for_certificate": for_certificate,
					"payment_received": received,
				}
			)
			.insert()
			.name
		)


class TestBulkEnrollmentPreview(BulkEnrollmentQueryCase):
	def _preview(self, members, doctype="LMS Course", docname=None, **kwargs):
		docname = docname or (self.course if doctype == "LMS Course" else self.batch)
		return get_bulk_enrollment_preview(doctype, docname, json.dumps(members), **kwargs)

	def _statuses(self, result):
		return [(r["member"], r["status"]) for r in result["rows"]]

	def test_rows_report_each_status_in_member_order(self):
		missing = f"nobody-{self.hash}@example.com"
		self._create_enrollment(self.students[0], self.course)
		self._as(self.instructor)
		rows = self._preview([self.students[1], self.students[0], missing, self.disabled])["rows"]
		self.assertEqual(
			[(r["member"], r["status"]) for r in rows],
			[
				(self.students[1], "ready"),
				(self.students[0], "enrolled"),
				(missing, "no_user"),
				(self.disabled, "disabled"),
			],
		)
		self.assertEqual(rows[0]["full_name"], "Bulk QStudent1")
		self.assertIsNone(rows[2]["full_name"])
		self.assertIn("user_image", rows[0])

	def test_the_certificate_switch_reports_upgrade_and_already_purchased(self):
		enrolled, bought = self.students[0], self.students[1]
		self._create_enrollment(enrolled, self.course)
		self._create_enrollment(bought, self.course)
		frappe.db.set_value(
			"LMS Enrollment",
			{"course": self.course, "member": bought},
			"purchased_certificate",
			1,
		)
		self._as(self.instructor)
		result = self._preview([enrolled, bought, self.students[2]], purchased_certificate=True)
		self.assertEqual(
			self._statuses(result),
			[(enrolled, "upgrade"), (bought, "certificate_purchased"), (self.students[2], "ready")],
		)

	def test_linkable_payments_are_received_unused_and_matching(self):
		student, other = self.students[1], self.students[2]
		good = self._make_payment(student)
		self._make_payment(student, received=0)
		self._make_payment(student, for_certificate=1)
		self._make_payment(student, doctype="LMS Batch", document=self.batch)
		self._make_payment(other)
		used = self._make_payment(student)
		frappe.get_doc(
			{"doctype": "LMS Enrollment", "course": self.course, "member": student, "payment": used}
		).insert()
		self._as(self.instructor)
		result = self._preview([student, other])
		self.assertEqual([r["status"] for r in result["rows"]], ["enrolled", "ready"])
		self.assertEqual(result["rows"][0]["linkable_payments"], [])
		self.assertEqual(len(result["rows"][1]["linkable_payments"]), 1)

		frappe.db.delete("LMS Enrollment", {"course": self.course, "member": student})
		result = self._preview([student])
		linkable = result["rows"][0]["linkable_payments"]
		self.assertEqual({p["name"] for p in linkable}, {good, used})
		self.assertEqual(set(linkable[0]), {"name", "amount", "currency", "creation"})

	def test_certificate_payments_are_listed_for_the_certificate_switch(self):
		student, course = self.students[3], self.cert_course
		self._make_payment(student, document=course)
		cert = self._make_payment(student, document=course, for_certificate=1)
		self._create_enrollment(student, course)
		self._as(self.instructor)
		row = self._preview([student], docname=course, purchased_certificate=True)["rows"][0]
		self.assertEqual(row["status"], "upgrade")
		self.assertEqual([p["name"] for p in row["linkable_payments"]], [cert])

	def test_an_evaluator_without_payment_rights_gets_no_linkable_payments(self):
		evaluator = self._create_user(
			f"bulk-qeval-{self.hash}@example.com", "Bulk", "Evaluator", ["Batch Evaluator"]
		).name
		student = self.students[4]
		self._make_payment(student, doctype="LMS Batch", document=self.batch)
		self._as(evaluator)
		rows = self._preview([student], doctype="LMS Batch")["rows"]
		self.assertEqual((rows[0]["status"], rows[0]["linkable_payments"]), ("ready", []))

	def test_a_batch_preview_reports_seats_left_and_the_batch_price(self):
		self._create_batch_enrollment(self.students[0], self.batch)
		self._as(self.instructor)
		result = self._preview([self.students[1]], doctype="LMS Batch")
		self.assertEqual((result["seats_left"], result["amount"], result["currency"]), (2, 500, "USD"))
		course = self._preview([self.students[1]])
		self.assertEqual((course["seats_left"], course["amount"], course["currency"]), (None, 4999, "INR"))

	def test_the_query_count_does_not_grow_with_members(self):
		self._as(self.instructor)
		self._preview(self.students[:1])

		def count(members):
			calls = []
			original = frappe.db.sql

			def counting(*args, **kwargs):
				calls.append(1)
				return original(*args, **kwargs)

			with patch.object(frappe.db, "sql", counting):
				self._preview(members)
			return len(calls)

		self.assertEqual(count(self.students[:2]), count(self.students[:10]))

	def test_only_people_who_can_enroll_others_get_a_preview(self):
		for user in ("Guest", self.students[5], self.other_creator):
			with self.subTest(user=user):
				self._as(user)
				with self.assertRaises(frappe.PermissionError):
					self._preview([self.students[0]])
		self._as(self.moderator)
		self.assertTrue(self._preview([self.students[0]])["rows"])

	def test_an_empty_member_list_previews_no_rows(self):
		self._create_batch_enrollment(self.students[0], self.batch)
		self._as(self.instructor)
		result = get_bulk_enrollment_preview("LMS Batch", self.batch, "[]")
		self.assertEqual(result, {"rows": [], "seats_left": 2, "amount": 500, "currency": "USD"})

	def test_an_unknown_target_is_rejected(self):
		self._as(self.instructor)
		for doctype, docname in (("User", "Administrator"), ("LMS Course", "no-such-course")):
			with self.subTest(doctype=doctype):
				with self.assertRaises(frappe.ValidationError):
					get_bulk_enrollment_preview.__wrapped__(doctype, docname, [])


class TestSearchUsersToEnroll(BulkEnrollmentQueryCase):
	def _search(self, **kwargs):
		kwargs.setdefault("enroll_doctype", "LMS Course")
		kwargs.setdefault("enroll_docname", self.course)
		return search_users_to_enroll(**kwargs)

	def _values(self, rows):
		return [r["value"] for r in rows]

	def test_enrolled_users_are_left_out_unless_asked_for(self):
		self._create_enrollment(self.students[0], self.course)
		self._as(self.instructor)
		txt = f"-{self.hash}@"
		self.assertNotIn(self.students[0], self._values(self._search(txt=txt)))
		self.assertIn(self.students[1], self._values(self._search(txt=txt)))
		self.assertIn(self.students[0], self._values(self._search(txt=txt, include_enrolled=True)))

	def test_rows_match_the_link_search_shape(self):
		self._as(self.instructor)
		row = self._search(txt=self.students[1])[0]
		self.assertEqual(
			row,
			{
				"value": self.students[1],
				"label": "Bulk QStudent1",
				"description": self.students[1],
				"image": None,
			},
		)
		self.assertEqual(self._search(txt="QStudent1")[0]["value"], self.students[1])

	def test_rows_carry_the_user_image(self):
		frappe.db.set_value("User", self.students[2], "user_image", "/files/pic.png")
		self._as(self.instructor)
		self.assertEqual(self._search(txt=self.students[2])[0]["image"], "/files/pic.png")
		self.assertEqual(self._search(names=[self.students[2]])[0]["image"], "/files/pic.png")

	def test_batch_enrollments_are_excluded_for_a_batch(self):
		self._create_batch_enrollment(self.students[0], self.batch)
		self._as(self.instructor)
		rows = self._search(enroll_doctype="LMS Batch", enroll_docname=self.batch, txt=self.students[0])
		self.assertEqual(rows, [])

	def test_names_resolve_only_eligible_users(self):
		self._create_enrollment(self.students[0], self.course)
		self._as(self.instructor)
		names = json.dumps([self.students[0], self.students[1], self.disabled])
		rows = self._search(names=names)
		self.assertEqual(self._values(rows), [self.students[1]])
		self.assertEqual(rows[0]["label"], "Bulk QStudent1")
		self.assertNotIn("enrolled", rows[0])
		self.assertEqual(
			self._values(self._search(names=names, include_enrolled=True)),
			[self.students[0], self.students[1]],
		)

	def test_certificate_mode_leaves_out_users_who_bought_the_certificate(self):
		enrolled, bought = self.students[0], self.students[1]
		self._create_enrollment(enrolled, self.course)
		self._create_enrollment(bought, self.course)
		frappe.db.set_value(
			"LMS Enrollment", {"course": self.course, "member": bought}, "purchased_certificate", 1
		)
		self._as(self.instructor)
		txt = f"-{self.hash}@"
		values = self._values(self._search(txt=txt, include_enrolled=True))
		self.assertIn(enrolled, values)
		self.assertNotIn(bought, values)
		self.assertIn(self.students[2], values)
		by_names = self._search(names=json.dumps([enrolled, bought]), include_enrolled=True)
		self.assertEqual(self._values(by_names), [enrolled])
		self.assertNotIn(bought, self._values(self._search(txt=txt)))

	def test_page_length_is_capped_at_twenty(self):
		for i in range(25):
			self._create_user(f"bulk-cap{i}-{self.hash}@example.com", "Cap", f"Student{i}", ["LMS Student"])
		self._as(self.instructor)
		rows = self._search(txt="bulk-cap", page_length=500)
		self.assertEqual(len(rows), 20)
		self.assertEqual(len(self._search(txt="bulk-cap", page_length=3)), 3)

	def test_disabled_users_administrator_and_guest_never_appear(self):
		self._as(self.instructor)
		self.assertNotIn(self.disabled, self._values(self._search(txt="Disabled")))
		for txt in ("Administrator", "Guest"):
			with self.subTest(txt=txt):
				self.assertEqual(self._search(txt=txt, include_enrolled=True), [])

	def test_only_people_who_can_enroll_others_may_search(self):
		for user in ("Guest", self.students[5], self.other_creator):
			with self.subTest(user=user):
				self._as(user)
				with self.assertRaises(frappe.PermissionError):
					self._search(txt="bulk")
		self._as(self.moderator)
		self.assertTrue(self._search(txt=self.students[1]))

	def test_empty_names_return_nothing(self):
		self._as(self.instructor)
		self.assertEqual(self._search(names="[]"), [])

	def test_system_users_are_listed_only_for_moderators_and_system_managers(self):
		staff = self._create_user(
			f"bulk-qsys-{self.hash}@example.com", "Bulk", "SysStaff", ["Course Creator"]
		).name
		frappe.db.set_value("User", staff, "user_type", "System User")
		for kwargs in ({"txt": "SysStaff"}, {"names": json.dumps([staff])}):
			with self.subTest(**kwargs):
				self._as(self.instructor)
				self.assertEqual(self._search(**kwargs), [])
				self._as(self.moderator)
				self.assertEqual(self._values(self._search(**kwargs)), [staff])

	def test_an_unknown_enroll_doctype_is_rejected(self):
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			search_users_to_enroll.__wrapped__("User", "Administrator")
		with self.assertRaises(frappe.ValidationError):
			search_users_to_enroll.__wrapped__("LMS Course", "no-such-course")
