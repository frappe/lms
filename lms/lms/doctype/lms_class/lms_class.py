# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import cint


class LMSClass(Document):
	def validate(self):
		validate_membership(self)


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
