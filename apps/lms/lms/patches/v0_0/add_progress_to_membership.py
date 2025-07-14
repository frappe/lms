import frappe
from frappe.utils import rounded

from lms.lms.utils import get_course_progress


def execute():
	frappe.reload_doc("lms", "doctype", "lms_batch_membership")
	memberships = frappe.get_all(
		"LMS Enrollment", ["name", "course", "member"], order_by="course"
	)

	if len(memberships):
		current_course = memberships[0].course
		for membership in memberships:
			if current_course != membership.course:
				current_course = membership.course

			progress = rounded(get_course_progress(current_course, membership.member))
			frappe.db.set_value("LMS Enrollment", membership.name, "progress", progress)

	frappe.db.delete("Prepared Report", {"ref_report_doctype": "Course Progress Summary"})
	frappe.db.set_value("Report", "Course Progress Summary", "prepared_report", 0)
