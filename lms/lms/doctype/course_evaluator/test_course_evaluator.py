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

EVALUATOR_NOWTIME = "lms.lms.doctype.course_evaluator.course_evaluator.nowtime"
REQUEST_NOWTIME = "lms.lms.doctype.lms_certificate_request.lms_certificate_request.nowtime"
EVALUATOR_GETDATE = "lms.lms.doctype.course_evaluator.course_evaluator.getdate"
REQUEST_GETDATE = "lms.lms.doctype.lms_certificate_request.lms_certificate_request.getdate"


def _frozen_getdate(frozen_date):
	"""getdate() with no args means "today"; a midnight rollover mid-test must
	not change it. Forward calls that ask about a specific date untouched."""

	def _getdate(value=None):
		return frozen_date if value is None else getdate(value)

	return _getdate


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

	@patch(EVALUATOR_NOWTIME, return_value="00:00:00")
	def test_schedule_dates(self, _evaluator_nowtime):
		today = getdate()
		with patch(EVALUATOR_GETDATE, side_effect=_frozen_getdate(today)):
			schedule = get_schedule(self.batch.courses[0].course, self.batch.name)
			dates = sorted({getdate(slot.get("date")) for slot in self._slots(schedule)})
		self.assertEqual(dates[0], self.calculated_first_date_of_schedule(today))
		self.assertEqual(dates[-1], self.calculated_last_date_of_schedule(today))

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

	def calculated_first_date_of_schedule(self, today):
		# Only correct while no slot today has started, which is why the caller
		# pins the clock: once one has, the first date also depends on the
		# fixture's unavailable window and this arithmetic no longer models it.
		offset_monday = (0 - today.weekday() + 7) % 7  # 0 for Monday
		offset_wednesday = (2 - today.weekday() + 7) % 7  # 2 for Wednesday
		if offset_monday < offset_wednesday:
			first_date = add_days(today, offset_monday)
		else:
			first_date = add_days(today, offset_wednesday)
		return first_date

	def calculated_last_date_of_schedule(self, today):
		last_day = getdate(get_schedule_range_end_date(today, self.batch.name))
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


class TestTodaysSlots(BaseTestUtils):
	"""get_schedule and LMSCertificateRequest.validate have to agree on which of
	today's slots are still bookable, or the picker offers one and the booking
	throws."""

	def setUp(self):
		super().setUp()
		# Frozen once, up front: get_schedule and LMSCertificateRequest.validate
		# both call getdate() with no args to mean "today", and a midnight
		# rollover mid-test must not let them disagree.
		self.today = getdate()
		for target in (EVALUATOR_GETDATE, REQUEST_GETDATE):
			patcher = patch(target, side_effect=_frozen_getdate(self.today))
			patcher.start()
			self.addCleanup(patcher.stop)
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self.course = self._create_course()
		self.evaluator = self._create_evaluator_working_today()
		self.previous_evaluator = frappe.db.get_value("LMS Course", self.course.name, "evaluator")
		frappe.db.set_value("LMS Course", self.course.name, "evaluator", self.evaluator.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.set_value("LMS Course", self.course.name, "evaluator", self.previous_evaluator)
		super().tearDown()

	def _create_evaluator_working_today(self):
		# Built fresh every run: the schedule is keyed to today's weekday, so a
		# fixture left behind by an earlier day carries the wrong one.
		email = f"today.evaluator.{frappe.generate_hash(length=8)}@example.com"
		self._create_user(email, "Today", "Evaluator", ["Batch Evaluator"])
		evaluator = frappe.new_doc("Course Evaluator")
		evaluator.evaluator = email
		today = self.today.strftime("%A")
		evaluator.append("schedule", {"day": today, "start_time": "09:00:00", "end_time": "10:00:00"})
		evaluator.append("schedule", {"day": today, "start_time": "16:00:00", "end_time": "17:00:00"})
		evaluator.save()
		self.cleanup_items.append(("Course Evaluator", evaluator.name))
		return evaluator

	def _todays_slots(self, schedule):
		today = self.today.strftime("%Y-%m-%d")
		return [slot for row in schedule for slot in row["slots"] if slot["date"] == today]

	def _start_times(self, slots):
		return [format_time(slot["start_time"], "HH:mm:ss") for slot in slots]

	@patch(EVALUATOR_NOWTIME, return_value="12:00:00")
	def test_slot_that_already_started_today_is_not_offered(self, _evaluator_nowtime):
		slots = self._todays_slots(get_schedule(self.course.name))
		self.assertEqual(self._start_times(slots), ["16:00:00"])

	@patch(EVALUATOR_NOWTIME, return_value="16:00:00")
	def test_slot_starting_exactly_now_is_still_offered(self, _evaluator_nowtime):
		slots = self._todays_slots(get_schedule(self.course.name))
		self.assertEqual(self._start_times(slots), ["16:00:00"])

	@patch(EVALUATOR_NOWTIME, return_value="18:00:00")
	def test_no_slots_offered_for_today_once_all_have_started(self, _evaluator_nowtime):
		self.assertEqual(self._todays_slots(get_schedule(self.course.name)), [])

	@patch(REQUEST_NOWTIME, return_value="12:00:00")
	@patch(EVALUATOR_NOWTIME, return_value="12:00:00")
	def test_every_slot_offered_for_today_can_be_booked(self, _evaluator_nowtime, _request_nowtime):
		student = self._create_user(
			f"today.student.{frappe.generate_hash(length=8)}@example.com",
			"Today",
			"Student",
			["LMS Student"],
		)
		frappe.set_user(student.name)

		slots = self._todays_slots(get_schedule(self.course.name))
		self.assertTrue(slots)
		for slot in slots:
			request = frappe.new_doc("LMS Certificate Request")
			request.update(
				{
					"course": self.course.name,
					"date": slot["date"],
					"day": slot["day"],
					"start_time": slot["start_time"],
					"end_time": slot["end_time"],
				}
			)
			request.insert()
			self.cleanup_items.append(("LMS Certificate Request", request.name))


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
