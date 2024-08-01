# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
import requests
import base64
import json
from frappe import _
from datetime import timedelta
from frappe.model.document import Document
from frappe.utils import (
	cint,
	format_date,
	format_datetime,
	get_time,
)
from lms.lms.utils import (
	get_lessons,
	get_lesson_index,
	get_lesson_url,
	get_quiz_details,
	get_assignment_details,
)
from frappe.email.doctype.email_template.email_template import get_email_template


class LMSBatch(Document):
	def validate(self):
		if self.seat_count:
			self.validate_seats_left()
		self.validate_batch_end_date()
		self.validate_duplicate_courses()
		self.validate_duplicate_students()
		self.validate_duplicate_assessments()
		self.validate_membership()
		self.validate_timetable()
		self.send_confirmation_mail()
		self.validate_evaluation_end_date()

	def validate_batch_end_date(self):
		if self.end_date < self.start_date:
			frappe.throw(_("Batch end date cannot be before the batch start date"))

	def validate_duplicate_students(self):
		students = [row.student for row in self.students]
		duplicates = {student for student in students if students.count(student) > 1}
		if len(duplicates):
			frappe.throw(
				_("Student {0} has already been added to this batch.").format(
					frappe.bold(next(iter(duplicates)))
				)
			)

	def validate_duplicate_courses(self):
		courses = [row.course for row in self.courses]
		duplicates = {course for course in courses if courses.count(course) > 1}
		if len(duplicates):
			title = frappe.db.get_value("LMS Course", next(iter(duplicates)), "title")
			frappe.throw(
				_("Course {0} has already been added to this batch.").format(frappe.bold(title))
			)

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

	def send_confirmation_mail(self):
		for student in self.students:
			outgoing_email_account = frappe.get_cached_value(
				"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
			)
			if not student.confirmation_email_sent and (
				outgoing_email_account or frappe.conf.get("mail_login")
			):
				self.send_mail(student)
				student.confirmation_email_sent = 1

	def validate_evaluation_end_date(self):
		if self.evaluation_end_date and self.evaluation_end_date < self.end_date:
			frappe.throw(_("Evaluation end date cannot be less than the batch end date."))

	def send_mail(self, student):
		subject = _("Enrollment Confirmation for the Next Training Batch")
		template = "batch_confirmation"
		custom_template = frappe.db.get_single_value(
			"LMS Settings", "batch_confirmation_template"
		)

		args = {
			"title": self.title,
			"student_name": student.student_name,
			"start_time": self.start_time,
			"start_date": self.start_date,
			"medium": self.medium,
			"name": self.name,
		}

		if custom_template:
			email_template = get_email_template(custom_template, args)
			subject = email_template.get("subject")
			content = email_template.get("message")

		frappe.sendmail(
			recipients=student.student,
			subject=subject,
			template=template if not custom_template else None,
			content=content if custom_template else None,
			args=args,
			header=[subject, "green"],
			retry=3,
		)

	def validate_membership(self):
		for course in self.courses:
			for student in self.students:
				filters = {
					"doctype": "LMS Enrollment",
					"member": student.student,
					"course": course.course,
				}
				if not frappe.db.exists(filters):
					frappe.get_doc(filters).save()

	def validate_seats_left(self):
		if cint(self.seat_count) < len(self.students):
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


@frappe.whitelist()
def remove_student(student, batch_name):
	frappe.only_for("Moderator")
	frappe.db.delete("Batch Student", {"student": student, "parent": batch_name})


@frappe.whitelist()
def remove_course(course, parent):
	frappe.only_for("Moderator")
	frappe.db.delete("Batch Course", {"course": course, "parent": parent})


@frappe.whitelist()
def remove_assessment(assessment, parent):
	frappe.only_for("Moderator")
	frappe.db.delete("LMS Assessment", {"assessment_name": assessment, "parent": parent})


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
def create_batch(
	title,
	start_date,
	end_date,
	description=None,
	batch_details=None,
	batch_details_raw=None,
	meta_image=None,
	seat_count=0,
	start_time=None,
	end_time=None,
	medium="Online",
	category=None,
	paid_batch=0,
	amount=0,
	currency=None,
	amount_usd=0,
	name=None,
	published=0,
	evaluation_end_date=None,
):
	frappe.only_for("Moderator")
	if name:
		doc = frappe.get_doc("LMS Batch", name)
	else:
		doc = frappe.get_doc({"doctype": "LMS Batch"})

	doc.update(
		{
			"title": title,
			"start_date": start_date,
			"end_date": end_date,
			"description": description,
			"batch_details": batch_details,
			"batch_details_raw": batch_details_raw,
			"meta_image": meta_image,
			"seat_count": seat_count,
			"start_time": start_time,
			"end_time": end_time,
			"medium": medium,
			"category": category,
			"paid_batch": paid_batch,
			"amount": amount,
			"currency": currency,
			"amount_usd": amount_usd,
			"published": published,
			"evaluation_end_date": evaluation_end_date,
		}
	)
	doc.save()
	return doc


@frappe.whitelist()
def fetch_lessons(courses):
	lessons = []
	courses = json.loads(courses)

	for course in courses:
		lessons.extend(get_lessons(course.get("course")))

	return lessons


@frappe.whitelist()
def add_course(course, parent, name=None, evaluator=None):
	frappe.only_for("Moderator")

	if frappe.db.exists("Batch Course", {"course": course, "parent": parent}):
		frappe.throw(_("Course already added to the batch."))

	if name:
		doc = frappe.get_doc("Batch Course", name)
	else:
		doc = frappe.new_doc("Batch Course")

	doc.update(
		{
			"course": course,
			"evaluator": evaluator,
			"parent": parent,
			"parentfield": "courses",
			"parenttype": "LMS Batch",
		}
	)
	doc.save()

	return doc.name


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
