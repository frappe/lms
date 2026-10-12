import frappe
from frappe.client import save, set_value

from lms.lms.doctype.lms_enrollment.lms_enrollment import update_enrollment
from lms.lms.test_helpers import BaseTestUtils


class TestEnrollmentIdentityFields(BaseTestUtils):
	"""Eligibility and payment are checked when an enrollment is created, so the
	fields they were checked against must not change afterwards."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		suffix = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"eif-stud-{suffix}@example.com", "Ida", "Student", ["LMS Student"])
		cls.other = cls._create_user(f"eif-other-{suffix}@example.com", "Oto", "Student", ["LMS Student"])
		cls.moderator = cls._create_user(f"eif-mod-{suffix}@example.com", "Mo", "Derator", ["Moderator"])
		cls.evaluator = cls._create_user(
			f"eif-eval-{suffix}@example.com", "Eva", "Luator", ["Batch Evaluator"]
		)
		cls._create_evaluator(cls.evaluator.email)
		cls.free_course = cls._create_course(f"Free Course {suffix}", cls.moderator.email)
		cls.paid_course = cls._create_course(f"Paid Course {suffix}", cls.moderator.email)
		frappe.db.set_value(
			"LMS Course",
			cls.paid_course.name,
			{"paid_course": 1, "course_price": 100, "currency": "INR"},
		)
		cls.free_batch = cls._create_batch(
			cls.free_course.name, cls.moderator.email, f"Free Batch {suffix}", cls.evaluator.email
		)
		cls.paid_batch = cls._create_batch(
			cls.paid_course.name, cls.moderator.email, f"Paid Batch {suffix}", cls.evaluator.email
		)
		frappe.db.set_value(
			"LMS Batch",
			cls.paid_batch.name,
			{"paid_batch": 1, "amount": 100, "currency": "INR", "allow_self_enrollment": 1},
		)

	def setUp(self):
		super().setUp()
		frappe.set_user(self.student.email)
		self.enrollment = self._create_enrollment(self.student.email, self.free_course.name)
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _set_enrollment(self, user, field, value):
		frappe.set_user(user)
		set_value("LMS Enrollment", self.enrollment.name, field, value)

	def _stored(self, field):
		return frappe.db.get_value("LMS Enrollment", self.enrollment.name, field)

	def test_student_cannot_repoint_free_enrollment_to_paid_course(self):
		with self.assertRaises(frappe.CannotChangeConstantError) as ctx:
			self._set_enrollment(self.student.email, "course", self.paid_course.name)
		self.assertIn(self.enrollment.name, str(ctx.exception))
		self.assertIn(self.free_course.name, str(ctx.exception))
		self.assertIn(self.paid_course.name, str(ctx.exception))
		self.assertEqual(self._stored("course"), self.free_course.name)

	def test_student_cannot_hand_enrollment_to_another_member(self):
		with self.assertRaises(frappe.CannotChangeConstantError):
			self._set_enrollment(self.student.email, "member", self.other.email)
		self.assertEqual(self._stored("member"), self.student.email)

	def test_student_cannot_attach_enrollment_to_a_batch(self):
		with self.assertRaises(frappe.CannotChangeConstantError):
			self._set_enrollment(self.student.email, "enrollment_from_batch", self.paid_batch.name)
		self.assertIsNone(self._stored("enrollment_from_batch"))

	def test_moderator_cannot_repoint_enrollment_either(self):
		with self.assertRaises(frappe.CannotChangeConstantError):
			self._set_enrollment(self.moderator.email, "course", self.paid_course.name)
		self.assertEqual(self._stored("course"), self.free_course.name)

	def test_guest_cannot_edit_enrollment(self):
		with self.assertRaises(frappe.PermissionError):
			self._set_enrollment("Guest", "course", self.paid_course.name)
		self.assertEqual(self._stored("course"), self.free_course.name)

	def test_raw_enrollment_write_cannot_change_course(self):
		with self.assertRaises(frappe.CannotChangeConstantError) as ctx:
			update_enrollment(self.enrollment.name, {"course": self.paid_course.name})
		self.assertIn(self.free_course.name, str(ctx.exception))
		self.assertIn(self.paid_course.name, str(ctx.exception))
		self.assertEqual(self._stored("course"), self.free_course.name)

	def test_student_can_still_resave_unchanged_enrollment(self):
		before = self._stored("modified")
		frappe.set_user(self.student.email)
		doc = frappe.get_doc("LMS Enrollment", self.enrollment.name).as_dict()
		save(doc)
		self.assertNotEqual(self._stored("modified"), before)
		self.assertEqual(self._stored("course"), self.free_course.name)

	def test_evaluator_cannot_move_batch_enrollment_to_paid_batch(self):
		batch_enrollment = self._create_batch_enrollment(self.student.email, self.free_batch.name)
		frappe.set_user(self.evaluator.email)
		with self.assertRaises(frappe.CannotChangeConstantError):
			set_value("LMS Batch Enrollment", batch_enrollment.name, "batch", self.paid_batch.name)
		frappe.set_user("Administrator")
		self.assertEqual(
			frappe.db.get_value("LMS Batch Enrollment", batch_enrollment.name, "batch"),
			self.free_batch.name,
		)

	def test_moderator_cannot_reassign_batch_enrollment_member(self):
		batch_enrollment = self._create_batch_enrollment(self.student.email, self.free_batch.name)
		frappe.set_user(self.moderator.email)
		with self.assertRaises(frappe.CannotChangeConstantError):
			set_value("LMS Batch Enrollment", batch_enrollment.name, "member", self.other.email)
		frappe.set_user("Administrator")
		self.assertEqual(
			frappe.db.get_value("LMS Batch Enrollment", batch_enrollment.name, "member"),
			self.student.email,
		)
