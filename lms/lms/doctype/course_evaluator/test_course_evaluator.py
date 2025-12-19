# Copyright (c) 2022, Frappe and Contributors
# See license.txt

# import frappe
from frappe.tests import UnitTestCase
from frappe.utils import format_time

from lms.lms.doctype.course_evaluator.course_evaluator import get_schedule
from lms.lms.test_utils import TestUtils


class TestCourseEvaluator(UnitTestCase):
	def setUp(self):
		self.admin = TestUtils.create_user(
			self, "frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		self.course = TestUtils.create_a_course(self)

		self.evaluator = TestUtils.create_evaluator(self)
		self.batch = TestUtils.create_a_batch(self)

	def test_schedule(self):
		schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
		days = ["Monday", "Wednesday"]
		self.assertGreaterEqual(len(schedule), 16)
		for row in schedule:
			self.assertIn(row.get("day"), days)
			if row.get("day") == "Monday":
				for slot in row.get("slots"):
					self.assertEqual(format_time(slot.get("start_time"), "HH:mm:ss"), "10:00:00")
					self.assertEqual(format_time(slot.get("end_time"), "HH:mm:ss"), "12:00:00")
			if row.get("day") == "Wednesday":
				for slot in row.get("slots"):
					self.assertEqual(format_time(slot.get("start_time"), "HH:mm:ss"), "14:00:00")
					self.assertEqual(format_time(slot.get("end_time"), "HH:mm:ss"), "16:00:00")
