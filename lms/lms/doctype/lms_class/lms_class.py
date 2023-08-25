# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
import requests
import base64
import json
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, format_date, format_datetime
from lms.lms.utils import get_lessons


class LMSClass(Document):
	def validate(self):
		if self.seat_count:
			self.validate_seats_left()
		self.validate_duplicate_courses()
		self.validate_duplicate_students()
		self.validate_duplicate_assessments()
		self.validate_membership()
		self.validate_schedule()

	def validate_duplicate_students(self):
		students = [row.student for row in self.students]
		duplicates = {student for student in students if students.count(student) > 1}
		if len(duplicates):
			frappe.throw(
				_("Student {0} has already been added to this class.").format(
					frappe.bold(next(iter(duplicates)))
				)
			)

	def validate_duplicate_courses(self):
		courses = [row.course for row in self.courses]
		duplicates = {course for course in courses if courses.count(course) > 1}
		if len(duplicates):
			title = frappe.db.get_value("LMS Course", next(iter(duplicates)), "title")
			frappe.throw(
				_("Course {0} has already been added to this class.").format(frappe.bold(title))
			)

	def validate_duplicate_assessments(self):
		assessments = [row.assessment_name for row in self.assessment]
		for assessment in self.assessment:
			if assessments.count(assessment.assessment_name) > 1:
				title = frappe.db.get_value(
					assessment.assessment_type, assessment.assessment_name, "title"
				)
				frappe.throw(
					_("Assessment {0} has already been added to this class.").format(
						frappe.bold(title)
					)
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
			frappe.throw(_("There are no seats available in this class."))

	def validate_schedule(self):
		for schedule in self.scheduled_flow:
			if schedule.start_time and schedule.end_time:
				if (
					schedule.start_time > schedule.end_time or schedule.start_time == schedule.end_time
				):
					frappe.throw(
						_("Row #{0} Start time cannot be greater than or equal to end time.").format(
							schedule.idx
						)
					)

				if schedule.start_time < self.start_time or schedule.start_time > self.end_time:
					frappe.throw(
						_("Row #{0} Start time cannot be outside the class duration.").format(
							schedule.idx
						)
					)

				if schedule.end_time < self.start_time or schedule.end_time > self.end_time:
					frappe.throw(
						_("Row #{0} End time cannot be outside the class duration.").format(schedule.idx)
					)

			if schedule.date < self.start_date or schedule.date > self.end_date:
				frappe.throw(
					_("Row #{0} Date cannot be outside the class duration.").format(schedule.idx)
				)


@frappe.whitelist()
def remove_student(student, class_name):
	frappe.only_for("Moderator")
	frappe.db.delete("Class Student", {"student": student, "parent": class_name})


@frappe.whitelist()
def remove_course(course, parent):
	frappe.only_for("Moderator")
	frappe.db.delete("Class Course", {"course": course, "parent": parent})


@frappe.whitelist()
def remove_assessment(assessment, parent):
	frappe.only_for("Moderator")
	frappe.db.delete("LMS Assessment", {"assessment_name": assessment, "parent": parent})


@frappe.whitelist()
def create_live_class(
	class_name, title, duration, date, time, timezone, auto_recording, description=None
):
	date = format_date(date, "yyyy-mm-dd", True)
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
				"class_name": class_name,
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
def create_class(
	title,
	start_date,
	end_date,
	description=None,
	seat_count=0,
	start_time=None,
	end_time=None,
	medium="Online",
	category=None,
	name=None,
):
	frappe.only_for("Moderator")
	if name:
		class_details = frappe.get_doc("LMS Class", name)
	else:
		class_details = frappe.get_doc({"doctype": "LMS Class"})

	class_details.update(
		{
			"title": title,
			"start_date": start_date,
			"end_date": end_date,
			"description": description,
			"seat_count": seat_count,
			"start_time": start_time,
			"end_time": end_time,
			"medium": medium,
			"category": category,
		}
	)
	class_details.save()
	return class_details


@frappe.whitelist()
def fetch_lessons(courses):
	lessons = []
	courses = json.loads(courses)

	for course in courses:
		lessons.extend(get_lessons(course.get("course")))

	return lessons
