# Copyright (c) 2021, FOSS United and Contributors
# See license.txt
import unittest

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSEnrollment(BaseTestUtils):
	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"instr-{hash}@example.com", "Instr", "Test", ["Course Creator", "Moderator"]
		)
		self.course = self._create_course(title=f"Test Course {hash}", instructor=self.instructor.email)
		self.student = self._create_user(f"student-{hash}@example.com", "Student", "Test", ["LMS Student"])

	def test_enrollment_count_increments_on_insert(self):
		initial = frappe.db.get_value("LMS Course", self.course.name, "enrollments") or 0
		self._create_enrollment(self.student.email, self.course.name)
		after = frappe.db.get_value("LMS Course", self.course.name, "enrollments")
		self.assertEqual(after, initial + 1)

	def test_enrollment_count_decrements_on_delete(self):
		enrollment = self._create_enrollment(self.student.email, self.course.name)
		after_insert = frappe.db.get_value("LMS Course", self.course.name, "enrollments")
		frappe.delete_doc("LMS Enrollment", enrollment.name, force=True)
		self.cleanup_items = [
			item for item in self.cleanup_items if item != ("LMS Enrollment", enrollment.name)
		]
		after_delete = frappe.db.get_value("LMS Course", self.course.name, "enrollments")
		self.assertEqual(after_delete, after_insert - 1)
