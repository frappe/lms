# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

from datetime import timedelta

import frappe
import requests
from frappe import _
from frappe.model.document import Document
from frappe.query_builder import Bracket
from frappe.utils import cint, format_date, format_time, get_datetime, nowdate
from pypika.terms import LiteralValue

from lms.lms.doctype.lms_batch.lms_batch import authenticate
from lms.lms.permissions import authored_batch_condition, can_author_batch, is_site_administrator


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

	def after_delete(self):
		# The event is private, so only its creator may delete it directly. Whoever may
		# delete the live class may remove its event with it, as _update_linked_event
		# already saves it on their behalf.
		if self.event:
			frappe.delete_doc("Event", self.event, force=True, ignore_permissions=True)

	def get_hosts(self):
		"""Whoever scheduled the class, its host, and the batch's instructors."""
		instructors = frappe.get_all(
			"Course Instructor", {"parenttype": "LMS Batch", "parent": self.batch_name}, pluck="instructor"
		)
		hosts = {frappe.session.user, *instructors}
		if self.host:
			hosts.add(self.host)
		return list(hosts)

	def get_learners(self):
		return frappe.get_all("LMS Batch Enrollment", {"batch": self.batch_name}, pluck="member")

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
		event.description = self.build_event_description()

		event.save(ignore_permissions=True)

	def create_calendar_event(self):
		# Only Google Meet needs a calendar event: Google creates the Meet link on one.
		# Zoom brings its own link, so a Zoom class needs no calendar at all.
		if self.conferencing_provider != "Google Meet":
			return

		calendar = frappe.db.get_value(
			"LMS Google Meet Settings", self.google_meet_account, "google_calendar"
		)
		if not calendar:
			frappe.throw(
				_("Connect a Google Calendar to this Google Meet account to schedule Google Meet classes.")
			)

		# Learners are invited so they can join the Meet directly, but one shared
		# invite shows every guest to every other guest. So the event goes to Google
		# with the hosts alone, the guest list is hidden there, and only then are the
		# learners added: their invites go out with no one else's address on them.
		event = self.create_event()
		frappe.db.set_value(self.doctype, self.name, "event", event.name)
		add_event_participants(event, self.get_hosts())
		self.sync_with_google_calendar(event, calendar)
		self.add_video_conferencing_to_event(event)
		# If the guest list could not be hidden, learners stay off the invite: they
		# still have the link in LMS and its reminder mail, and no one is exposed.
		if hide_guest_list(event, calendar):
			invite_to_event(event, set(self.get_learners()) - set(self.get_hosts()))

	def create_event(self):
		start = f"{self.date} {self.time}"

		event = frappe.new_doc("Event")
		event.update(
			{
				"doctype": "Event",
				"subject": f"Live Class on {self.title}",
				# Private, with no Frappe reminder: a public event lands in every staff
				# member's daily event digest, and LMS sends its own class reminders.
				"event_type": "Private",
				"send_reminder": 0,
				"starts_on": start,
				"ends_on": get_datetime(start) + timedelta(minutes=cint(self.duration)),
			}
		)

		event.save()
		return event

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


def add_event_participants(event, emails):
	for email in emails:
		frappe.get_doc(
			{
				"doctype": "Event Participants",
				"reference_doctype": "User",
				"reference_docname": email,
				"email": email,
				"parent": event.name,
				"parenttype": "Event",
				"parentfield": "event_participants",
			}
		).insert(ignore_permissions=True)


def invite_to_event(event, emails):
	"""Add guests and save the event, so Frappe pushes them to Google, which sends
	their invites. Adding the rows alone never reaches Google."""
	emails = list(emails)
	if not emails:
		return
	add_event_participants(event, emails)
	event.reload()
	event.save(ignore_permissions=True)


def hide_guest_list(event, calendar) -> bool:
	"""Stop guests seeing, or inviting, the other guests. Frappe's own sync has no
	setting for this, but it edits Google's copy of the event in place on every
	update, so a setting made here stays. Returns whether it was hidden."""
	from frappe.integrations.doctype.google_calendar.google_calendar import get_google_calendar_object

	event.reload()
	if not event.google_calendar_event_id:
		return False
	try:
		google_calendar, _account = get_google_calendar_object(calendar)
		google_calendar.events().patch(
			calendarId=event.google_calendar_id,
			eventId=event.google_calendar_event_id,
			body={"guestsCanSeeOtherGuests": False, "guestsCanInviteOthers": False},
		).execute()
	except Exception:
		frappe.log_error(title=f"Could not hide the guest list of live class event {event.name}")
		return False
	return True


def add_learner_to_live_classes(batch, member):
	"""Invite a learner who joins the batch to its upcoming Google Meet classes."""
	events = frappe.get_all(
		"LMS Live Class",
		{
			"batch_name": batch,
			# Only Google Meet classes get calendar events now; a Zoom class's event
			# from before was never made private, so it gets no new guests.
			"conferencing_provider": "Google Meet",
			"event": ["is", "set"],
			"date": [">=", nowdate()],
		},
		pluck="event",
	)
	# A calendar failure must not undo the enrollment; the learner still has the
	# class's link in LMS and its reminder mail. Muted: Frappe's own sync reports to
	# whoever saved, here the enrolling learner, who should not see it.
	muted = frappe.flags.mute_messages
	frappe.flags.mute_messages = True
	try:
		for event_name in events:
			if frappe.db.exists("Event Participants", {"parent": event_name, "email": member}):
				continue
			event = frappe.get_doc("Event", event_name)
			# Hidden again before every invite: it may have failed when the class was
			# made, or the event may predate this, and then the invite would show the
			# learner every other guest.
			if not hide_guest_list(event, event.google_calendar):
				continue
			try:
				invite_to_event(event, [member])
			except Exception:
				frappe.log_error(title=f"Could not invite {member} to live class event {event_name}")
	finally:
		frappe.flags.mute_messages = muted


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
	if "Moderator" in roles:
		return True

	if ptype not in ("read", "select", "print"):
		if not can_author_batch(doc.batch_name, user=user):
			return False
		# Authorise the stored batch too, or a submitted batch_name moves the class.
		stored = None if doc.is_new() else frappe.db.get_value("LMS Live Class", doc.name, "batch_name")
		return not stored or can_author_batch(stored, user=user)

	# "Batch Evaluator" keeps its existing blanket read; any other tagged
	# instructor/evaluator (e.g. Course Creator) is scoped to their own batch.
	if "Batch Evaluator" in roles or can_author_batch(doc.batch_name, user=user):
		return True

	return frappe.db.exists(
		"LMS Batch Enrollment",
		{"batch": doc.batch_name, "member": user},
	)


def get_permission_query_conditions(user=None):
	"""List-read counterpart of has_permission above.

	has_permission is never consulted on a list or report query, so without this
	the enrolment check is enforced on the single-doc read and dropped on the
	list read — which is how every batch's Zoom `start_url` was readable by any
	authenticated user.
	"""
	user = user or frappe.session.user
	if is_site_administrator(user):
		return ""

	roles = frappe.get_roles(user)
	if "Moderator" in roles or "Batch Evaluator" in roles:
		return ""

	live_class = frappe.qb.DocType("LMS Live Class")
	enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	member = LiteralValue(frappe.db.escape(user))
	enrolled = frappe.qb.from_(enrollment).select(enrollment.batch).where(enrollment.member == member)
	condition = Bracket(
		live_class.batch_name.isin(enrolled) | authored_batch_condition(live_class.batch_name, user)
	)
	return condition.get_sql(with_namespace=True, quote_char="`" if frappe.db.db_type == "mariadb" else '"')
