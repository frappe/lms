import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_batch_membership")
	memberships = frappe.get_all("LMS Enrollment", ["member", "name"])
	for membership in memberships:
		email = frappe.db.get_value("Community Member", membership.member, "email")
		frappe.db.set_value("LMS Enrollment", membership.name, "member", email)
