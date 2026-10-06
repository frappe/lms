# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Who may enroll into a paid batch without a recorded LMS Payment."""

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestBatchEnrollmentPaymentScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		cls._create_users(suffix)
		cls._create_evaluator(cls.tagged_evaluator.email)
		course = cls._create_course(f"BEP Course {suffix}", cls.tagged_instructor.email).name
		cls.batch = cls._create_batch(
			course=course,
			instructor=cls.tagged_instructor.email,
			title=f"BEP Paid Batch {suffix}",
			evaluator=cls.tagged_evaluator.email,
		).name
		frappe.db.set_value("LMS Batch", cls.batch, {"paid_batch": 1, "amount": 100, "currency": "INR"})

	@classmethod
	def _create_users(cls, suffix):
		author_roles = ["Batch Evaluator", "Course Creator"]
		cls.student = cls._bep_user(suffix, "stu", ["LMS Student"])
		cls.other_student = cls._bep_user(suffix, "oth", ["LMS Student"])
		cls.creator = cls._bep_user(suffix, "cc", ["LMS Student", "Course Creator"])
		cls.untagged_evaluator = cls._bep_user(suffix, "ute", ["LMS Student", "Batch Evaluator"])
		cls.tagged_instructor = cls._bep_user(suffix, "ti", author_roles)
		cls.tagged_evaluator = cls._bep_user(suffix, "tev", author_roles)
		cls.moderator = cls._bep_user(suffix, "mod", ["Moderator"])
		cls.system_manager = cls._bep_user(suffix, "sm", ["System Manager"], user_type="System User")

	@classmethod
	def _bep_user(cls, suffix, prefix, roles, user_type="Website User"):
		return cls._create_user(f"bep-{prefix}-{suffix}@example.com", "BEP", prefix, roles, user_type)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _enroll(self, member, owner=None):
		frappe.set_user(owner or member)
		doc = frappe.new_doc("LMS Batch Enrollment")
		doc.update({"member": member, "batch": self.batch})
		doc.insert()
		frappe.set_user("Administrator")
		return doc

	def _create_payment(self, member):
		payment = frappe.get_doc(
			{
				"doctype": "LMS Payment",
				"member": member,
				"billing_name": member,
				"amount": 100,
				"currency": "INR",
				"payment_for_document_type": "LMS Batch",
				"payment_for_document": self.batch,
				"payment_received": 1,
			}
		)
		payment.insert(ignore_mandatory=True)
		return payment

	def _enrolled(self, member):
		return frappe.db.exists("LMS Batch Enrollment", {"batch": self.batch, "member": member})

	def test_author_roles_do_not_skip_payment_on_self_enrollment(self):
		"""#2311 let any Course Creator or Batch Evaluator skip payment. Added in #2847,
		where self-enrollment skips it only for a site admin or Moderator."""
		for user in (self.creator, self.untagged_evaluator, self.tagged_instructor):
			with self.subTest(user=user.email):
				with self.assertRaises(frappe.ValidationError):
					self._enroll(user.email)
				self.assertFalse(self._enrolled(user.email))

	def test_site_admin_and_moderator_self_enroll_without_payment(self):
		"""#2311's role list left out site admins. Added in #2847 so a site admin or
		Moderator can enroll themselves into a paid batch without paying."""
		for user in (self.system_manager, self.moderator):
			with self.subTest(user=user.email):
				self.assertTrue(self._enrolled(self._enroll(user.email).member))

	def test_tagged_author_enrolls_another_member_without_payment(self):
		"""#2311 added the bypass so staff could enroll students. Added in #2847 to
		keep that working for the batch's tagged instructors and evaluators."""
		for member, owner in (
			(self.student, self.tagged_instructor),
			(self.other_student, self.tagged_evaluator),
		):
			with self.subTest(owner=owner.email):
				self.assertTrue(self._enrolled(self._enroll(member.email, owner=owner.email).member))

	def test_untagged_batch_evaluator_cannot_enroll_another_member_without_payment(self):
		"""#2311 let any Batch Evaluator enroll others for free. Added in #2847,
		where only an evaluator or instructor tagged on this batch can."""
		with self.assertRaises(frappe.ValidationError):
			self._enroll(self.student.email, owner=self.untagged_evaluator.email)
		self.assertFalse(self._enrolled(self.student.email))

	def test_member_with_recorded_payment_can_self_enroll(self):
		"""Control for the payment rule #2311 loosened, added in #2847. A recorded
		payment still admits the member and gets linked on the enrollment."""
		self._create_payment(self.student.email)
		doc = self._enroll(self.student.email)
		self.assertTrue(self._enrolled(doc.member))
		self.assertTrue(doc.payment)
