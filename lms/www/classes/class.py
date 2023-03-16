import frappe
from lms.lms.utils import has_course_moderator_role
from frappe import _
from frappe.utils import getdate


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

	for student in class_students:
		if student.student == frappe.session.user:
			session_user.append(student)
		else:
			remaining_students.append(student)

	if len(session_user):
		context.class_students = session_user + remaining_students
	else:
		context.class_students = class_students

	context.is_moderator = has_course_moderator_role()

	students = [student.student for student in class_students]
	context.is_student = frappe.session.user in students

	context.live_classes = frappe.get_all(
		"LMS Live Class",
		{"class_name": class_name, "date": [">=", getdate()]},
		["title", "description", "time", "date", "start_url", "join_url", "owner"],
		order_by="date",
	)
