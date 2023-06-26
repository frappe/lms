from frappe import _
import frappe
from frappe.utils import getdate
from lms.www.utils import get_assessments
from lms.lms.utils import (
	has_course_moderator_role,
	get_course_progress,
	has_submitted_assessment,
	has_graded_assessment,
)


def get_context(context):
	context.no_cache = 1
	class_name = frappe.form_dict["classname"]
	context.is_moderator = has_course_moderator_role()

	context.class_info = frappe.db.get_value(
		"LMS Class",
		class_name,
		[
			"name",
			"title",
			"start_date",
			"end_date",
			"description",
			"medium",
			"custom_component",
			"seat_count",
			"start_time",
			"end_time",
			"category",
		],
		as_dict=True,
	)

	context.published_courses = frappe.get_all(
		"LMS Course", {"published": 1}, ["name", "title"]
	)

	class_courses = frappe.get_all(
		"Class Course",
		{"parent": class_name},
		["name", "course"],
		order_by="creation desc",
	)

	class_students = frappe.get_all(
		"Class Student",
		{"parent": class_name},
		["name", "student", "student_name", "username"],
		order_by="creation desc",
	)

	context.live_classes = frappe.get_all(
		"LMS Live Class",
		{"class_name": class_name, "date": [">=", getdate()]},
		["title", "description", "time", "date", "start_url", "join_url", "owner"],
		order_by="date",
	)

	context.class_courses = get_class_course_details(class_courses)
	context.all_courses = frappe.get_list(
		"LMS Course", fields=["name", "title"], limit_page_length=0
	)
	context.course_name_list = [course.course for course in context.class_courses]
	context.assessments = get_assessments(class_name)
	context.class_students = get_class_student_details(
		class_students, class_courses, context.assessments
	)
	context.is_student = is_student(class_students)
	context.all_assignments = get_all_assignments(class_name)
	context.all_quizzes = get_all_quizzes(class_name)


def get_all_quizzes(class_name):
	filters = {} if has_course_moderator_role() else {"owner": frappe.session.user}
	all_quizzes = frappe.get_all("LMS Quiz", filters, ["name", "title"])
	for quiz in all_quizzes:
		quiz.checked = frappe.db.exists(
			{
				"doctype": "LMS Assessment",
				"assessment_type": "LMS Quiz",
				"assessment_name": quiz.name,
				"parent": class_name,
			}
		)
	return all_quizzes


def get_all_assignments(class_name):
	filters = {} if has_course_moderator_role() else {"owner": frappe.session.user}
	all_assignments = frappe.get_all("LMS Assignment", filters, ["name", "title"])
	for assignment in all_assignments:
		assignment.checked = frappe.db.exists(
			{
				"doctype": "LMS Assessment",
				"assessment_type": "LMS Assignment",
				"assessment_name": assignment.name,
				"parent": class_name,
			}
		)
	return all_assignments


def get_class_course_details(class_courses):
	for course in class_courses:
		details = frappe.db.get_value(
			"LMS Course",
			course.course,
			[
				"name",
				"title",
				"image",
				"upcoming",
				"short_introduction",
				"image",
				"paid_certificate",
				"price_certificate",
				"enable_certification",
				"currency",
			],
			as_dict=True,
		)
		course.update(details)
	return class_courses


def get_class_student_details(class_students, class_courses, assessments):
	for student in class_students:
		student.update(
			frappe.db.get_value(
				"User", student.student, ["name", "full_name", "username", "headline"], as_dict=1
			)
		)
		student.update(frappe.db.get_value("User", student.student, "last_active", as_dict=1))

		courses_completed = 0
		for course in class_courses:
			if get_course_progress(course.course, student.student) == 100:
				courses_completed += 1
		student["courses_completed"] = courses_completed

		assessments_completed = 0
		assessments_graded = 0
		for assessment in assessments:
			submission = has_submitted_assessment(
				assessment.assessment_name, assessment.assessment_type, student.student
			)
			if submission:
				assessments_completed += 1

				if (
					assessment.assessment_type == "LMS Assignment"
					and has_graded_assessment(submission)
				):
					assessments_graded += 1
				elif assessment.assessment_type == "LMS Quiz":
					assessments_graded += 1

		student["assessments_completed"] = assessments_completed
		student["assessments_graded"] = assessments_graded

	return sort_students(class_students)


def sort_students(class_students):
	session_user = []
	remaining_students = []

	for student in class_students:
		if student.student == frappe.session.user:
			session_user.append(student)
		else:
			remaining_students.append(student)

	if len(session_user):
		return session_user + remaining_students
	else:
		return class_students


def is_student(class_students):
	students = [student.student for student in class_students]
	return frappe.session.user in students
