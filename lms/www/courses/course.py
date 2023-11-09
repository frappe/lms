import frappe
from frappe import _

from lms.lms.utils import (
	can_create_courses,
	get_evaluation_details,
	get_membership,
	has_course_moderator_role,
	is_certified,
	is_instructor,
	redirect_to_courses_list,
	get_average_rating,
	check_multicurrency,
)


def get_context(context):
	context.no_cache = 1

	try:
		course_name = frappe.form_dict["course"]
	except KeyError:
		redirect_to_courses_list()

	if course_name == "new-course":
		if not can_create_courses(course_name):
			message = "You do not have permission to access this page."
			if frappe.session.user == "Guest":
				message = "Please login to access this page."

			raise frappe.PermissionError(_(message))

		context.course = frappe._dict()
		context.course.edit_mode = True
		context.membership = None
	else:
		set_course_context(context, course_name)
	context.avg_rating = get_average_rating(context.course.name)


def set_course_context(context, course_name):
	course = frappe.db.get_value(
		"LMS Course",
		course_name,
		[
			"name",
			"title",
			"image",
			"short_introduction",
			"description",
			"published",
			"upcoming",
			"disable_self_learning",
			"status",
			"video_link",
			"paid_course",
			"course_price",
			"currency",
			"enable_certification",
			"grant_certificate_after",
		],
		as_dict=True,
	)

	if course.course_price:
		course.course_price, course.currency = check_multicurrency(
			course.course_price, course.currency
		)

	if frappe.form_dict.get("edit"):
		if not is_instructor(course.name) and not has_course_moderator_role():
			raise frappe.PermissionError(_("You do not have permission to access this page."))
		course.edit_mode = True

	if course is None:
		raise frappe.PermissionError(_("This is not a valid course URL."))

	related_courses = frappe.get_all(
		"Related Courses", {"parent": course.name}, ["course"]
	)
	for csr in related_courses:
		csr.update(
			frappe.db.get_value(
				"LMS Course",
				csr.course,
				["name", "upcoming", "title", "image"],
				as_dict=True,
			)
		)
	course.related_courses = related_courses

	context.course = course
	membership = get_membership(course.name, frappe.session.user)
	context.course.query_parameter = (
		"?batch=" + membership.batch_old if membership and membership.batch_old else ""
	)
	context.membership = membership
	context.is_instructor = is_instructor(course.name)
	context.certificate = is_certified(course.name)
	eval_details = get_evaluation_details(course.name)
	context.eligible_for_evaluation = eval_details.eligible
	context.no_of_attempts = eval_details.no_of_attempts
	if context.course.upcoming:
		context.is_user_interested = get_user_interest(context.course.name)

	context.metatags = {
		"title": course.title,
		"image": course.image,
		"description": course.short_introduction,
		"keywords": course.title,
		"og:type": "website",
	}


def get_user_interest(course):
	return frappe.db.count(
		"LMS Course Interest", {"course": course, "user": frappe.session.user}
	)
