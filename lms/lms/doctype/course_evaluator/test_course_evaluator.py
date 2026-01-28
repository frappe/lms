# Copyright (c) 2022, Frappe and Contributors
# See license.txt

from frappe.utils import add_days, format_time, getdate

from lms.lms.doctype.course_evaluator.course_evaluator import get_schedule, get_schedule_range_end_date
from lms.lms.test_helpers import BaseTestUtils


class TestCourseEvaluator(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.admin = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		self.course = self._create_course()
		self.evaluator = self._create_evaluator()
		self.batch = self._create_batch(self.course.name)

	def test_schedule_day_and_time(self):
		schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
		days = ["Monday", "Wednesday"]
		self.assertGreaterEqual(len(schedule), 14)
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

	def test_schedule_dates(self):
		schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
		first_date = self.calculated_first_date_of_schedule()
		last_date = self.calculated_last_date_of_schedule()
		self.assertEqual(getdate(schedule[0].get("date")), first_date)
		self.assertEqual(getdate(schedule[-1].get("date")), last_date)

	def calculated_first_date_of_schedule(self):
		today = getdate()
		offset_monday = (0 - today.weekday() + 7) % 7  # 0 for Monday
		offset_wednesday = (2 - today.weekday() + 7) % 7  # 2 for Wednesday
		if offset_monday < offset_wednesday:
			first_date = add_days(today, offset_monday)
		else:
			first_date = add_days(today, offset_wednesday)
		return first_date

	def calculated_last_date_of_schedule(self):
		last_day = getdate(get_schedule_range_end_date(getdate(), self.batch.name))
		while last_day.weekday() not in (0, 2):
			last_day = add_days(last_day, -1)

		return last_day

	def test_unavailability_dates(self):
		unavailable_from = getdate(self.evaluator.unavailable_from)
		unavailable_to = getdate(self.evaluator.unavailable_to)
		schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
		for row in schedule:
			schedule_date = getdate(row.get("date"))
			self.assertFalse(unavailable_from < schedule_date < unavailable_to)
