# Copyright (c) 2021, FOSS United and Contributors
# See license.txt
import unittest

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSEnrollment(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"instr-{hash}@example.com", "Instr", "Test", ["Course Creator", "Moderator"]
		)
		cls.course = cls._create_course(title=f"Test Course {hash}", instructor=cls.instructor.email)

	def _new_student(self):
		# Its own student per test: _create_enrollment dedupes by (course, member),
		# and the shared course means a shared student would find the previous
		# test's enrollment row within the same test if the savepoint rollback
		# ever ran later than expected.
		return self._create_user(
			f"student-{frappe.generate_hash(length=6)}@example.com", "Student", "Test", ["LMS Student"]
		)

	def test_enrollment_count_increments_on_insert(self):
		student = self._new_student()
		initial = frappe.db.get_value("LMS Course", self.course.name, "enrollments") or 0
		self._create_enrollment(student.email, self.course.name)
		after = frappe.db.get_value("LMS Course", self.course.name, "enrollments")
		self.assertEqual(after, initial + 1)

	def test_enrollment_count_decrements_on_delete(self):
		student = self._new_student()
		enrollment = self._create_enrollment(student.email, self.course.name)
		after_insert = frappe.db.get_value("LMS Course", self.course.name, "enrollments")
		frappe.delete_doc("LMS Enrollment", enrollment.name, force=True)
		after_delete = frappe.db.get_value("LMS Course", self.course.name, "enrollments")
		self.assertEqual(after_delete, after_insert - 1)
