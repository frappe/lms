# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import format_date, format_time, getdate


class LMSCertificateRequest(Document):
	def validate(self):
		self.validate_if_existing_requests()

	def after_insert(self):
		if frappe.db.get_single_value("LMS Settings", "send_calendar_invite_for_evaluations"):
			self.create_event()

	def validate_if_existing_requests(self):
		existing_requests = frappe.get_all(
			"LMS Certificate Request",
			{"member": self.member, "course": self.course},
			["date", "start_time", "course"],
		)

		for req in existing_requests:
			if req.date == getdate(self.date) and getdate() <= getdate(self.date):
				course_title = frappe.db.get_value("LMS Course", req.course, "title")
				frappe.throw(
					_("You already have an evaluation on {0} at {1} for the course {2}.").format(
						format_date(req.date, "medium"),
						format_time(req.start_time, "short"),
						course_title,
					)
				)

	def create_event(self):
		calendar = frappe.db.get_value(
			"Google Calendar", {"user": self.evaluator, "enable": 1}, "name"
		)

		if calendar:
			event = frappe.get_doc(
				{
					"doctype": "Event",
					"subject": f"Evaluation of {self.member_name}",
					"starts_on": f"{self.date} {self.start_time}",
					"ends_on": f"{self.date} {self.end_time}",
				}
			)
			event.save()

			participants = [self.member, self.evaluator]
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

			event.reload()
			event.update(
				{
					"sync_with_google_calendar": 1,
					"add_video_conferencing": 1,
					"google_calendar": calendar,
				}
			)

			event.save()


@frappe.whitelist()
def create_certificate_request(course, date, day, start_time, end_time):
	is_member = frappe.db.exists(
		{"doctype": "LMS Batch Membership", "course": course, "member": frappe.session.user}
	)

	if not is_member:
		return

	frappe.get_doc(
		{
			"doctype": "LMS Certificate Request",
			"course": course,
			"member": frappe.session.user,
			"date": date,
			"day": day,
			"start_time": start_time,
			"end_time": end_time,
		}
	).save(ignore_permissions=True)


@frappe.whitelist()
def create_lms_certificate_evaluation(source_name, target_doc=None):
	doc = get_mapped_doc(
		"LMS Certificate Request",
		source_name,
		{"LMS Certificate Request": {"doctype": "LMS Certificate Evaluation"}},
		target_doc,
	)
	return doc
