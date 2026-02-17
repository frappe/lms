import frappe
from frappe.query_builder import DocType


def execute():
	frappe.reload_doc("lms", "doctype", "lms_enrollment")
	enrollment = DocType("LMS Enrollment")
	query = (
		frappe.qb.update(enrollment)
		.set(enrollment.owner, enrollment.member)
		.where(enrollment.owner != enrollment.member)
	)
	query.run()
