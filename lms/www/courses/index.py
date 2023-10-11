import frappe
from frappe import _
from lms.lms.utils import (
	check_profile_restriction,
	get_restriction_details,
	has_course_moderator_role,
	get_courses_under_review,
	get_average_rating,
	check_multicurrency,
	has_course_instructor_role,
)
from lms.overrides.user import get_enrolled_courses, get_authored_courses


def get_context(context):
	context.no_cache = 1
	context.live_courses, context.upcoming_courses = get_courses()
	context.enrolled_courses = (
		get_enrolled_courses()["in_progress"] + get_enrolled_courses()["completed"]
	)
	context.created_courses = get_authored_courses(None, False)
	context.review_courses = get_courses_under_review()
	context.restriction = check_profile_restriction()

	portal_course_creation = frappe.db.get_single_value(
		"LMS Settings", "portal_course_creation"
	)
	context.show_creators_section = (
		True
		if portal_course_creation == "Anyone"
		or has_course_moderator_role()
		or has_course_instructor_role()
		else False
	)
	context.show_review_section = (
		has_course_moderator_role() and frappe.session.user != "Guest"
	)

	if context.restriction:
		context.restriction_details = get_restriction_details()

	context.metatags = {
		"title": _("Course List"),
		"image": frappe.db.get_single_value("Website Settings", "banner_image"),
		"description": "This page lists all the courses published on our website",
		"keywords": "All Courses, Courses, Learn",
	}


def get_courses():
	courses = frappe.get_all(
		"LMS Course",
		filters={"published": True},
		fields=[
			"name",
			"upcoming",
			"title",
			"short_introduction",
			"image",
			"paid_course",
			"course_price",
			"currency",
			"creation",
		],
	)

	live_courses, upcoming_courses = [], []
	for course in courses:
		course.enrollment_count = frappe.db.count(
			"LMS Enrollment", {"course": course.name, "member_type": "Student"}
		)

		if course.course_price:
			course.course_price, course.currency = check_multicurrency(
				course.course_price, course.currency
			)

		course.avg_rating = get_average_rating(course.name) or 0
		if course.upcoming:
			upcoming_courses.append(course)
		else:
			live_courses.append(course)

	live_courses.sort(key=lambda x: x.enrollment_count, reverse=True)
	upcoming_courses.sort(key=lambda x: x.enrollment_count, reverse=True)

	return live_courses, upcoming_courses
