import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestEnrollmentFieldGuard(BaseTestUtils):
	"""A student must not be able to write the server-managed progress /
	purchased_certificate fields on their own enrollment
	(VULN-2026-FRAPPE-LMS-009, -010)."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"efstud-{hash}@example.com", "Eli", "Student", ["LMS Student"])
		cls.moderator = cls._create_user(f"efmod-{hash}@example.com", "Mac", "Derator", ["Moderator"])
		cls.course = cls._create_course(title=f"Guard Course {hash}", instructor=cls.moderator.email)
		cls.enrollment = cls._create_enrollment(cls.student.email, cls.course.name)

	def _as(self, user, mutate):
		frappe.session.user = user
		try:
			doc = frappe.get_doc("LMS Enrollment", self.enrollment.name)
			mutate(doc)
			doc.save()
		finally:
			frappe.session.user = "Administrator"

	def _stored(self, field):
		return frappe.db.get_value("LMS Enrollment", self.enrollment.name, field)

	def test_student_cannot_set_progress(self):
		def mutate(doc):
			doc.progress = 100

		self._as(self.student.email, mutate)
		self.assertEqual(self._stored("progress"), 0)

	def test_student_cannot_set_purchased_certificate(self):
		def mutate(doc):
			doc.purchased_certificate = 1

		self._as(self.student.email, mutate)
		self.assertEqual(self._stored("purchased_certificate"), 0)

	def test_moderator_can_set_progress(self):
		def mutate(doc):
			doc.progress = 100

		self._as(self.moderator.email, mutate)
		self.assertEqual(self._stored("progress"), 100)

	def test_server_side_set_value_still_writes_progress(self):
		# The legitimate write path (update_enrollment / update_certificate_purchase) uses
		# frappe.db.set_value, which bypasses validate() and must remain unaffected.
		frappe.db.set_value("LMS Enrollment", self.enrollment.name, "progress", 55)
		self.assertEqual(self._stored("progress"), 55)
