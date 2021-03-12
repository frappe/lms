import frappe

def get_context(context):
	context.no_cache = 1
	context.my_courses = get_my_courses()

def get_my_courses():
	my_courses = []
	courses = frappe.get_all("LMS Course Enrollment", {"owner": frappe.session.user}, ["course"])
	for course in courses:
		my_courses.append({
			"name": course.course,
			"title": frappe.db.get_value("LMS Course", course.course, ["title"])
		})
	return my_courses