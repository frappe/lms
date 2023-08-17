from frappe import _
import frappe
from frappe.utils import getdate, cint
from lms.www.utils import get_assessments
from lms.lms.utils import (
	has_course_moderator_role,
	has_course_evaluator_role,
	get_upcoming_evals,
	has_submitted_assessment,
	has_graded_assessment,
	get_lesson_index,
	get_lesson_url,
	get_lesson_icon,
	get_membership,
)


def get_context(context):
	context.no_cache = 1
	class_name = frappe.form_dict["classname"]
	context.is_moderator = has_course_moderator_role()
	context.is_evaluator = has_course_evaluator_role()

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

	context.reference_doctype = "LMS Class"
	context.reference_name = class_name

	class_courses = frappe.get_all(
		"Class Course",
		{"parent": class_name},
		["name", "course", "title"],
		order_by="creation desc",
	)

	class_students = frappe.get_all(
		"Class Student",
		{"parent": class_name},
		["name", "student", "student_name", "username"],
		order_by="creation desc",
	)

	context.class_courses = get_class_course_details(class_courses)
	context.course_list = [course.course for course in context.class_courses]
	context.all_courses = frappe.get_all(
		"LMS Course", fields=["name", "title"], limit_page_length=0
	)
	context.course_name_list = [course.course for course in context.class_courses]
	context.assessments = get_assessments(class_name)
	context.class_students = get_class_student_details(
		class_students, class_courses, context.assessments
	)
	context.is_student = is_student(class_students)

	if not context.is_student and not context.is_moderator and not context.is_evaluator:
		raise frappe.PermissionError(_("You don't have permission to access this page."))

	context.live_classes = frappe.get_all(
		"LMS Live Class",
		{"class_name": class_name, "date": [">=", getdate()]},
		["title", "description", "time", "date", "start_url", "join_url", "owner"],
		order_by="date",
	)

	context.current_student = (
		get_current_student_details(class_courses, class_name) if context.is_student else None
	)
	context.all_assignments = get_all_assignments(class_name)
	context.all_quizzes = get_all_quizzes(class_name)
	context.flow = get_scheduled_flow(class_name)


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
				"paid_course",
				"course_price",
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
		get_progress_info(student, class_courses)
		get_assessment_info(student, assessments)

	return sort_students(class_students)


def get_progress_info(student, class_courses):
	courses_completed = 0
	student["courses"] = frappe._dict()
	for course in class_courses:
		membership = get_membership(course.course, student.student)
		if membership and membership.progress == 100:
			courses_completed += 1

	student["courses_completed"] = courses_completed
	return student


def get_assessment_info(student, assessments):
	assessments_completed = 0
	assessments_graded = 0
	for assessment in assessments:
		submission = has_submitted_assessment(
			assessment.assessment_name, assessment.assessment_type, student.student
		)
		if submission:
			assessments_completed += 1

			if (
				assessment.assessment_type == "LMS Assignment" and has_graded_assessment(submission)
			):
				assessments_graded += 1
			elif assessment.assessment_type == "LMS Quiz":
				assessments_graded += 1

	student["assessments_completed"] = assessments_completed
	student["assessments_graded"] = assessments_graded

	return student


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


def get_scheduled_flow(class_name):
	chapters = []

	lessons = frappe.get_all(
		"Scheduled Flow",
		{"parent": class_name},
		["name", "lesson", "date", "start_time", "end_time"],
		order_by="idx",
	)

	for lesson in lessons:
		lesson = get_lesson_details(lesson, class_name)
		chapter_exists = [
			chapter for chapter in chapters if chapter.chapter == lesson.chapter
		]

		if len(chapter_exists) == 0:
			chapters.append(
				frappe._dict(
					{
						"chapter": lesson.chapter,
						"chapter_title": frappe.db.get_value("Course Chapter", lesson.chapter, "title"),
						"lessons": [lesson],
					}
				)
			)
		else:
			chapter_exists[0]["lessons"].append(lesson)

	return chapters


def get_lesson_details(lesson, class_name):
	lesson.update(
		frappe.db.get_value(
			"Course Lesson",
			lesson.lesson,
			["name", "title", "body", "course", "chapter"],
			as_dict=True,
		)
	)
	lesson.index = get_lesson_index(lesson.lesson)
	lesson.url = get_lesson_url(lesson.course, lesson.index) + "?class=" + class_name
	lesson.icon = get_lesson_icon(lesson.body)
	return lesson


def get_current_student_details(class_courses, class_name):
	student_details = frappe._dict()
	student_details.courses = frappe._dict()
	course_list = [course.course for course in class_courses]

	get_course_progress(class_courses, student_details)
	student_details.name = frappe.session.user
	student_details.assessments = get_assessments(class_name, frappe.session.user)
	student_details.upcoming_evals = get_upcoming_evals(frappe.session.user, course_list)

	return student_details


def get_course_progress(class_courses, student_details):
	for course in class_courses:
		membership = get_membership(course.course, frappe.session.user)
		if membership:
			student_details.courses[course.course] = membership.progress
		else:
			student_details.courses[course.course] = 0
