import frappe
from frappe import _
import json
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
from frappe.utils.telemetry import capture
from lms.overrides.user import get_course_membership
from frappe.utils import cint

def get_context(context):
	capture("active_site", "lms")
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
	get_filter = frappe.db.get_all('Filter Item',{'parent':'LMS Filters'},['*'])
	if get_filter:
		set_filter_model = {}
		for data in get_filter:
			if 'LMS Course' in data['reference_doctype'].split(','):
				set_filter_model[data['name1']] = [data['custom_field']] + frappe.db.get_list(data['name1'], pluck='name')
		context.filters = set_filter_model

@frappe.whitelist(allow_guest=True)
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
			"amount_usd",
		],
	)
	live_courses, upcoming_courses = [], []
	for course in courses:
		course.enrollment_count = frappe.db.count(
			"LMS Enrollment", {"course": course.name, "member_type": "Student"}
		)

		if course.course_price:
			course.course_price, course.currency = check_multicurrency(
				course.course_price, course.currency, None, course.amount_usd
			)

		course.avg_rating = get_average_rating(course.name) or 0
		if course.upcoming:
			upcoming_courses.append(course)
		else:
			live_courses.append(course)

	live_courses.sort(key=lambda x: x.enrollment_count, reverse=True)
	upcoming_courses.sort(key=lambda x: x.enrollment_count, reverse=True)
	return live_courses, upcoming_courses


@frappe.whitelist(allow_guest=True)
def filtered_data(filter):
	data = json.loads(filter)
	filters_data = {"published": True}
	for key, values in data.items():	
		if values:	
			filters_data[key] = ["in", values]
	courses = frappe.get_all(
		"LMS Course",
		filters=filters_data,
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
			"amount_usd",
		],
	)
	live_courses, upcoming_courses = [], []
	for course in courses:
		course.enrollment_count = frappe.db.count(
			"LMS Enrollment", {"course": course.name, "member_type": "Student"}
		)

		if course.course_price:
			course.course_price, course.currency = check_multicurrency(
				course.course_price, course.currency, None, course.amount_usd
			)

		course.avg_rating = get_average_rating(course.name) or 0
		if course.upcoming:
			upcoming_courses.append(course)
		else:
			live_courses.append(course)
	live_courses.sort(key=lambda x: x.enrollment_count, reverse=True)
	upcoming_courses.sort(key=lambda x: x.enrollment_count, reverse=True)

	portal_course_creation = frappe.db.get_single_value(
		"LMS Settings", "portal_course_creation"
	)
	show_creators_section = (
		True
		if portal_course_creation == "Anyone"
		or has_course_moderator_role()
		or has_course_instructor_role()
		else False
	)
	if show_creators_section:
		created =  created_course(filters_data)
	else:
		created = 'None'
	if frappe.session.user != "Guest":
		enrolled =  enrolled_courses(filters_data)
	else:
		enrolled = []
	return live_courses, upcoming_courses, created, enrolled

def created_course(filters_data, member=None, only_published=True):
	"""Returns the number of courses authored by this user."""
	course_details = []
	courses = frappe.get_all(
		"Course Instructor", {"instructor": member or frappe.session.user}, ["parent"]
	)
	items = list(filters_data.items())
    
	if items:
		items.pop(0)

		# Reconstruct the dictionary from the remaining items
		filters_data = dict(items)
	for course in courses:
		filters_data['title'] = course.parent
		detail = frappe.db.get_value(
			"LMS Course",
			filters_data,
			[
				"name",
				"upcoming",
				"title",
				"short_introduction",
				"image",
				"paid_course",
				"course_price",
				"currency",
				"status",
				"published",
				"creation"
			],
			as_dict=True
		)
		filters_data.popitem()

		if detail:
			if only_published and detail and not detail.published:
				continue
			detail.enrollment_count = frappe.db.count(
				"LMS Enrollment", {"course": detail.name, "member_type": "Student"}
			)
			detail.avg_rating = get_average_rating(detail.name) or 0
			if detail not in course_details:
				course_details.append(detail)
	course_details.sort(key=lambda x: x.enrollment_count, reverse=True)
	return course_details


def enrolled_courses(filters_data):
	completed = []
	memberships = get_course_membership(None, member_type="Student")
	items = list(filters_data.items())
    
	if items:
		items.pop(0)
		filters_data = dict(items)
	for membership in memberships:
		filters_data['title'] = membership.course
		course = frappe.db.get_value(
			"LMS Course",
			filters_data,
			[
				"name",
				"upcoming",
				"title",
				"short_introduction",
				"image",
				"enable_certification",
				"paid_course",
				"course_price",
				"currency",
				"published",
				"creation",
			],
			as_dict=True,
		)
		filters_data.popitem()
		if course:
			if not course.published:
				continue
			course.enrollment_count = frappe.db.count(
				"LMS Enrollment", {"course": course.name, "member_type": "Student"}
			)
			course.avg_rating = get_average_rating(course.name) or 0
			completed.append(course)

	completed.sort(key=lambda x: x.enrollment_count, reverse=True)

	return completed

