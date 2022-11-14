import frappe


def get_context(context):
	context.no_cache = 1
	class_name = frappe.form_dict["classname"]

	context.class_info = frappe.db.get_value("LMS Class", class_name, ["name", "title", "start_date", "end_date", "description"], as_dict=True)
	context.published_courses = frappe.get_all("LMS Course", {"published": 1}, ["name", "title"])

	context.class_courses = frappe.get_all("Class Course", {
		"parent": class_name
	}, pluck="course")

	context.class_students = frappe.get_all("Class Student", {
		"parent": class_name
	}, ["student", "student_name"])
