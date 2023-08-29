import frappe


def get_context(context):
	context.no_cache = 1
	context.members = frappe.get_all(
		"LMS Certificate", pluck="member", order_by="creation desc", distinct=1
	)

	participants = []
	for member in context.members:
		details = frappe.db.get_value(
			"User", member, ["name", "full_name", "user_image", "username", "enabled"], as_dict=1
		)
		courses = frappe.get_all("LMS Certificate", {"member": member}, pluck="course")
		details.courses = []
		for course in courses:
			details.courses.append(frappe.db.get_value("LMS Course", course, "title"))
		if details.enabled:
			participants.append(details)

	context.participants = participants
