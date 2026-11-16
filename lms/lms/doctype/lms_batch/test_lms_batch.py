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

	def _reloaded_batch(self, **values):
		"""Read back from the database, so its dates are date objects."""
		batch = _new_batch([self.instructor.name])
		batch.update(values)
		batch.insert()
		return frappe.get_doc("LMS Batch", batch.name)

	# Regression: date vs str TypeError on a partial batch update (#3029, fixed in #3044).
	def test_end_date_sent_as_a_string_is_checked_against_the_evaluation_end_date(self):
		batch = self._reloaded_batch(evaluation_end_date=add_days(nowdate(), 20))

		batch.end_date = add_days(nowdate(), 15)
		batch.save()

		batch.end_date = add_days(nowdate(), 25)
		with self.assertRaisesRegex(frappe.ValidationError, "Evaluation end date"):
			batch.save()

	def test_start_date_sent_as_a_string_is_checked_against_the_end_date(self):
		batch = self._reloaded_batch()

		batch.start_date = add_days(nowdate(), 1)
		batch.save()

		batch.start_date = add_days(nowdate(), 11)
		with self.assertRaisesRegex(frappe.ValidationError, "end date cannot be before"):
			batch.save()

	def test_batch_dates_sent_as_strings_are_checked_against_the_timetable(self):
		batch = self._reloaded_batch(timetable=[{"date": add_days(nowdate(), 5)}])

		batch.update({"start_date": add_days(nowdate(), 1), "end_date": add_days(nowdate(), 9)})
		batch.save()

		batch.update({"start_date": add_days(nowdate(), 1), "end_date": add_days(nowdate(), 4)})
		with self.assertRaisesRegex(frappe.ValidationError, "Date cannot be outside"):
			batch.save()
