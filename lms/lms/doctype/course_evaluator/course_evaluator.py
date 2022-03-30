# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

class CourseEvaluator(Document):

    def validate(self):
        self.validate_time_slots()

    def validate_time_slots(self):
        for schedule in self.schedule:
            if schedule.start_time >= schedule.end_time:
                frappe.throw(_("Start Time cannot be greater than End Time"))

            self.validate_overlaps(schedule)

    def validate_overlaps(self, schedule):
        same_day_slots = list(filter(lambda x: x.day == schedule.day and x.name != schedule.name , self.schedule))
        overlap = False

        for slot in same_day_slots:
            if schedule.start_time < slot.start_time < schedule.end_time:
                overlap = True
            if schedule.start_time < slot.end_time < schedule.end_time:
                overlap = True
            if slot.start_time < schedule.start_time and schedule.end_time < slot.end_time:
                overlap = True

            if overlap:
                frappe.throw(_("Slot Times are overlapping for some schedules."))

@frappe.whitelist()
def get_schedule(course):
    evaluator = frappe.db.get_value("LMS Course", course, "evaluator")
    return frappe.get_all("Evaluator Schedule", filters={"parent": evaluator}, fields=["day", "start_time", "end_time"])
