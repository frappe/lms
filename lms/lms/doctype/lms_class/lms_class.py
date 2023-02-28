# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import cint
import requests
import urllib
from requests.auth import HTTPBasicAuth


class LMSClass(Document):
	def validate(self):
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
	return True


@frappe.whitelist()
def update_course(class_name, course, value):
	if cint(value):
		doc = frappe.get_doc(
			{
				"doctype": "Class Course",
				"parent": class_name,
				"course": course,
				"parenttype": "LMS Class",
				"parentfield": "courses",
			}
		)
		doc.save()
	else:
		frappe.db.delete("Class Course", {"parent": class_name, "course": course})
	return True


@frappe.whitelist()
def create_live_class(class_name):
	authenticate()


def authenticate():
	zoom = frappe.get_single("Zoom Settings")
	if not zoom.enable:
		frappe.throw(_("Please enable Zoom Settings to use this feature."))

	authenticate_url = "https://zoom.us/oauth/token?grant_type=client_credentials"
	print(authenticate_url)
	breakpoint
	r = requests.get(
		authenticate_url, auth=HTTPBasicAuth(zoom.client_id, zoom.client_secret)
	)
	return r
