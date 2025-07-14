import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_course_mentor_mapping")
	mappings = frappe.get_all("LMS Course Mentor Mapping", ["mentor", "name"])
	for mapping in mappings:
		email = frappe.db.get_value("Community Member", mapping.mentor, "email")
		frappe.db.set_value("LMS Course Mentor Mapping", mapping.name, "mentor", email)
