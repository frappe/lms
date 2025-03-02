# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from datetime import timedelta
from frappe.utils import cint, get_datetime, format_date, nowdate, format_time


class LMSLiveClass(Document):
	def after_insert(self):
		calendar = frappe.db.get_value(
			"Google Calendar", {"user": frappe.session.user, "enable": 1}, "name"
		)

		if calendar:
			event = self.create_event()
			self.add_event_participants(event, calendar)
			frappe.db.set_value(self.doctype, self.name, "event", event.name)

	def create_event(self):
		start = f"{self.date} {self.time}"

		event = frappe.get_doc(
			{
				"doctype": "Event",
				"subject": f"Live Class on {self.title}",
				"starts_on": start,
				"ends_on": get_datetime(start) + timedelta(minutes=cint(self.duration)),
			}
		)
		event.save()
		return event

	def add_event_participants(self, event, calendar):
		participants = frappe.get_all(
			"LMS Batch Enrollment", {"batch": self.batch_name}, pluck="member"
		)

		participants.append(frappe.session.user)
		for participant in participants:
			frappe.get_doc(
				{
					"doctype": "Event Participants",
					"reference_doctype": "User",
					"reference_docname": participant,
					"email": participant,
					"parent": event.name,
					"parenttype": "Event",
					"parentfield": "event_participants",
				}
			).save()

		event.reload()
		event.update(
			{
				"sync_with_google_calendar": 1,
				"google_calendar": calendar,
				"description": f"A Live Class has been scheduled on {format_date(self.date, 'medium')} at {format_time(self.time, 'hh:mm a')}. Click on this link to join. {self.join_url}. {self.description}",
			}
		)

		event.save()


def send_live_class_reminder():
	classes = frappe.get_all(
		"LMS Live Class",
		{
			"date": nowdate(),
		},
		["name", "batch_name", "title", "date", "time"],
	)

	for live_class in classes:
		students = frappe.get_all(
			"LMS Batch Enrollment",
			{"batch": live_class.batch_name},
			["member", "member_name"],
		)
		for student in students:
			send_mail(live_class, student)


def send_mail(live_class, student):
	subject = f"Your class on {live_class.title} is tomorrow"
	template = "live_class_reminder"

	args = {
		"student_name": student.member_name,
		"title": live_class.title,
		"date": live_class.date,
		"time": live_class.time,
		"batch_name": live_class.batch_name,
	}

	frappe.sendmail(
		recipients=student.member,
		subject=subject,
		template=template,
		args=args,
		header=[_(f"Class Reminder: {live_class.title}"), "orange"],
	)
