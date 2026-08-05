# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

from datetime import datetime

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_days, get_time, getdate, nowdate

from lms.lms.utils import (
	convert_from_system_timezone,
	format_timezone,
	get_evaluation_display_timezone,
	get_evaluator,
)


class CourseEvaluator(Document):
	def validate(self):
		self.validate_evaluator_role()
		self.validate_time_slots()
		self.validate_unavailability()

	def on_trash(self):
		# Direct row delete, not User.remove_roles: see validate_evaluator_role.
		frappe.db.delete("Has Role", {"parent": self.evaluator, "role": "Batch Evaluator"})
		frappe.clear_cache(user=self.evaluator)

	def validate_evaluator_role(self):
		"""Being a Course Evaluator *is* holding the Batch Evaluator role.

		Written as a Has Role row rather than `User.add_roles`, which saves the
		whole User document: whenever the session user cannot write User docs
		(every portal Moderator, since LMS only grants them list access), the save
		is dropped and the role silently never lands, leaving an evaluator who
		cannot open their own schedule. lms.lms.api.save_evaluator_role writes
		the row directly for the same reason.
		"""
		if frappe.db.exists("Has Role", {"parent": self.evaluator, "role": "Batch Evaluator"}):
			return

		role = frappe.new_doc("Has Role")
		role.update(
			{
				"parent": self.evaluator,
				"parenttype": "User",
				"parentfield": "roles",
				"role": "Batch Evaluator",
			}
		)
		role.insert(ignore_permissions=True)
		frappe.clear_cache(user=self.evaluator)

	def validate_unavailability(self):
		if (
			self.unavailable_from
			and self.unavailable_to
			and getdate(self.unavailable_from) >= getdate(self.unavailable_to)
		):
			frappe.throw(_("Unavailable From Date cannot be greater than Unavailable To Date"))

	def validate_time_slots(self):
		for schedule in self.schedule:
			if get_time(schedule.start_time) >= get_time(schedule.end_time):
				frappe.throw(_("Start Time cannot be greater than End Time"))

			self.validate_overlaps(schedule)

	def validate_overlaps(self, schedule):
		same_day_slots = list(
			filter(lambda x: x.day == schedule.day and x.name != schedule.name, self.schedule)
		)
		overlap = False

		for slot in same_day_slots:
			if get_time(schedule.start_time) <= get_time(slot.start_time) < get_time(schedule.end_time):
				overlap = True
			if get_time(schedule.start_time) < get_time(slot.end_time) <= get_time(schedule.end_time):
				overlap = True
			if get_time(slot.start_time) < get_time(schedule.start_time) and get_time(
				schedule.end_time
			) < get_time(slot.end_time):
				overlap = True

			if overlap:
				frappe.throw(_("Slot Times are overlapping for some schedules."))


@frappe.whitelist()
def get_schedule(course: str, batch: str = None):
	evaluator = get_evaluator(course, batch)
	start_date = nowdate()
	end_date = get_schedule_range_end_date(start_date, batch)
	all_slots = get_all_slots(evaluator, start_date, end_date)
	booked_slots = get_booked_slots(evaluator, start_date, end_date)
	available = remove_booked_slots(all_slots, booked_slots)
	return group_slots_by_display_date(available, get_evaluation_display_timezone(course, batch))


def get_all_slots(evaluator, start_date, end_date):
	schedule = get_evaluator_schedule(evaluator)
	unavailable_dates = get_unavailable_dates(evaluator)
	all_slots = []
	current_date = getdate(start_date)
	end_date = getdate(end_date)

	while current_date <= end_date:
		if current_date in unavailable_dates:
			current_date = add_days(current_date, 1)
			continue
		day_of_week = current_date.strftime("%A")
		slots_for_day = [x for x in schedule if x.day == day_of_week]
		for slot in slots_for_day:
			all_slots.append(
				frappe._dict(
					{
						"day": day_of_week,
						"date": current_date,
						"start_time": slot.start_time,
						"end_time": slot.end_time,
					}
				)
			)
		current_date = add_days(current_date, 1)
	return all_slots


def get_evaluator_schedule(evaluator):
	return frappe.get_all(
		"Evaluator Schedule",
		filters={
			"parent": evaluator,
		},
		fields=["day", "start_time", "end_time"],
		order_by="start_time",
	)


def get_booked_slots(evaluator, start_date, end_date):
	date = ["between", [start_date, end_date]]
	return frappe.get_all(
		"LMS Certificate Request",
		filters={
			"evaluator": evaluator,
			"date": date,
			"status": ["!=", "Cancelled"],
		},
		fields=["start_time", "day", "date"],
	)


def remove_booked_slots(all_slots, booked_slots):
	slots_to_remove = []
	for slot in all_slots:
		for booked in booked_slots:
			if slot.date == booked.date and slot.start_time == booked.start_time:
				slots_to_remove.append(slot)

	for slot in slots_to_remove:
		all_slots.remove(slot)

	return all_slots


def group_slots_by_display_date(all_slots, timezone):
	"""Group by the date each slot falls on *in the display timezone*.

	Grouping has to happen after conversion, not before: an evaluator's Monday
	09:00 in Asia/Kolkata is Sunday 20:30 in America/Los_Angeles, so a Monday
	schedule row legitimately produces Sunday slots for a US-West batch.

	Each slot carries both clocks. `date`/`start_time`/`end_time` are the system
	values the booking is submitted with. Everything downstream (`validate_slot`,
	past-slot rejection, completion, the calendar event) reads system time.
	`display_*` is what the learner sees. One display group can hold slots from
	two different system dates, so the system date lives on the slot, not the group.
	"""
	groups = {}
	for slot in all_slots:
		display_date, display_start = convert_from_system_timezone(slot.date, slot.start_time, timezone)
		display_end_date, display_end = convert_from_system_timezone(slot.date, slot.end_time, timezone)
		date_str = display_date.strftime("%Y-%m-%d")

		if date_str not in groups:
			groups[date_str] = {
				"display_date": date_str,
				"display_day": display_date.strftime("%A"),
				"display_timezone": timezone,
				"display_timezone_label": format_timezone(
					timezone, datetime.combine(display_date, display_start)
				),
				"slots": [],
			}

		groups[date_str]["slots"].append(
			{
				"date": slot.date.strftime("%Y-%m-%d"),
				"day": slot.day,
				"start_time": slot.start_time,
				"end_time": slot.end_time,
				"display_start_time": display_start.strftime("%H:%M:%S"),
				"display_end_time": display_end.strftime("%H:%M:%S"),
				# A slot that sits inside one system day can straddle midnight once
				# converted: 17:00-19:00 Asia/Kolkata is 23:30-01:30 in
				# Pacific/Auckland. Without this the picker would render
				# "23:30 - 01:30" under one date and say nothing about which day the
				# slot ends on.
				"display_end_date": display_end_date.strftime("%Y-%m-%d"),
			}
		)

	for group in groups.values():
		group["slots"].sort(key=lambda slot: slot["display_start_time"])

	return [groups[date_str] for date_str in sorted(groups)]


def get_evaluator_availability(evaluator):
	return frappe.db.get_value(
		"Course Evaluator", evaluator, ["unavailable_from", "unavailable_to"], as_dict=1
	)


def get_unavailable_dates(evaluator):
	availability = get_evaluator_availability(evaluator)
	unavailable_dates = []
	if availability.unavailable_from and availability.unavailable_to:
		current_date = getdate(availability.unavailable_from)
		end_date = getdate(availability.unavailable_to)

		while current_date <= end_date:
			unavailable_dates.append(current_date)
			current_date = add_days(current_date, 1)
	return unavailable_dates


def get_schedule_range_end_date(start_date, batch=None):
	end_date = add_days(start_date, 60)
	if batch:
		batch_end_date = frappe.db.get_value("LMS Batch", batch, "evaluation_end_date")
		if batch_end_date and batch_end_date < getdate(end_date):
			end_date = getdate(batch_end_date)

	return end_date
