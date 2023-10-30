import frappe


def execute():
	fields = [
		"show_dashboard",
		"show_courses",
		"show_students",
		"show_emails",
		"show_assessments",
		"show_discussions",
		"show_live_class",
	]

	for field in fields:
		frappe.db.set_single_value("LMS Settings", field, 1)
