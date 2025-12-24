# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

from datetime import datetime

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_days, get_time, getdate, nowdate

from lms.lms.utils import get_evaluator


class CourseEvaluator(Document):
	def validate(self):
		self.validate_evaluator_role()
		self.validate_time_slots()
		self.validate_unavailability()

	def validate_evaluator_role(self):
		roles = frappe.get_roles(self.evaluator)
		if "Batch Evaluator" not in roles:
			frappe.get_doc("User", self.evaluator).add_roles("Batch Evaluator")

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
def get_schedule(course, batch=None):
	evaluator = get_evaluator(course, batch)
	start_date = nowdate()
	end_date = get_schedule_range_end_date(start_date, batch)
	all_slots = get_all_slots(evaluator, start_date, end_date)
	booked_slots = get_booked_slots(evaluator, start_date, end_date)
	all_slots = remove_booked_slots(all_slots, booked_slots)
	return all_slots


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

	return group_slots_by_date(all_slots)


def group_slots_by_date(all_slots):
	slots_by_date = []
	dates_included = set()
	for slot in all_slots:
		date_str = slot.get("date").strftime("%Y-%m-%d")
		if date_str not in dates_included:
			slots_by_date.append({"date": date_str, "day": slot.day, "slots": []})
			dates_included.add(date_str)

		for date_slot in slots_by_date:
			if date_slot.get("date") == date_str:
				date_slot.get("slots").append(
					{
						"start_time": slot.get("start_time"),
						"end_time": slot.get("end_time"),
					}
				)
	return slots_by_date


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
