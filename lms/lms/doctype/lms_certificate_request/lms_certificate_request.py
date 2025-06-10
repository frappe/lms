# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import (
	format_date,
	format_time,
	getdate,
	add_to_date,
	get_datetime,
	nowtime,
	get_time,
	get_fullname,
)
from lms.lms.utils import get_evaluator
import json


class LMSCertificateRequest(Document):
	def validate(self):
		self.set_evaluator()
		self.validate_unavailability()
		self.validate_slot()
		self.validate_if_existing_requests()
		self.validate_evaluation_end_date()

	def after_insert(self):
		self.send_notification()

	def set_evaluator(self):
		if not self.evaluator:
			self.evaluator = get_evaluator(self.course, self.batch_name)
			self.evaluator_name = get_fullname(self.evaluator)

	def validate_unavailability(self):
		if self.evaluator:
			unavailable = frappe.db.get_value(
				"Course Evaluator",
				self.evaluator,
				["unavailable_from", "unavailable_to"],
				as_dict=1,
			)
			if (
				unavailable.unavailable_from
				and unavailable.unavailable_to
				and getdate(self.date) >= unavailable.unavailable_from
				and getdate(self.date) <= unavailable.unavailable_to
			):
				frappe.throw(
					_(
						"The evaluator of this course is unavailable from {0} to {1}. Please select a date after {1}"
					).format(
						format_date(unavailable.unavailable_from, "medium"),
						format_date(unavailable.unavailable_to, "medium"),
					)
				)

	def validate_slot(self):
		if frappe.db.exists(
			"LMS Certificate Request",
			{
				"evaluator": self.evaluator,
				"date": self.date,
				"start_time": self.start_time,
				"member": ["!=", self.member],
			},
		):
			frappe.throw(_("The slot is already booked by another participant."))

	def validate_if_existing_requests(self):
		existing_requests = frappe.get_all(
			"LMS Certificate Request",
			{
				"member": self.member,
				"course": self.course,
				"name": ["!=", self.name],
				"status": "Upcoming",
			},
			["date", "start_time", "course"],
		)

		for req in existing_requests:
			if (
				req.date == getdate(self.date)
				or getdate() < getdate(req.date)
				or (
					getdate() == getdate(req.date) and get_time(nowtime()) < get_time(req.start_time)
				)
			):
				course_title = frappe.db.get_value("LMS Course", req.course, "title")
				frappe.throw(
					_("You already have an evaluation on {0} at {1} for the course {2}.").format(
						format_date(req.date, "medium"),
						format_time(req.start_time, "short"),
						course_title,
					)
				)
		if getdate() == getdate(self.date) and get_time(self.start_time) < get_time(
			nowtime()
		):
			frappe.throw(_("You cannot schedule evaluations for past slots."))

	def validate_evaluation_end_date(self):
		if self.batch_name:
			evaluation_end_date = frappe.db.get_value(
				"LMS Batch", self.batch_name, "evaluation_end_date"
			)

			if evaluation_end_date:
				if getdate(self.date) > getdate(evaluation_end_date):
					frappe.throw(
						_("You cannot schedule evaluations after {0}.").format(
							format_date(evaluation_end_date, "medium")
						)
					)

	def send_notification(self):
		outgoing_email_account = frappe.get_cached_value(
			"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
		)
		if outgoing_email_account or frappe.conf.get("mail_login"):
			subject = _("Your evaluation slot has been booked")
			template = "certificate_request_notification"

			args = {
				"course": self.course_title,
				"timezone": self.timezone if self.batch_name else "",
				"date": format_date(self.date, "medium"),
				"member_name": self.member_name,
				"start_time": format_time(self.start_time, "short"),
				"evaluator": self.evaluator_name,
			}

			frappe.sendmail(
				recipients=[self.member],
				cc=[self.evaluator],
				subject=subject,
				template=template,
				args=args,
				header=[subject, "green"],
				retry=3,
			)


def schedule_evals():
	if frappe.db.get_single_value("LMS Settings", "send_calendar_invite_for_evaluations"):
		timelapse = add_to_date(get_datetime(), hours=-5)
		evals = frappe.get_all(
			"LMS Certificate Request",
			{
				"creation": [">=", timelapse],
				"google_meet_link": ["is", "not set"],
				"status": "Upcoming",
			},
			["name", "member", "member_name", "evaluator", "date", "start_time", "end_time"],
		)
		for eval in evals:
			setup_calendar_event(eval)


@frappe.whitelist()
def setup_calendar_event(eval):
	if isinstance(eval, str):
		eval = frappe._dict(json.loads(eval))

	calendar = frappe.db.get_value(
		"Google Calendar", {"user": eval.evaluator, "enable": 1}, "name"
	)

	if calendar:
		event = create_event(eval)
		add_participants(eval, event)
		update_meeting_details(eval, event, calendar)


def create_event(eval):
	event = frappe.get_doc(
		{
			"doctype": "Event",
			"subject": f"Evaluation of {eval.member_name}",
			"starts_on": f"{eval.date} {eval.start_time}",
			"ends_on": f"{eval.date} {eval.end_time}",
		}
	)
	event.save()
	return event


def add_participants(eval, event):
	participants = [eval.member, eval.evaluator]
	for participant in participants:
		contact_name = frappe.db.get_value("Contact", {"email_id": participant}, "name")
		frappe.get_doc(
			{
				"doctype": "Event Participants",
				"reference_doctype": "Contact",
				"reference_docname": contact_name,
				"email": participant,
				"parent": event.name,
				"parenttype": "Event",
				"parentfield": "event_participants",
			}
		).save()


def update_meeting_details(eval, event, calendar):
	event.reload()
	event.update(
		{
			"sync_with_google_calendar": 1,
			"add_video_conferencing": 1,
			"google_calendar": calendar,
		}
	)

	event.save()
	event.reload()
	frappe.db.set_value(
		"LMS Certificate Request", eval.name, "google_meet_link", event.google_meet_link
	)


@frappe.whitelist()
def create_certificate_request(
	course, date, day, start_time, end_time, batch_name=None
):
	is_member = frappe.db.exists(
		{"doctype": "LMS Enrollment", "course": course, "member": frappe.session.user}
	)

	if not is_member:
		return
	eval = frappe.new_doc("LMS Certificate Request")
	eval.update(
		{
			"course": course,
			"evaluator": get_evaluator(course, batch_name),
			"member": frappe.session.user,
			"date": date,
			"day": day,
			"start_time": start_time,
			"end_time": end_time,
			"batch_name": batch_name,
		}
	)
	eval.save(ignore_permissions=True)


@frappe.whitelist()
def create_lms_certificate_evaluation(source_name, target_doc=None):
	doc = get_mapped_doc(
		"LMS Certificate Request",
		source_name,
		{"LMS Certificate Request": {"doctype": "LMS Certificate Evaluation"}},
		target_doc,
	)
	return doc


def mark_eval_as_completed():
	requests = frappe.get_all(
		"LMS Certificate Request",
		{
			"status": "Upcoming",
			"date": ["<=", getdate()],
		},
		["name", "end_time", "date"],
	)

	for req in requests:
		if req.date < getdate():
			frappe.db.set_value("LMS Certificate Request", req.name, "status", "Completed")
		elif req.date == getdate() and get_time(req.end_time) < get_time(nowtime()):
			frappe.db.set_value("LMS Certificate Request", req.name, "status", "Completed")
