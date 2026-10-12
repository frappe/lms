# Copyright (c) 2025, Frappe and Contributors
# See license.txt

import frappe
from frappe.tests import UnitTestCase

from lms.lms.test_helpers import BaseTestUtils

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class UnitTestLMSBatchEnrollment(UnitTestCase):
	"""
	Unit tests for LMSBatchEnrollment.
	Use this class for testing individual functions and methods.
	"""

	pass


class IntegrationTestLMSBatchEnrollment(BaseTestUtils):
	"""
	Integration tests for LMSBatchEnrollment.
	Use this class for testing interactions between multiple components.
	"""

	def test_restricted_course_enrollment_syncs_on_insert_and_later_save(self):
		instructor = self._create_user(
			f"batch-instructor-{frappe.generate_hash(length=8)}@example.com",
			"Batch",
			"Instructor",
			["Course Creator"],
		)
		evaluator = self._create_evaluator(instructor.email)
		course = self._create_course(
			title=f"Restricted Batch Course {frappe.generate_hash(length=8)}",
			instructor=instructor.email,
		)
		course.disable_self_learning = 1
		course.save()

		batch = self._create_batch(
			course.name,
			instructor=instructor.email,
			evaluator=evaluator.name,
			title=f"Self Enrollable Batch {frappe.generate_hash(length=8)}",
		)
		batch.allow_self_enrollment = 1
		batch.save()

		student = self._create_user(
			f"batch-student-{frappe.generate_hash(length=8)}@example.com",
			"Batch",
			"Student",
			["LMS Student"],
		)
		frappe.set_user(student.name)

		direct_enrollment = frappe.new_doc("LMS Enrollment")
		direct_enrollment.update({"course": course.name, "member": student.name})
		with self.assertRaisesRegex(frappe.ValidationError, "self-learning is disabled"):
			direct_enrollment.insert()

		batch_enrollment = frappe.new_doc("LMS Batch Enrollment")
		batch_enrollment.update({"batch": batch.name, "member": student.name})
		batch_enrollment.insert()
		course_enrollment = frappe.db.get_value(
			"LMS Enrollment", {"course": course.name, "member": student.name}, "name"
		)
		self.assertTrue(course_enrollment)

		frappe.set_user("Administrator")
		frappe.delete_doc("LMS Enrollment", course_enrollment, force=True)
		batch_enrollment.save()

		self.assertTrue(
			frappe.db.exists("LMS Enrollment", {"course": course.name, "member": student.name})
		)
