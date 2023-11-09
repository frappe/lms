import frappe


def get_context(context):
	context.no_cache = 1
	members = frappe.get_all(
		"LMS Certificate",
		filters={"published": 1},
		pluck="member",
		order_by="issue_date desc",
		distinct=1,
	)

	participants = []
	course_filter = []
	for member in members:
		details = frappe.db.get_value(
			"User", member, ["name", "full_name", "user_image", "username", "enabled"], as_dict=1
		)
		courses = frappe.get_all(
			"LMS Certificate",
			filters={"member": member, "published": 1},
			fields=["course", "issue_date"],
		)
		details.courses = []
		for course in courses:

			if not details.issue_date:
				details.issue_date = course.issue_date

			title = frappe.db.get_value("LMS Course", course.course, "title")
			details.courses.append(title)

			if title not in course_filter:
				course_filter.append(title)

		if details.enabled:
			participants.append(details)

	participants = sorted(participants, key=lambda d: d.issue_date, reverse=True)
	context.participants = participants
	context.course_filter = course_filter
