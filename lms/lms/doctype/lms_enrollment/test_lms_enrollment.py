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
		# For the ownership rules: a member is the caller unless the caller
		# manages the course.
		cls.student_a = cls._create_user(f"student-a-{hash}@example.com", "Student", "Alpha", ["LMS Student"])
		cls.student_b = cls._create_user(f"student-b-{hash}@example.com", "Student", "Bravo", ["LMS Student"])
		cls.moderator = cls._create_user(f"mod-{hash}@example.com", "Mod", "Erator", ["Moderator"])
		cls.course_instructor = cls._create_user(
			f"course-instr-{hash}@example.com", "Only", "Instr", ["Course Creator"]
		)
		cls.other_creator = cls._create_user(
			f"other-creator-{hash}@example.com", "Other", "Creator", ["Course Creator"]
		)
		cls.instructed_course = cls._create_course(
			title=f"Instructed Course {hash}", instructor=cls.course_instructor.email
		)

	def _new_doc(self, member, course=None):
		doc = frappe.new_doc("LMS Enrollment")
		doc.course = course or self.course.name
		doc.member = member
		return doc

	def test_a_student_enrols_only_themselves(self):
		frappe.set_user(self.student_a.name)
		with self.assertRaises(frappe.PermissionError):
			self._new_doc(self.student_b.name).insert()
		doc = self._new_doc(self.student_a.name).insert()
		self.assertEqual(doc.member, self.student_a.name)
		self.assertEqual(doc.owner, self.student_a.name)

	def test_a_moderator_enrols_anyone(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_doc(self.student_b.name).insert()
		self.assertEqual(doc.member, self.student_b.name)

	def test_an_instructor_enrols_a_student_in_their_course_only(self):
		frappe.set_user(self.course_instructor.name)
		doc = self._new_doc(self.student_b.name, self.instructed_course.name).insert()
		self.assertEqual(doc.member, self.student_b.name)
		self.assertEqual(doc.owner, self.student_b.name)

		# Holding Course Creator is not teaching this course.
		frappe.set_user(self.other_creator.name)
		with self.assertRaises(frappe.PermissionError):
			self._new_doc(self.student_a.name, self.instructed_course.name).insert()

	def _new_student(self):
		# Its own student per test: _create_enrollment dedupes by (course, member), and
		# the course is shared, so a shared student would find the previous test's row.
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
