# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
import frappe.client
from frappe.exceptions import FrappeTypeError
from frappe.utils import add_days, nowdate

from lms.lms.api import save_certificate_details, save_evaluation_details
from lms.lms.doctype.lms_certificate.lms_certificate import (
	get_default_certificate_template,
	is_certified,
)
from lms.lms.test_helpers import BaseTestUtils


class TestLMSCertificate(BaseTestUtils):
	"""The Batch Evaluator DocPerm grants CRUD on the whole doctype, so these pin
	one evaluator out of another batch's certificates and evaluations."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# Lowercase: User names are the lowercased email, and a mixed-case session
		# user compares unequal to its own row and fakes a denial.
		hash = frappe.generate_hash(length=6).lower()
		cls.evaluator_a = cls._create_user(
			f"cert-eval-a-{hash}@example.com", "Eval", "Ay", ["Batch Evaluator"]
		).name
		cls.evaluator_b = cls._create_user(
			f"cert-eval-b-{hash}@example.com", "Eval", "Bee", ["Batch Evaluator"]
		).name
		cls.member_a = cls._create_user(
			f"cert-member-a-{hash}@example.com", "Member", "Ay", ["LMS Student"]
		).name
		cls.member_b = cls._create_user(
			f"cert-member-b-{hash}@example.com", "Member", "Bee", ["LMS Student"]
		).name
		cls.instructor = cls._create_user(
			f"cert-instructor-{hash}@example.com", "Cert", "Instructor", ["Course Creator"]
		).name
		cls._create_evaluator(cls.evaluator_a)
		cls._create_evaluator(cls.evaluator_b)

		# One course in two batches: the batch, not the course, is what separates
		# the two evaluators.
		cls.course = cls._create_course(title=f"Cert Scope Course {hash}", instructor=cls.instructor)
		cls.batch_a = cls._create_batch(
			cls.course.name,
			title=f"Cert Scope Batch A {hash}",
			instructor=cls.instructor,
			evaluator=cls.evaluator_a,
		).name
		cls.batch_b = cls._create_batch(
			cls.course.name,
			title=f"Cert Scope Batch B {hash}",
			instructor=cls.instructor,
			evaluator=cls.evaluator_b,
		).name
		for member in (cls.member_a, cls.member_b):
			for batch in (cls.batch_a, cls.batch_b):
				cls._create_batch_enrollment(member, batch)

	def setUp(self):
		super().setUp()
		self.certificate_a = self._certificate(self.member_a, self.batch_a, self.evaluator_a)
		self.certificate_b = self._certificate(self.member_b, self.batch_b, self.evaluator_b)

	def _certificate(self, member, batch, evaluator):
		# nosemgrep: lms-unjustified-ignore-permissions - seeding the rows the rules under test are measured against
		return frappe.get_doc(self._certificate_payload(member, batch, evaluator)).insert(
			ignore_permissions=True
		)

	def _certificate_payload(self, member, batch, evaluator):
		return {
			"doctype": "LMS Certificate",
			"member": member,
			"course": self.course.name,
			"batch_name": batch,
			"evaluator": evaluator,
			"issue_date": nowdate(),
			"template": get_default_certificate_template(),
			"published": 0,
		}

	def test_an_evaluator_cannot_write_another_batchs_certificate(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.set_value("LMS Certificate", self.certificate_b.name, "published", 1)

	def test_an_evaluator_cannot_delete_another_batchs_certificate(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("LMS Certificate", self.certificate_b.name)

	def test_an_evaluator_cannot_create_a_certificate_in_another_batch(self):
		"""The caller picks `evaluator` on a new row, so naming themselves must not help."""
		frappe.db.delete("LMS Certificate", {"name": self.certificate_b.name})
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.insert(self._certificate_payload(self.member_b, self.batch_b, self.evaluator_a))

	def test_an_evaluator_cannot_claim_another_batchs_certificate(self):
		"""The write check sees the caller's in-memory row, so it reads scope from the stored one."""
		frappe.set_user(self.evaluator_a)
		certificate = frappe.get_doc("LMS Certificate", self.certificate_b.name)
		certificate.evaluator = self.evaluator_a
		with self.assertRaises(frappe.PermissionError):
			certificate.save()

	def test_an_evaluator_cannot_move_their_certificate_into_another_batch(self):
		frappe.set_user(self.evaluator_a)
		certificate = frappe.get_doc("LMS Certificate", self.certificate_a.name)
		certificate.batch_name = self.batch_b
		with self.assertRaises(frappe.PermissionError):
			certificate.save()

	def test_save_certificate_details_does_not_overwrite_another_batchs_row(self):
		frappe.set_user(self.evaluator_a)
		created = save_certificate_details(
			member=self.member_b,
			course=self.course.name,
			batch_name=self.batch_a,
			issue_date=nowdate(),
			template=get_default_certificate_template(),
			published=True,
		)

		self.assertNotEqual(created, self.certificate_b.name)
		stored = frappe.db.get_value(
			"LMS Certificate", self.certificate_b.name, ["batch_name", "published"], as_dict=True
		)
		self.assertEqual(stored, {"batch_name": self.batch_b, "published": 0})

	def test_a_member_certified_in_two_batches_of_a_course_holds_both(self):
		frappe.set_user(self.evaluator_b)
		save_certificate_details(
			member=self.member_a,
			course=self.course.name,
			batch_name=self.batch_b,
			issue_date=nowdate(),
			template=get_default_certificate_template(),
		)

		batches = frappe.get_all(
			"LMS Certificate",
			filters={"member": self.member_a, "course": self.course.name},
			pluck="batch_name",
		)
		self.assertCountEqual(batches, [self.batch_a, self.batch_b])

	def _batch_certificate_payload(self, member, batch):
		payload = self._certificate_payload(member, batch, self.evaluator_a)
		payload["course"] = None
		return payload

	def test_a_batch_evaluator_issues_a_batch_certificate_to_its_student(self):
		frappe.set_user(self.evaluator_a)
		certificate = frappe.client.insert(self._batch_certificate_payload(self.member_b, self.batch_a))
		self.assertEqual(certificate["batch_name"], self.batch_a)

	def test_a_batch_certificate_is_refused_in_another_batch(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.insert(self._batch_certificate_payload(self.member_a, self.batch_b))

	def test_a_batch_certificate_is_refused_for_a_user_outside_the_batch(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.insert(self._batch_certificate_payload(self.instructor, self.batch_a))

	def test_the_save_endpoints_reject_a_filter_in_place_of_a_name(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(FrappeTypeError):
			save_certificate_details(
				member=self.member_b,
				course=self.course.name,
				batch_name={"like": "%"},
				issue_date=nowdate(),
				template=get_default_certificate_template(),
			)
		with self.assertRaises(FrappeTypeError):
			save_evaluation_details(
				member={"like": "%"},
				course=self.course.name,
				batch_name=self.batch_a,
				date_value=nowdate(),
				start_time="10:00",
				end_time="11:00",
				status="Pass",
			)

	def test_a_second_certificate_in_the_same_batch_is_still_refused(self):
		with self.assertRaises(frappe.ValidationError):
			self._certificate(self.member_a, self.batch_a, self.evaluator_a)

	def test_save_evaluation_details_does_not_overwrite_another_batchs_row(self):
		# nosemgrep: lms-unjustified-ignore-permissions - seeding the row the endpoint is measured against
		evaluation_b = frappe.get_doc(
			{
				"doctype": "LMS Certificate Evaluation",
				"member": self.member_b,
				"course": self.course.name,
				"batch_name": self.batch_b,
				"evaluator": self.evaluator_b,
				"date": nowdate(),
				"start_time": "10:00:00",
				"status": "Pending",
				"summary": "untouched",
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.evaluator_a)
		name = save_evaluation_details(
			member=self.member_b,
			course=self.course.name,
			batch_name=self.batch_a,
			date_value=nowdate(),
			start_time="10:00:00",
			end_time="11:00:00",
			status="Pass",
			rating=5,
			summary="forged",
		)

		self.assertNotEqual(name, evaluation_b.name)
		stored = frappe.db.get_value(
			"LMS Certificate Evaluation", evaluation_b.name, ["batch_name", "status", "summary"], as_dict=True
		)
		self.assertEqual(stored, {"batch_name": self.batch_b, "status": "Pending", "summary": "untouched"})

	def test_the_assigned_evaluator_still_works_their_own_batch(self):
		frappe.set_user(self.evaluator_a)
		frappe.client.set_value("LMS Certificate", self.certificate_a.name, "published", 1)
		self.assertEqual(frappe.db.get_value("LMS Certificate", self.certificate_a.name, "published"), 1)

		# Read stays open to every evaluator, as before.
		self.assertTrue(frappe.has_permission("LMS Certificate", "read", self.certificate_b.name))

		frappe.delete_doc("LMS Certificate", self.certificate_a.name)
		self.assertFalse(frappe.db.exists("LMS Certificate", self.certificate_a.name))

		created = frappe.client.insert(
			self._certificate_payload(self.member_a, self.batch_a, self.evaluator_a)
		)
		self.assertEqual(created["batch_name"], self.batch_a)

	def test_save_certificate_details_updates_the_own_batch_row(self):
		frappe.set_user(self.evaluator_a)
		name = save_certificate_details(
			member=self.member_a,
			course=self.course.name,
			batch_name=self.batch_a,
			issue_date=nowdate(),
			template=get_default_certificate_template(),
			published=True,
		)
		self.assertEqual(name, self.certificate_a.name)
		self.assertEqual(frappe.db.get_value("LMS Certificate", name, "published"), 1)

	def test_a_moderator_is_unrestricted(self):
		moderator = self._create_user(
			f"cert-mod-{frappe.generate_hash(length=6).lower()}@example.com",
			"Cert",
			"Mod",
			["Moderator", "Batch Evaluator"],
		).name
		frappe.set_user(moderator)
		frappe.client.set_value("LMS Certificate", self.certificate_b.name, "published", 1)
		frappe.delete_doc("LMS Certificate", self.certificate_b.name)
		self.assertFalse(frappe.db.exists("LMS Certificate", self.certificate_b.name))

	def test_a_student_cannot_write_someone_elses_certificate(self):
		frappe.set_user(self.member_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.set_value("LMS Certificate", self.certificate_b.name, "published", 1)

	def test_a_system_manager_keeps_docperm_access(self):
		"""has_permission can only subtract from DocPerm roles, never grant one back."""
		manager = self._create_user(
			f"cert-sysman-{frappe.generate_hash(length=6).lower()}@example.com",
			"Cert",
			"Sysman",
			["System Manager"],
		).name
		frappe.set_user(manager)
		frappe.client.set_value("LMS Certificate", self.certificate_b.name, "published", 1)
		frappe.delete_doc("LMS Certificate", self.certificate_b.name)
		self.assertFalse(frappe.db.exists("LMS Certificate", self.certificate_b.name))

	def test_is_certified_picks_the_most_recently_issued_batch_certificate(self):
		newer = self._certificate(self.member_a, self.batch_b, self.evaluator_b)
		frappe.db.set_value("LMS Certificate", newer.name, "issue_date", add_days(nowdate(), 1))

		frappe.set_user(self.member_a)
		self.assertEqual(is_certified(self.course.name), newer.name)

	def test_is_certified_prefers_the_course_level_certificate_over_any_batch(self):
		newer = self._certificate(self.member_a, self.batch_b, self.evaluator_b)
		frappe.db.set_value("LMS Certificate", newer.name, "issue_date", add_days(nowdate(), 1))
		course_level = self._certificate(self.member_a, None, self.evaluator_a)

		frappe.set_user(self.member_a)
		self.assertEqual(is_certified(self.course.name), course_level.name)

	def _grade(self, status, rating):
		return save_evaluation_details(
			member=self.member_a,
			course=self.course.name,
			batch_name=self.batch_a,
			date_value=nowdate(),
			start_time="10:00:00",
			end_time="11:00:00",
			status=status,
			rating=rating,
			summary="graded",
		)

	def test_regrading_an_evaluation_validates_the_rating(self):
		"""Regression: updates went through db.set_value (#1010), so a Pass could carry rating 0.
		Added for audit finding #61."""
		frappe.set_user(self.evaluator_a)
		name = self._grade("Pending", 0)

		with self.assertRaises(frappe.ValidationError):
			self._grade("Pass", 0)

		self.assertEqual(frappe.db.get_value("LMS Certificate Evaluation", name, "status"), "Pending")

	def test_updating_a_certificate_validates_its_links(self):
		"""Regression: certificate updates skipped validation too (#1010).
		Added for audit finding #61."""
		frappe.set_user(self.evaluator_a)

		with self.assertRaises(frappe.LinkValidationError):
			save_certificate_details(
				member=self.member_a,
				course=self.course.name,
				batch_name=self.batch_a,
				issue_date=nowdate(),
				template=f"No Such Format {frappe.generate_hash(length=6)}",
			)

		self.assertEqual(
			frappe.db.get_value("LMS Certificate", self.certificate_a.name, "template"),
			get_default_certificate_template(),
		)

	def _reassign_evaluator(self, batch, evaluator):
		frappe.db.set_value(
			"Batch Course", {"parent": batch, "course": self.course.name}, "evaluator", evaluator
		)

	def test_a_reassigned_evaluator_regrades_their_predecessors_evaluation(self):
		"""The save endpoint authorises the batch's current evaluator, so the
		doctype's write check must not demand the row's previous grader."""
		frappe.set_user(self.evaluator_a)
		name = self._grade("Pending", 0)

		frappe.set_user("Administrator")
		self._reassign_evaluator(self.batch_a, self.evaluator_b)

		frappe.set_user(self.evaluator_b)
		self.assertEqual(self._grade("Pass", 5), name)
		stored = frappe.db.get_value(
			"LMS Certificate Evaluation", name, ["status", "evaluator"], as_dict=True
		)
		self.assertEqual(stored, {"status": "Pass", "evaluator": self.evaluator_b})

		# The previous grader no longer evaluates the batch and is out.
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			self._grade("Fail", 1)

	def test_a_moderator_correction_keeps_the_grader(self):
		"""With no evaluator assigned, a Moderator's regrade must not take the row
		from the evaluator who graded it."""
		frappe.set_user(self.evaluator_a)
		name = self._grade("Pending", 0)

		frappe.set_user("Administrator")
		self._reassign_evaluator(self.batch_a, None)
		moderator = self._create_user(
			f"eval-mod-{frappe.generate_hash(length=6).lower()}@example.com",
			"Eval",
			"Mod",
			["Moderator", "Batch Evaluator"],
		).name

		frappe.set_user(moderator)
		self.assertEqual(self._grade("Pass", 5), name)
		self.assertEqual(
			frappe.db.get_value("LMS Certificate Evaluation", name, "evaluator"), self.evaluator_a
		)

	def test_a_reassigned_evaluator_cannot_move_the_evaluation_off_their_batch(self):
		frappe.set_user(self.evaluator_a)
		name = self._grade("Pending", 0)

		frappe.set_user("Administrator")
		self._reassign_evaluator(self.batch_a, self.evaluator_b)
		self._reassign_evaluator(self.batch_b, self.evaluator_a)

		frappe.set_user(self.evaluator_b)
		evaluation = frappe.get_doc("LMS Certificate Evaluation", name)
		evaluation.evaluator = self.evaluator_b
		evaluation.batch_name = self.batch_b
		with self.assertRaises(frappe.PermissionError):
			evaluation.save()

	def test_editing_an_issued_certificate_skips_the_eligibility_checks(self):
		"""Progress or enrolment may change after issue; that must not lock the certificate."""
		frappe.db.delete("LMS Batch Enrollment", {"batch": self.batch_a, "member": self.member_a})

		frappe.set_user(self.evaluator_a)
		expiry = add_days(nowdate(), 30)
		name = save_certificate_details(
			member=self.member_a,
			course=self.course.name,
			batch_name=self.batch_a,
			issue_date=nowdate(),
			expiry_date=expiry,
			template=get_default_certificate_template(),
			published=True,
		)
		self.assertEqual(name, self.certificate_a.name)
		self.assertEqual(str(frappe.db.get_value("LMS Certificate", name, "expiry_date")), expiry)

		# Re-homing the certificate still checks the new holder.
		frappe.set_user("Administrator")
		certificate = frappe.get_doc("LMS Certificate", name)
		certificate.member = self.instructor
		with self.assertRaises(frappe.ValidationError):
			certificate.save()
