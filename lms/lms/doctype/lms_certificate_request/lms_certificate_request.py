# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import format_date, format_time, getdate, add_to_date, get_datetime
from lms.lms.utils import get_evaluator


class LMSCertificateRequest(Document):
	def validate(self):
		self.validate_if_existing_requests()
		self.validate_evaluation_date()

	def validate_if_existing_requests(self):
		existing_requests = frappe.get_all(
			"LMS Certificate Request",
			{"member": self.member, "course": self.course, "name": ["!=", self.name]},
			["date", "start_time", "course"],
		)

		for req in existing_requests:

			if req.date == getdate(self.date) or getdate() <= getdate(req.date):
				course_title = frappe.db.get_value("LMS Course", req.course, "title")
				frappe.throw(
					_("You already have an evaluation on {0} at {1} for the course {2}.").format(
						format_date(req.date, "medium"),
						format_time(req.start_time, "short"),
						course_title,
					)
				)

	def validate_evaluation_date(self):
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


def schedule_evals():
	if frappe.db.get_single_value("LMS Settings", "send_calendar_invite_for_evaluations"):
		one_hour_ago = add_to_date(get_datetime(), hours=-1)
		evals = frappe.get_all(
			"LMS Certificate Request",
			{"creation": [">=", one_hour_ago], "google_meet_link": ["is", "not set"]},
			["name", "member", "member_name", "evaluator", "date", "start_time", "end_time"],
		)
		for eval in evals:
			setup_calendar_event(eval)


def setup_calendar_event(eval):
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
