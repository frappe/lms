# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import ceil


class LMSEnrollment(Document):
	def validate(self):
		self.validate_course_enrollment_eligibility()

	def on_update(self):
		update_program_progress(self.member)

	def validate_course_enrollment_eligibility(self):
		course_details = frappe.db.get_value(
			"LMS Course",
			self.course,
			["published", "disable_self_learning", "paid_course", "paid_certificate"],
			as_dict=True,
		)

		if course_details.disable_self_learning:
			frappe.throw(
				_(
					"You cannot enroll in this course as self-learning is disabled. Please contact the Administrator."
				)
			)

		if not course_details.published:
			frappe.throw(_("You cannot enroll in an unpublished course."))

		if course_details.paid_course:
			payment = frappe.db.exists(
				"LMS Payment",
				{
					"reference_doctype": "LMS Course",
					"reference_docname": self.course,
					"member": self.member,
					"payment_receipt": True,
				},
			)

			if not payment:
				frappe.throw(_("You need to complete the payment for this course before enrolling."))


def update_program_progress(member):
	programs = frappe.get_all("LMS Program Member", {"member": member}, ["parent", "name"])

	for program in programs:
		total_progress = 0
		courses = frappe.get_all("LMS Program Course", {"parent": program.parent}, pluck="course")
		for course in courses:
			progress = frappe.db.get_value("LMS Enrollment", {"course": course, "member": member}, "progress")
			progress = progress or 0
			total_progress += progress

		average_progress = ceil(total_progress / len(courses))
		frappe.db.set_value("LMS Program Member", program.name, "progress", average_progress)


@frappe.whitelist()
def create_membership(course, batch=None, member=None, member_type="Student", role="Member"):
	enrollment = frappe.new_doc("LMS Enrollment")
	enrollment.update(
		{
			"doctype": "LMS Enrollment",
			"batch_old": batch,
			"course": course,
			"role": role,
			"member_type": member_type,
			"member": member or frappe.session.user,
		}
	)
	enrollment.insert()
	return enrollment


@frappe.whitelist()
def update_current_membership(batch, course, member):
	all_memberships = frappe.get_all("LMS Enrollment", {"member": member, "course": course})
	for membership in all_memberships:
		frappe.db.set_value("LMS Enrollment", membership.name, "is_current", 0)

	current_membership = frappe.get_all("LMS Enrollment", {"batch_old": batch, "member": member})
	if len(current_membership):
		frappe.db.set_value("LMS Enrollment", current_membership[0].name, "is_current", 1)
