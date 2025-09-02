import frappe


def execute():
	programs = frappe.get_all("LMS Program", pluck="name")

	for program in programs:
		course_count = frappe.db.count(
			"LMS Program Course",
			{"parent": program, "parenttype": "LMS Program", "parentfield": "program_courses"},
		)
		frappe.db.set_value("LMS Program", program, "course_count", course_count)

		member_count = frappe.db.count(
			"LMS Program Member",
			{"parent": program, "parenttype": "LMS Program", "parentfield": "program_members"},
		)
		frappe.db.set_value("LMS Program", program, "member_count", member_count)
