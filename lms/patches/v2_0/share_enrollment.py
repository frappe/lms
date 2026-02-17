import frappe


def execute():
	enrollments = frappe.get_all("LMS Enrollment", ["name", "member", "owner"])

	for enrollment in enrollments:
		if enrollment.owner == enrollment.member:
			continue
		filters = {
			"user": enrollment.member,
			"share_doctype": "LMS Enrollment",
			"share_name": enrollment.name,
		}
		is_shared = frappe.db.exists("DocShare", filters)
		if not is_shared:
			share = frappe.new_doc("DocShare")
			filters.update({"read": 1, "write": 1, "notify_by_email": 0})
			share.update(filters)
			share.save()
