import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestAssignmentSelfGrading(BaseTestUtils):
	"""A student must not be able to grade their own assignment submission."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"astud-{hash}@example.com", "Ann", "Student", ["LMS Student"])
		cls.evaluator = cls._create_user(f"aeval-{hash}@example.com", "Eve", "Aluator", ["Batch Evaluator"])
		cls.assignment = cls._create_assignment(title=f"Grade Assignment {hash}")

	def _make_submission(self, user, status="Not Graded"):
		frappe.session.user = user
		try:
			doc = frappe.get_doc(
				{
					"doctype": "LMS Assignment Submission",
					"assignment": self.assignment.name,
					"member": user,
					"answer": "my submission text",
					"status": status,
				}
			)
			doc.insert()
			return doc.name
		finally:
			frappe.session.user = "Administrator"

	def test_student_cannot_pass_own_submission_on_create(self):
		name = self._make_submission(self.student.email, status="Pass")
		self.assertEqual(frappe.db.get_value("LMS Assignment Submission", name, "status"), "Not Graded")

	def test_student_cannot_grade_own_submission_on_update(self):
		name = self._make_submission(self.student.email)
		frappe.session.user = self.student.email
		try:
			doc = frappe.get_doc("LMS Assignment Submission", name)
			doc.status = "Pass"
			doc.comments = "grading myself"
			doc.save()
		finally:
			frappe.session.user = "Administrator"
		self.assertEqual(frappe.db.get_value("LMS Assignment Submission", name, "status"), "Not Graded")

	def test_evaluator_can_grade_submission(self):
		name = self._make_submission(self.student.email)
		frappe.session.user = self.evaluator.email
		try:
			doc = frappe.get_doc("LMS Assignment Submission", name)
			doc.status = "Pass"
			doc.save()
		finally:
			frappe.session.user = "Administrator"
		self.assertEqual(frappe.db.get_value("LMS Assignment Submission", name, "status"), "Pass")
