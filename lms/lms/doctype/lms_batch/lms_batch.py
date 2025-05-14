# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
import requests
import base64
import json
from frappe import _
from datetime import timedelta
from frappe.model.document import Document
from frappe.utils import cint, format_datetime, get_time, add_days, nowdate
from lms.lms.utils import (
	get_lesson_index,
	get_lesson_url,
	get_quiz_details,
	get_assignment_details,
	update_payment_record,
	generate_slug,
)


class LMSBatch(Document):
	def validate(self):
		self.validate_seats_left()
		self.validate_batch_end_date()
		self.validate_batch_time()
		self.validate_duplicate_courses()
		self.validate_payments_app()
		self.validate_amount_and_currency()
		self.validate_duplicate_assessments()
		self.validate_membership()
		self.validate_timetable()
		self.validate_evaluation_end_date()

	def autoname(self):
		if not self.name:
			self.name = generate_slug(self.title, "LMS Batch")

	def validate_batch_end_date(self):
		if self.end_date < self.start_date:
			frappe.throw(_("Batch end date cannot be before the batch start date"))

	def validate_batch_time(self):
		if self.start_time and self.end_time:
			if get_time(self.start_time) >= get_time(self.end_time):
				frappe.throw(_("Batch start time cannot be greater than or equal to end time."))

	def validate_duplicate_courses(self):
		courses = [row.course for row in self.courses]
		duplicates = {course for course in courses if courses.count(course) > 1}
		if len(duplicates):
			title = frappe.db.get_value("LMS Course", next(iter(duplicates)), "title")
			frappe.throw(
				_("Course {0} has already been added to this batch.").format(frappe.bold(title))
			)

	def validate_payments_app(self):
		if self.paid_batch:
			installed_apps = frappe.get_installed_apps()
			if "payments" not in installed_apps:
				documentation_link = "https://docs.frappe.io/learning/setting-up-payment-gateway"
				frappe.throw(
					_(
						"Please install the Payments App to create a paid batch. Refer to the documentation for more details. {0}"
					).format(documentation_link)
				)

	def validate_amount_and_currency(self):
		if self.paid_batch and (not self.amount or not self.currency):
			frappe.throw(_("Amount and currency are required for paid batches."))

	def validate_duplicate_assessments(self):
		assessments = [row.assessment_name for row in self.assessment]
		for assessment in self.assessment:
			if assessments.count(assessment.assessment_name) > 1:
				title = frappe.db.get_value(
					assessment.assessment_type, assessment.assessment_name, "title"
				)
				frappe.throw(
					_("Assessment {0} has already been added to this batch.").format(
						frappe.bold(title)
					)
				)

	def validate_evaluation_end_date(self):
		if self.evaluation_end_date and self.evaluation_end_date < self.end_date:
			frappe.throw(_("Evaluation end date cannot be less than the batch end date."))

	def validate_membership(self):
		members = frappe.get_all("LMS Batch Enrollment", {"batch": self.name}, pluck="member")
		for course in self.courses:
			for member in members:
				if not frappe.db.exists(
					"LMS Enrollment", {"course": course.course, "member": member}
				):
					enrollment = frappe.new_doc("LMS Enrollment")
					enrollment.course = course.course
					enrollment.member = member
					enrollment.save()

	def validate_seats_left(self):
		if cint(self.seat_count) < 0:
			frappe.throw(_("Seat count cannot be negative."))

		students = frappe.db.count("LMS Batch Enrollment", {"batch": self.name})
		if cint(self.seat_count) < students:
			frappe.throw(_("There are no seats available in this batch."))

	def validate_timetable(self):
		for schedule in self.timetable:
			if schedule.start_time and schedule.end_time:
				if get_time(schedule.start_time) > get_time(schedule.end_time) or get_time(
					schedule.start_time
				) == get_time(schedule.end_time):
					frappe.throw(
						_("Row #{0} Start time cannot be greater than or equal to end time.").format(
							schedule.idx
						)
					)

				if get_time(schedule.start_time) < get_time(self.start_time) or get_time(
					schedule.start_time
				) > get_time(self.end_time):
					frappe.throw(
						_("Row #{0} Start time cannot be outside the batch duration.").format(
							schedule.idx
						)
					)

				if get_time(schedule.end_time) < get_time(self.start_time) or get_time(
					schedule.end_time
				) > get_time(self.end_time):
					frappe.throw(
						_("Row #{0} End time cannot be outside the batch duration.").format(schedule.idx)
					)

			if schedule.date < self.start_date or schedule.date > self.end_date:
				frappe.throw(
					_("Row #{0} Date cannot be outside the batch duration.").format(schedule.idx)
				)

	def on_payment_authorized(self, payment_status):
		if payment_status in ["Authorized", "Completed"]:
			update_payment_record("LMS Batch", self.name)


@frappe.whitelist()
def create_live_class(
	batch_name, title, duration, date, time, timezone, auto_recording, description=None
):
	frappe.only_for("Moderator")
	payload = {
		"topic": title,
		"start_time": format_datetime(f"{date} {time}", "yyyy-MM-ddTHH:mm:ssZ"),
		"duration": duration,
		"agenda": description,
		"private_meeting": True,
		"auto_recording": "none"
		if auto_recording == "No Recording"
		else auto_recording.lower(),
		"timezone": timezone,
	}
	headers = {
		"Authorization": "Bearer " + authenticate(),
		"content-type": "application/json",
	}
	response = requests.post(
		"https://api.zoom.us/v2/users/me/meetings", headers=headers, data=json.dumps(payload)
	)

	if response.status_code == 201:
		data = json.loads(response.text)
		payload.update(
			{
				"doctype": "LMS Live Class",
				"start_url": data.get("start_url"),
				"join_url": data.get("join_url"),
				"title": title,
				"host": frappe.session.user,
				"date": date,
				"time": time,
				"batch_name": batch_name,
				"password": data.get("password"),
				"description": description,
				"auto_recording": auto_recording,
			}
		)
		class_details = frappe.get_doc(payload)
		class_details.save()
		return class_details
	else:
		frappe.throw(
			_("Error creating live class. Please try again. {0}").format(response.text)
		)


def authenticate():
	zoom = frappe.get_single("Zoom Settings")
	if not zoom.enable:
		frappe.throw(_("Please enable Zoom Settings to use this feature."))

	authenticate_url = f"https://zoom.us/oauth/token?grant_type=account_credentials&account_id={zoom.account_id}"

	headers = {
		"Authorization": "Basic "
		+ base64.b64encode(
			bytes(
				zoom.client_id
				+ ":"
				+ zoom.get_password(fieldname="client_secret", raise_exception=False),
				encoding="utf8",
			)
		).decode()
	}
	response = requests.request("POST", authenticate_url, headers=headers)
	return response.json()["access_token"]


@frappe.whitelist()
def get_batch_timetable(batch):
	timetable = frappe.get_all(
		"LMS Batch Timetable",
		filters={"parent": batch},
		fields=[
			"reference_doctype",
			"reference_docname",
			"date",
			"start_time",
			"end_time",
			"milestone",
			"name",
			"idx",
			"parent",
		],
		order_by="date",
	)

	show_live_class = frappe.db.get_value("LMS Batch", batch, "show_live_class")
	if show_live_class:
		live_classes = get_live_classes(batch)
		timetable.extend(live_classes)

	timetable = get_timetable_details(timetable)
	return timetable


def get_live_classes(batch):
	live_classes = frappe.get_all(
		"LMS Live Class",
		{"batch_name": batch},
		["name", "title", "date", "time as start_time", "duration", "join_url as url"],
		order_by="date",
	)
	for class_ in live_classes:
		class_.end_time = class_.start_time + timedelta(minutes=class_.duration)
		class_.reference_doctype = "LMS Live Class"
		class_.reference_docname = class_.name
		class_.icon = "icon-call"

	return live_classes


def get_timetable_details(timetable):
	for entry in timetable:
		entry.title = frappe.db.get_value(
			entry.reference_doctype, entry.reference_docname, "title"
		)
		assessment = frappe._dict({"assessment_name": entry.reference_docname})

		if entry.reference_doctype == "Course Lesson":
			course = frappe.db.get_value(
				entry.reference_doctype, entry.reference_docname, "course"
			)
			entry.url = get_lesson_url(course, get_lesson_index(entry.reference_docname))

			entry.completed = (
				True
				if frappe.db.exists(
					"LMS Course Progress",
					{"lesson": entry.reference_docname, "member": frappe.session.user},
				)
				else False
			)

		elif entry.reference_doctype == "LMS Quiz":
			entry.url = "/quizzes"
			details = get_quiz_details(assessment, frappe.session.user)
			entry.update(details)

		elif entry.reference_doctype == "LMS Assignment":
			details = get_assignment_details(assessment, frappe.session.user)
			entry.update(details)

	timetable = sorted(timetable, key=lambda k: k["date"])
	return timetable


@frappe.whitelist()
def is_milestone_complete(idx, batch):
	previous_rows = frappe.get_all(
		"LMS Batch Timetable",
		filters={"parent": batch, "idx": ["<", cint(idx)]},
		fields=["reference_doctype", "reference_docname", "idx"],
		order_by="idx",
	)

	for row in previous_rows:
		if row.reference_doctype == "Course Lesson":
			if not frappe.db.exists(
				"LMS Course Progress",
				{"member": frappe.session.user, "lesson": row.reference_docname},
			):
				return False

		if row.reference_doctype == "LMS Quiz":
			passing_percentage = frappe.db.get_value(
				row.reference_doctype, row.reference_docname, "passing_percentage"
			)
			if not frappe.db.exists(
				"LMS Quiz Submission",
				{"quiz": row.reference_docname, "member": frappe.session.user},
			):
				return False

		if row.reference_doctype == "LMS Assignment":
			if not frappe.db.exists(
				"LMS Assignment Submission",
				{"assignment": row.reference_docname, "member": frappe.session.user},
			):
				return False

	return True


def send_batch_start_reminder():
	batches = frappe.get_all(
		"LMS Batch",
		{"start_date": add_days(nowdate(), 1), "published": 1},
		["name", "title", "start_date", "start_time", "medium"],
	)

	for batch in batches:
		students = frappe.get_all(
			"LMS Batch Enrollment", {"batch": batch.name}, ["member", "member_name"]
		)
		for student in students:
			send_mail(batch, student)


def send_mail(batch, student):
	subject = _("Your batch {0} is starting tomorrow").format(batch.title)
	template = "batch_start_reminder"

	args = {
		"student_name": student.member_name,
		"title": batch.title,
		"start_date": batch.start_date,
		"start_time": batch.start_time,
		"medium": batch.medium,
		"name": batch.name,
	}

	frappe.sendmail(
		recipients=student.member,
		subject=subject,
		template=template,
		args=args,
		header=[_(f"Batch Start Reminder: {batch.title}"), "orange"],
	)
