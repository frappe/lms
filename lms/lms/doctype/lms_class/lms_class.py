# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import cint, format_date, format_datetime
import requests
import base64
import json


class LMSClass(Document):
	def validate(self):
		if self.seat_count:
			self.validate_seats_left()
		self.validate_duplicate_students()
		self.validate_membership()

	def validate_duplicate_students(self):
		students = [row.student for row in self.students]
		duplicates = {student for student in students if students.count(student) > 1}
		if len(duplicates):
			frappe.throw(
				_("Student {0} has already been added to this class.").format(
					frappe.bold(next(iter(duplicates)))
				)
			)

	def validate_membership(self):
		for course in self.courses:
			for student in self.students:
				filters = {
					"doctype": "LMS Batch Membership",
					"member": student.student,
					"course": course.course,
				}
				if not frappe.db.exists(filters):
					frappe.get_doc(filters).save()

	def validate_seats_left(self):
		if cint(self.seat_count) < len(self.students):
			frappe.throw(_("There are no seats available in this class."))


@frappe.whitelist()
def add_student(email, class_name):
	if not frappe.db.exists("User", email):
		frappe.throw(_("There is no such user. Please create a user with this Email ID."))

	filters = {
		"student": email,
		"parent": class_name,
		"parenttype": "LMS Class",
		"parentfield": "students",
	}
	if frappe.db.exists("Class Student", filters):
		frappe.throw(
			_("Student {0} has already been added to this class.").format(frappe.bold(email))
		)

	frappe.get_doc(
		{
			"doctype": "Class Student",
			"student": email,
			"student_name": frappe.db.get_value("User", email, "full_name"),
			"parent": class_name,
			"parenttype": "LMS Class",
			"parentfield": "students",
		}
	).save()
	return True


@frappe.whitelist()
def remove_student(student, class_name):
	frappe.db.delete("Class Student", {"student": student, "parent": class_name})


@frappe.whitelist()
def remove_course(course, parent):
	frappe.db.delete("Class Course", {"course": course, "parent": parent})


@frappe.whitelist()
def create_live_class(
	class_name, title, duration, date, time, timezone, auto_recording, description=None
):
	date = format_date(date, "yyyy-mm-dd", True)

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
	name=None,
):
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
		}
	)
	class_details.save()
	return class_details
