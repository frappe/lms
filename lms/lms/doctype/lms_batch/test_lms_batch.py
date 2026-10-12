# Copyright (c) 2022, Frappe and Contributors
# See license.txt

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.test_helpers import BaseTestUtils


def _new_batch(instructors):
	return frappe.get_doc(
		{
			"doctype": "LMS Batch",
			"title": f"Batch {frappe.generate_hash(length=8)}",
			"start_date": nowdate(),
			"end_date": add_days(nowdate(), 10),
			"start_time": "09:00:00",
			"end_time": "11:00:00",
			"timezone": "Asia/Kolkata",
			"description": "Batch for duplicate instructor tests",
			"batch_details": "Batch for duplicate instructor tests",
			"instructors": [{"instructor": instructor} for instructor in instructors],
		}
	)


class TestLMSBatch(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			f"batch-instructor-{frappe.generate_hash(length=8)}@example.com",
			"Chandru",
			"Batch",
			["Course Creator"],
		)

	def test_single_instructor_is_accepted(self):
		batch = _new_batch([self.instructor.name]).insert()
		self.assertEqual([row.instructor for row in batch.instructors], [self.instructor.name])

	def test_duplicate_instructor_rejected_on_insert(self):
		batch = _new_batch([self.instructor.name, self.instructor.name])
		with self.assertRaisesRegex(frappe.ValidationError, "Chandru Batch"):
			batch.insert()

	def test_duplicate_instructor_rejected_on_save(self):
		batch = _new_batch([self.instructor.name]).insert()
		batch.append("instructors", {"instructor": self.instructor.name})
		with self.assertRaisesRegex(frappe.ValidationError, "Chandru Batch"):
			batch.save()
