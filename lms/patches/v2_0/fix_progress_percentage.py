import frappe
from lms.lms.utils import get_course_progress


def execute():
	enrollments = frappe.get_all("LMS Enrollment", fields=["name", "course", "member"])

	for enrollment in enrollments:
		progress = get_course_progress(enrollment.course, enrollment.member)
		frappe.db.set_value("LMS Enrollment", enrollment.name, "progress", progress)
