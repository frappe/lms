from frappe import _
import frappe
from frappe.utils import getdate
from lms.www.utils import get_assessments, is_student
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
	batch_name = frappe.form_dict["batchname"]
	context.is_moderator = has_course_moderator_role()
	context.is_evaluator = has_course_evaluator_role()

	context.batch_info = frappe.db.get_value(
		"LMS Batch",
		batch_name,
		[
			"name",
			"title",
			"start_date",
			"end_date",
			"description",
			"medium",
			"custom_component",
			"custom_script",
			"seat_count",
			"start_time",
			"end_time",
			"category",
			"paid_batch",
			"amount",
			"currency",
			"batch_details",
			"published",
			"allow_future",
		],
		as_dict=True,
	)

	context.reference_doctype = "LMS Batch"
	context.reference_name = batch_name

	batch_courses = frappe.get_all(
		"Batch Course",
		{"parent": batch_name},
		["name", "course", "title"],
		order_by="idx",
	)

	batch_students = frappe.get_all(
		"Batch Student",
		{"parent": batch_name},
		["name", "student", "student_name", "username"],
		order_by="idx",
	)

	context.batch_courses = get_class_course_details(batch_courses)
	context.course_list = [course.course for course in context.batch_courses]
	context.all_courses = frappe.get_all(
		"LMS Course", fields=["name", "title"], limit_page_length=0
	)
	context.course_name_list = [course.course for course in context.batch_courses]
	context.assessments = get_assessments(batch_name)
	context.batch_emails = frappe.get_all(
		"Communication",
		filters={"reference_doctype": "LMS Batch", "reference_name": batch_name},
		fields=["subject", "content", "recipients", "cc", "communication_date", "sender"],
		order_by="communication_date desc",
	)

	context.batch_students = get_class_student_details(
		batch_students, batch_courses, context.assessments
	)
	context.is_student = is_student(batch_name)

	if not context.is_student and not context.is_moderator and not context.is_evaluator:
		raise frappe.PermissionError(_("You don't have permission to access this page."))

	context.live_classes = frappe.get_all(
		"LMS Live Class",
		{"batch_name": batch_name, "date": [">=", getdate()]},
		["title", "description", "time", "date", "start_url", "join_url", "owner"],
		order_by="date",
	)

	context.current_student = (
		get_current_student_details(batch_courses, batch_name) if context.is_student else None
	)
	context.all_assignments = get_all_assignments(batch_name)
	context.all_quizzes = get_all_quizzes(batch_name)
	context.show_timetable = frappe.db.count(
		"LMS Batch Timetable",
		{
			"parent": batch_name,
		},
	)
	context.legends = get_legends(batch_name)
	context.settings = frappe.get_single("LMS Settings")

	custom_tabs = frappe.get_hooks("lms_batch_tabs")
	if custom_tabs:
		context.custom_tabs_header = custom_tabs.get("header_html")[0]
		context.custom_tabs_content = custom_tabs.get("content_html")[0]
		context.update(frappe.get_attr(custom_tabs.get("context")[0])())


def get_all_quizzes(batch_name):
	filters = {} if has_course_moderator_role() else {"owner": frappe.session.user}
	all_quizzes = frappe.get_all("LMS Quiz", filters, ["name", "title"])
	for quiz in all_quizzes:
		quiz.checked = frappe.db.exists(
			{
				"doctype": "LMS Assessment",
				"assessment_type": "LMS Quiz",
				"assessment_name": quiz.name,
				"parent": batch_name,
			}
		)
	return all_quizzes


def get_all_assignments(batch_name):
	filters = {} if has_course_moderator_role() else {"owner": frappe.session.user}
	all_assignments = frappe.get_all("LMS Assignment", filters, ["name", "title"])
	for assignment in all_assignments:
		assignment.checked = frappe.db.exists(
			{
				"doctype": "LMS Assessment",
				"assessment_type": "LMS Assignment",
				"assessment_name": assignment.name,
				"parent": batch_name,
			}
		)
	return all_assignments


def get_class_course_details(batch_courses):
	for course in batch_courses:
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
	return batch_courses


def get_class_student_details(batch_students, batch_courses, assessments):
	for student in batch_students:
		student.update(
			frappe.db.get_value(
				"User", student.student, ["name", "full_name", "username", "headline"], as_dict=1
			)
		)
		student.update(frappe.db.get_value("User", student.student, "last_active", as_dict=1))
		get_progress_info(student, batch_courses)
		get_assessment_info(student, assessments)

	return sort_students(batch_students)


def get_progress_info(student, batch_courses):
	courses_completed = 0
	student["courses"] = frappe._dict()
	for course in batch_courses:
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


def sort_students(batch_students):
	session_user = []
	remaining_students = []

	for student in batch_students:
		if student.student == frappe.session.user:
			session_user.append(student)
		else:
			remaining_students.append(student)

	if len(session_user):
		return session_user + remaining_students
	else:
		return batch_students


def get_lesson_details(lesson, batch_name):
	lesson.update(
		frappe.db.get_value(
			"Course Lesson",
			lesson.lesson,
			["name", "title", "body", "course", "chapter"],
			as_dict=True,
		)
	)
	lesson.index = get_lesson_index(lesson.lesson)
	lesson.url = get_lesson_url(lesson.course, lesson.index) + "?class=" + batch_name
	lesson.icon = get_lesson_icon(lesson.body)
	return lesson


def get_current_student_details(batch_courses, batch_name):
	student_details = frappe._dict()
	student_details.courses = frappe._dict()
	course_list = [course.course for course in batch_courses]

	get_course_progress(batch_courses, student_details)
	student_details.name = frappe.session.user
	student_details.assessments = get_assessments(batch_name, frappe.session.user)
	student_details.upcoming_evals = get_upcoming_evals(frappe.session.user, course_list)

	return student_details


def get_course_progress(batch_courses, student_details):
	for course in batch_courses:
		membership = get_membership(course.course, frappe.session.user)
		if membership:
			student_details.courses[course.course] = membership.progress
		else:
			student_details.courses[course.course] = 0


def get_legends(batch):
	return frappe.get_all(
		"LMS Timetable Legend",
		filters={"parenttype": "LMS Batch", "parent": batch},
		fields=["reference_doctype", "color", "label"],
	)
