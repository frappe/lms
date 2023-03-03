import frappe
from lms.lms.utils import has_course_moderator_role
from frappe import _


def get_context(context):
	context.no_cache = 1
	class_name = frappe.form_dict["classname"]
	session_user = []
	remaining_students = []

	context.class_info = frappe.db.get_value(
		"LMS Class",
		class_name,
		["name", "title", "start_date", "end_date", "description", "custom_component"],
		as_dict=True,
	)

	context.published_courses = frappe.get_all(
		"LMS Course", {"published": 1}, ["name", "title"]
	)

	context.class_courses = frappe.get_all(
		"Class Course", {"parent": class_name}, pluck="course"
	)

	class_students = frappe.get_all(
		"Class Student", {"parent": class_name}, ["student", "student_name", "username"]
	)

	context.is_moderator = has_course_moderator_role()

	context.live_classes = frappe.get_all(
		"LMS Live Class",
		{"class": class_name},
		["title", "description", "time", "date", "start_url", "join_url"],
	)

	for student in class_students:
		if student.student == frappe.session.user:
			session_user.append(student)
		else:
			remaining_students.append(student)

	if len(session_user):
		context.class_students = session_user + remaining_students
	else:
		context.class_students = class_students
