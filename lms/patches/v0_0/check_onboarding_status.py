import frappe


def execute():
	if (
		frappe.db.count("LMS Course")
		and frappe.db.count("Course Chapter")
		and frappe.db.count("Course Lesson")
		and frappe.db.count("LMS Quiz")
	):
		frappe.db.set_value("LMS Settings", None, "is_onboarding_complete", True)
