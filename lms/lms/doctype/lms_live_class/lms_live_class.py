# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

from datetime import timedelta

import frappe
import requests
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, format_date, format_time, get_datetime, nowdate

from lms.lms.doctype.lms_batch.lms_batch import authenticate


class LMSLiveClass(Document):
	def after_insert(self):
		self.create_calendar_event()

	def on_update(self):
		if not self.event:
			return

		if (
			not self.has_value_changed("date")
			and not self.has_value_changed("time")
			and not self.has_value_changed("duration")
			and not self.has_value_changed("title")
		):
			return

		self._update_linked_event()

	def on_trash(self):
		if self.event and frappe.db.exists("Event", self.event):
			frappe.delete_doc("Event", self.event, ignore_permissions=True)

	def get_participants(self):
		participants = frappe.get_all("LMS Batch Enrollment", {"batch": self.batch_name}, pluck="member")
		instructors = frappe.get_all(
			"Course Instructor", {"parenttype": "LMS Batch", "parent": self.batch_name}, pluck="instructor"
		)
		participants.append(frappe.session.user)
		participants.extend(instructors)
		return list(set(participants))

	def build_event_description(self):
		description = f"A Live Class has been scheduled on {format_date(self.date, 'medium')} at {format_time(self.time, 'hh:mm a')}."
		if self.join_url:
			description += f" Click on this link to join. {self.join_url}. \n\n"
		if self.description:
			description += f"{self.description}"
		return description

	def _update_linked_event(self):
		event = frappe.get_doc("Event", self.event)
		start = f"{self.date} {self.time}"

		event.subject = f"Live Class on {self.title}"
		event.starts_on = start
		event.ends_on = get_datetime(start) + timedelta(minutes=cint(self.duration))
		event.description = self._build_event_description()

		event.save(ignore_permissions=True)

	def create_calendar_event(self):
		if self.conferencing_provider == "Google Meet":
			calendar = frappe.db.get_value(
				"LMS Google Meet Settings", self.google_meet_account, "google_calendar"
			)
		else:
			calendar = frappe.db.get_value(
				"Google Calendar", {"user": frappe.session.user, "enable": 1}, "name"
			)

		if not calendar:
			frappe.throw(
				_(
					"No calendar is configured for the conferencing provider. Please set up a calendar to create events."
				)
			)

		if calendar:
			event = self.create_event()
			frappe.db.set_value(self.doctype, self.name, "event", event.name)
			self.add_event_participants(event, calendar)
			self.sync_with_google_calendar(event, calendar)

			if self.conferencing_provider == "Google Meet":
				self.add_video_conferencing_to_event(event)

	def create_event(self):
		start = f"{self.date} {self.time}"

		event = frappe.new_doc("Event")
		event.update(
			{
				"doctype": "Event",
				"subject": f"Live Class on {self.title}",
				"event_type": "Public",
				"starts_on": start,
				"ends_on": get_datetime(start) + timedelta(minutes=cint(self.duration)),
				"reference_doctype": self.doctype,
				"reference_docname": self.name,
			}
		)

		event.save()
		return event

	def add_event_participants(self, event, calendar, add_video_conferencing=False):
		for participant in self.get_participants():
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

	def sync_with_google_calendar(self, event, calendar):
		event.reload()
		update_data = {
			"sync_with_google_calendar": 1,
			"google_calendar": calendar,
			"description": self.build_event_description(),
		}
		event.update(update_data)
		event.save()

	def add_video_conferencing_to_event(self, event):
		event.reload()
		event.update(
			{
				"add_video_conferencing": 1,
			}
		)
		event.save()
		event.reload()
		google_meet_link = event.google_meet_link
		if google_meet_link:
			frappe.db.set_value(
				self.doctype,
				self.name,
				{
					"start_url": google_meet_link,
					"join_url": google_meet_link,
				},
			)


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
	subject = _("Your class on {0} is today").format(live_class.title)
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


def update_attendance():
	past_live_classes = frappe.get_all(
		"LMS Live Class",
		{
			"uuid": ["is", "set"],
			"attendees": ["is", "not set"],
			"conferencing_provider": ["!=", "Google Meet"],
		},
		["name", "uuid", "zoom_account"],
	)

	for live_class in past_live_classes:
		attendance_data = get_attendance(live_class)
		create_attendance(live_class, attendance_data)
		update_attendees_count(live_class, attendance_data)


def get_attendance(live_class):
	headers = {
		"Authorization": "Bearer " + authenticate(live_class.zoom_account),
		"content-type": "application/json",
	}

	encoded_uuid = requests.utils.quote(live_class.uuid, safe="")
	response = requests.get(
		f"https://api.zoom.us/v2/past_meetings/{encoded_uuid}/participants", headers=headers
	)

	if response.status_code != 200:
		frappe.throw(
			_("Failed to fetch attendance data from Zoom for class {0}: {1}").format(
				live_class, response.text
			)
		)

	data = response.json()
	return data.get("participants", [])


def create_attendance(live_class, data):
	for participant in data:
		doc = frappe.new_doc("LMS Live Class Participant")
		doc.live_class = live_class.name
		doc.member = participant.get("user_email")
		doc.joined_at = get_datetime(participant.get("join_time"))
		doc.left_at = get_datetime(participant.get("leave_time"))
		doc.duration = get_minutes(participant.get("duration"))
		doc.insert()


def update_attendees_count(live_class, data):
	frappe.db.set_value("LMS Live Class", live_class.name, "attendees", len(data))


def get_minutes(duration_in_seconds):
	if duration_in_seconds:
		return int(duration_in_seconds) // 60
	return 0


def has_permission(doc, ptype="read", user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if "Moderator" in roles or "Batch Evaluator" in roles:
		return True

	if ptype not in ("read", "select", "print"):
		return False

	return frappe.db.exists(
		"LMS Batch Enrollment",
		{"batch": doc.batch_name, "member": user},
	)
