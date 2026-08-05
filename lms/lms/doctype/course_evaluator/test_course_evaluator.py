# Copyright (c) 2022, Frappe and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase
from frappe.utils import add_days, format_time, getdate, to_timedelta

from lms.lms.api import save_role
from lms.lms.doctype.course_evaluator.course_evaluator import (
	get_schedule,
	get_schedule_range_end_date,
	group_slots_by_display_date,
)
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

	def _slots(self, schedule):
		"""Every slot, flattened. Groups are keyed by *display* date, so nothing
		timezone-independent can be asserted about them; the system values each
		slot carries are what the booking is made of."""
		return [slot for row in schedule for slot in row.get("slots")]

	def test_schedule_day_and_time(self):
		schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
		days = ["Monday", "Wednesday"]
		self.assertGreaterEqual(len(schedule), 14)
		for slot in self._slots(schedule):
			self.assertIn(slot.get("day"), days)
			if slot.get("day") == "Monday":
				self.assertEqual(format_time(slot.get("start_time"), "HH:mm:ss"), "10:00:00")
				self.assertEqual(format_time(slot.get("end_time"), "HH:mm:ss"), "12:00:00")
			if slot.get("day") == "Wednesday":
				self.assertEqual(format_time(slot.get("start_time"), "HH:mm:ss"), "14:00:00")
				self.assertEqual(format_time(slot.get("end_time"), "HH:mm:ss"), "16:00:00")

	def test_schedule_dates(self):
		schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
		dates = sorted({getdate(slot.get("date")) for slot in self._slots(schedule)})
		self.assertEqual(dates[0], self.calculated_first_date_of_schedule())
		self.assertEqual(dates[-1], self.calculated_last_date_of_schedule())

	def test_every_slot_carries_both_clocks(self):
		# The booking submits the system values; the picker renders the display
		# ones. A slot missing either is unbookable or unlabelled.
		for slot in self._slots(get_schedule(self.batch.courses[0].course, self.batch.name)):
			for field in ("date", "day", "start_time", "end_time"):
				self.assertIsNotNone(slot.get(field))
			for field in ("display_start_time", "display_end_time"):
				self.assertRegex(slot.get(field), r"^\d{2}:\d{2}:\d{2}$")

	def test_groups_are_labelled_with_the_display_timezone(self):
		frappe.db.set_value("LMS Batch", self.batch.name, "timezone", "Europe/Berlin")
		schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
		for row in schedule:
			self.assertEqual(row.get("display_timezone"), "Europe/Berlin")
			self.assertTrue(row.get("display_timezone_label").startswith("Europe/Berlin (GMT"))

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
		for slot in self._slots(schedule):
			schedule_date = getdate(slot.get("date"))
			self.assertFalse(unavailable_from < schedule_date < unavailable_to)


@patch("lms.lms.utils.get_system_timezone", return_value="Asia/Kolkata")
class TestSlotGrouping(UnitTestCase):
	"""Grouping runs after conversion, so a schedule row's day is not the day the
	learner sees it on."""

	def _slot(self, date, start, end, day):
		return frappe._dict(
			{
				"day": day,
				"date": getdate(date),
				"start_time": to_timedelta(start),
				"end_time": to_timedelta(end),
			}
		)

	def test_slots_stay_put_within_the_same_zone(self, _system_timezone):
		groups = group_slots_by_display_date(
			[self._slot("2026-08-03", "10:00:00", "12:00:00", "Monday")], "Asia/Kolkata"
		)
		self.assertEqual(len(groups), 1)
		self.assertEqual(groups[0]["display_date"], "2026-08-03")
		self.assertEqual(groups[0]["display_day"], "Monday")
		self.assertEqual(groups[0]["slots"][0]["display_start_time"], "10:00:00")

	def test_monday_slots_land_on_sunday_for_us_west(self, _system_timezone):
		groups = group_slots_by_display_date(
			[self._slot("2026-08-03", "09:00:00", "10:00:00", "Monday")], "America/Los_Angeles"
		)
		self.assertEqual(groups[0]["display_date"], "2026-08-02")
		self.assertEqual(groups[0]["display_day"], "Sunday")
		self.assertEqual(groups[0]["display_timezone_label"], "America/Los_Angeles (GMT-7:00)")

		slot = groups[0]["slots"][0]
		self.assertEqual(slot["display_start_time"], "20:30:00")
		# Untouched: this is what the booking submits.
		self.assertEqual(slot["date"], "2026-08-03")
		self.assertEqual(slot["day"], "Monday")

	def test_one_display_day_can_hold_two_system_dates(self, _system_timezone):
		groups = group_slots_by_display_date(
			[
				self._slot("2026-08-03", "09:00:00", "10:00:00", "Monday"),
				self._slot("2026-08-02", "23:00:00", "23:30:00", "Sunday"),
			],
			"America/Los_Angeles",
		)
		self.assertEqual(len(groups), 1)
		self.assertEqual(groups[0]["display_date"], "2026-08-02")
		self.assertEqual([slot["date"] for slot in groups[0]["slots"]], ["2026-08-02", "2026-08-03"])
		# Sorted by what is rendered, not by what is stored.
		self.assertEqual(
			[slot["display_start_time"] for slot in groups[0]["slots"]],
			["10:30:00", "20:30:00"],
		)

	def test_label_follows_dst_across_the_range(self, _system_timezone):
		# America/Santiago flips GMT-4 -> GMT-3 in September.
		groups = group_slots_by_display_date(
			[
				self._slot("2026-08-03", "12:00:00", "13:00:00", "Monday"),
				self._slot("2026-10-05", "12:00:00", "13:00:00", "Monday"),
			],
			"America/Santiago",
		)
		labels = [row["display_timezone_label"] for row in groups]
		self.assertEqual(labels, ["America/Santiago (GMT-4:00)", "America/Santiago (GMT-3:00)"])

	def test_end_carries_its_own_display_date_when_it_crosses_midnight(self, _system_timezone):
		# 17:00-19:00 Asia/Kolkata is 23:30-01:30 in Pacific/Auckland: the slot sits
		# inside one system day but straddles midnight once converted, so the end
		# needs its own date or the picker cannot say which day it finishes on.
		groups = group_slots_by_display_date(
			[self._slot("2026-08-03", "17:00:00", "19:00:00", "Monday")], "Pacific/Auckland"
		)
		self.assertEqual(groups[0]["display_date"], "2026-08-03")

		slot = groups[0]["slots"][0]
		self.assertEqual(slot["display_start_time"], "23:30:00")
		self.assertEqual(slot["display_end_time"], "01:30:00")
		self.assertEqual(slot["display_end_date"], "2026-08-04")

	def test_end_date_matches_the_group_when_it_does_not_cross_midnight(self, _system_timezone):
		groups = group_slots_by_display_date(
			[self._slot("2026-08-03", "09:00:00", "10:00:00", "Monday")], "America/Los_Angeles"
		)
		slot = groups[0]["slots"][0]
		self.assertEqual(slot["display_end_date"], groups[0]["display_date"])

	def test_legacy_free_text_zone_labels_without_converting(self, _system_timezone):
		groups = group_slots_by_display_date(
			[self._slot("2026-08-03", "10:00:00", "12:00:00", "Monday")], "IST (GMT+5:30)"
		)
		self.assertEqual(groups[0]["display_date"], "2026-08-03")
		self.assertEqual(groups[0]["display_timezone_label"], "IST (GMT+5:30)")
		self.assertEqual(groups[0]["slots"][0]["display_start_time"], "10:00:00")


class TestEvaluatorRoleCRUD(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.admin = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		self.test_user = self._create_user("eval_test@example.com", "Eval", "Tester", ["LMS Student"])

	def _has_batch_evaluator_role(self, user):
		return frappe.db.exists("Has Role", {"parent": user, "role": "Batch Evaluator"})

	def _has_course_evaluator(self, user):
		return frappe.db.exists("Course Evaluator", {"evaluator": user})

	def test_add_evaluator_role_creates_both(self):
		"""save_role with value=1 should create Has Role AND Course Evaluator."""
		frappe.set_user("frappe@example.com")
		save_role(self.test_user.email, "Batch Evaluator", 1)
		frappe.set_user("Administrator")

		self.assertTrue(self._has_batch_evaluator_role(self.test_user.email))
		self.assertTrue(self._has_course_evaluator(self.test_user.email))

		self.cleanup_items.append(("Course Evaluator", self.test_user.email))

	def test_remove_evaluator_role_removes_both(self):
		"""save_role with value=0 should remove Has Role AND Course Evaluator."""
		frappe.set_user("frappe@example.com")
		save_role(self.test_user.email, "Batch Evaluator", 1)
		save_role(self.test_user.email, "Batch Evaluator", 0)
		frappe.set_user("Administrator")

		self.assertFalse(self._has_batch_evaluator_role(self.test_user.email))
		self.assertFalse(self._has_course_evaluator(self.test_user.email))

	def test_remove_evaluator_role_no_error_when_missing(self):
		"""Removing role that doesn't exist should not raise an error."""
		frappe.set_user("frappe@example.com")
		save_role(self.test_user.email, "Batch Evaluator", 0)
		frappe.set_user("Administrator")

		self.assertFalse(self._has_batch_evaluator_role(self.test_user.email))

	def test_reject_non_lms_role(self):
		"""Assigning a role outside LMS_ROLES should raise PermissionError."""
		frappe.set_user("frappe@example.com")
		self.assertRaises(frappe.PermissionError, save_role, self.test_user.email, "System Manager", 1)
		frappe.set_user("Administrator")

	def test_non_moderator_cannot_save_role(self):
		"""[A non-moderator user should not be able to assign roles.]"""
		frappe.set_user(self.test_user.email)
		self.assertRaises(frappe.PermissionError, save_role, self.test_user.email, "Course Creator", 1)
		frappe.set_user("Administrator")
