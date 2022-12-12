import re
import string

import frappe
from frappe import _
from frappe.desk.doctype.dashboard_chart.dashboard_chart import get_result
from frappe.desk.doctype.notification_log.notification_log import make_notification_logs
from frappe.utils import (
	add_months,
	cint,
	cstr,
	flt,
	fmt_money,
	format_date,
	get_datetime,
	getdate,
)
from frappe.utils.dateutils import get_period

from lms.lms.md import find_macros, markdown_to_html

RE_SLUG_NOTALLOWED = re.compile("[^a-z0-9]+")


def slugify(title, used_slugs=None):
	"""Converts title to a slug.

	If a list of used slugs is specified, it will make sure the generated slug
	is not one of them.

	    >>> slugify("Hello World!")
	    'hello-world'
	    >>> slugify("Hello World!", ['hello-world'])
	    'hello-world-2'
	    >>> slugify("Hello World!", ['hello-world', 'hello-world-2'])
	    'hello-world-3'
	"""
	if not used_slugs:
		used_slugs = []

	slug = RE_SLUG_NOTALLOWED.sub("-", title.lower()).strip("-")
	used_slugs = set(used_slugs)

	if slug not in used_slugs:
		return slug

	count = 2
	while True:
		new_slug = f"{slug}-{count}"
		if new_slug not in used_slugs:
			return new_slug
		count = count + 1


def generate_slug(title, doctype):
	result = frappe.get_all(doctype, fields=["name"])
	slugs = {row["name"] for row in result}
	return slugify(title, used_slugs=slugs)


def get_membership(course, member, batch=None):
	filters = {"member": member, "course": course}
	if batch:
		filters["batch"] = batch

	membership = frappe.db.get_value(
		"LMS Batch Membership",
		filters,
		["name", "batch", "current_lesson", "member_type", "progress"],
		as_dict=True,
	)

	if membership and membership.batch:
		membership.batch_title = frappe.db.get_value("LMS Batch", membership.batch, "title")
	return membership


def get_chapters(course):
	"""Returns all chapters of this course."""
	if not course:
		return []
	chapters = frappe.get_all(
		"Chapter Reference", {"parent": course}, ["idx", "chapter"], order_by="idx"
	)
	for chapter in chapters:
		chapter_details = frappe.db.get_value(
			"Course Chapter",
			{"name": chapter.chapter},
			["name", "title", "description"],
			as_dict=True,
		)
		chapter.update(chapter_details)
	return chapters


def get_lessons(course, chapter=None):
	"""If chapter is passed, returns lessons of only that chapter.
	Else returns lessons of all chapters of the course"""
	lessons = []
	if chapter:
		return get_lesson_details(chapter)

	for chapter in get_chapters(course):
		lesson = get_lesson_details(chapter)
		lessons += lesson

	return lessons


def get_lesson_details(chapter):
	lessons = []
	lesson_list = frappe.get_all(
		"Lesson Reference", {"parent": chapter.name}, ["lesson", "idx"], order_by="idx"
	)

	for row in lesson_list:
		lesson_details = frappe.db.get_value(
			"Course Lesson",
			row.lesson,
			[
				"name",
				"title",
				"include_in_preview",
				"body",
				"creation",
				"youtube",
				"quiz_id",
				"question",
				"file_type",
			],
			as_dict=True,
		)
		lesson_details.number = flt(f"{chapter.idx}.{row.idx}")
		lesson_details.icon = "icon-list"
		macros = find_macros(lesson_details.body)

		for macro in macros:
			if macro[0] == "YouTubeVideo":
				lesson_details.icon = "icon-video"
			elif macro[0] == "Quiz":
				lesson_details.icon = "icon-quiz"
		lessons.append(lesson_details)
	return lessons


def get_tags(course):
	tags = frappe.db.get_value("LMS Course", course, "tags")
	return tags.split(",") if tags else []


def get_instructors(course):
	instructor_details = []
	instructors = frappe.get_all(
		"Course Instructor", {"parent": course}, ["instructor"], order_by="idx"
	)
	if not instructors:
		instructors = frappe.db.get_value("LMS Course", course, "owner").split(" ")
	for instructor in instructors:
		instructor_details.append(
			frappe.db.get_value(
				"User",
				instructor.instructor,
				["name", "username", "full_name", "user_image"],
				as_dict=True,
			)
		)
	return instructor_details


def get_students(course, batch=None):
	"""Returns (email, full_name, username) of all the students of this batch as a list of dict."""
	filters = {"course": course, "member_type": "Student"}

	if batch:
		filters["batch"] = batch

	return frappe.get_all("LMS Batch Membership", filters, ["member"])


def get_average_rating(course):
	ratings = [review.rating for review in get_reviews(course)]
	if not len(ratings):
		return None
	return sum(ratings) / len(ratings)


def get_reviews(course):
	reviews = frappe.get_all(
		"LMS Course Review",
		{"course": course},
		["review", "rating", "owner", "creation"],
		order_by="creation desc",
	)
	out_of_ratings = frappe.db.get_all(
		"DocField", {"parent": "LMS Course Review", "fieldtype": "Rating"}, ["options"]
	)
	out_of_ratings = (len(out_of_ratings) and out_of_ratings[0].options) or 5
	for review in reviews:
		review.rating = review.rating * out_of_ratings
		review.owner_details = frappe.db.get_value(
			"User", review.owner, ["name", "username", "full_name", "user_image"], as_dict=True
		)

	return reviews


def get_sorted_reviews(course):
	rating_count = rating_percent = frappe._dict()
	keys = ["5.0", "4.0", "3.0", "2.0", "1.0"]
	for key in keys:
		rating_count[key] = 0

	reviews = get_reviews(course)
	for review in reviews:
		rating_count[cstr(review.rating)] += 1

	for key in keys:
		rating_percent[key] = rating_count[key] / len(reviews) * 100

	return rating_percent


def is_certified(course):
	certificate = frappe.get_all(
		"LMS Certificate", {"member": frappe.session.user, "course": course}
	)
	if len(certificate):
		return certificate[0].name
	return


def get_lesson_index(lesson_name):
	"""Returns the {chapter_index}.{lesson_index} for the lesson."""
	lesson = frappe.db.get_value(
		"Lesson Reference", {"lesson": lesson_name}, ["idx", "parent"], as_dict=True
	)
	if not lesson:
		return "1.1"

	chapter = frappe.db.get_value(
		"Chapter Reference", {"chapter": lesson.parent}, ["idx"], as_dict=True
	)
	if not chapter:
		return "1.1"

	return f"{chapter.idx}.{lesson.idx}"


def get_lesson_url(course, lesson_number):
	if not lesson_number:
		return
	return f"/courses/{course}/learn/{lesson_number}"


def get_batch(course, batch_name):
	return frappe.get_all("LMS Batch", {"name": batch_name, "course": course})


def get_slugified_chapter_title(chapter):
	return slugify(chapter)


def get_progress(course, lesson):
	return frappe.db.get_value(
		"LMS Course Progress",
		{"course": course, "owner": frappe.session.user, "lesson": lesson},
		["status"],
	)


def render_html(lesson):
	youtube = lesson.youtube
	quiz_id = lesson.quiz_id
	body = lesson.body

	if youtube and "/" in youtube:
		youtube = youtube.split("/")[-1]

	quiz_id = "{{ Quiz('" + quiz_id + "') }}" if quiz_id else ""
	youtube = "{{ YouTubeVideo('" + youtube + "') }}" if youtube else ""
	text = youtube + body + quiz_id

	if lesson.question:
		assignment = "{{ Assignment('" + lesson.question + "-" + lesson.file_type + "') }}"
		text = text + assignment

	return markdown_to_html(text)


def is_mentor(course, email):
	"""Checks if given user is a mentor for this course."""
	if not email:
		return False
	return frappe.db.count(
		"LMS Course Mentor Mapping", {"course": course, "mentor": email}
	)


def is_cohort_staff(course, user_email):
	"""Returns True if the user is either a mentor or a staff for one or more active cohorts of this course."""
	staff = {"doctype": "Cohort Staff", "course": course, "email": user_email}
	mentor = {"doctype": "Cohort Mentor", "course": course, "email": user_email}
	return frappe.db.exists(staff) or frappe.db.exists(mentor)


def get_mentors(course):
	"""Returns the list of all mentors for this course."""
	course_mentors = []
	mentors = frappe.get_all("LMS Course Mentor Mapping", {"course": course}, ["mentor"])
	for mentor in mentors:
		member = frappe.db.get_value(
			"User", mentor.mentor, ["name", "username", "full_name", "user_image"]
		)
		member.batch_count = frappe.db.count(
			"LMS Batch Membership", {"member": member.name, "member_type": "Mentor"}
		)
		course_mentors.append(member)
	return course_mentors


def is_eligible_to_review(course, membership):
	"""Checks if user is eligible to review the course"""
	if not membership:
		return False
	if frappe.db.count(
		"LMS Course Review", {"course": course, "owner": frappe.session.user}
	):
		return False
	return True


def get_course_progress(course, member=None):
	"""Returns the course progress of the session user"""
	lesson_count = len(get_lessons(course))
	if not lesson_count:
		return 0
	completed_lessons = frappe.db.count(
		"LMS Course Progress",
		{"course": course, "owner": member or frappe.session.user, "status": "Complete"},
	)
	precision = cint(frappe.db.get_default("float_precision")) or 3
	return flt(((completed_lessons / lesson_count) * 100), precision)


def get_initial_members(course):
	members = frappe.get_all(
		"LMS Batch Membership", {"course": course}, ["member"], limit=3
	)

	member_details = []
	for member in members:
		member_details.append(
			frappe.db.get_value(
				"User", member.member, ["name", "username", "full_name", "user_image"], as_dict=True
			)
		)

	return member_details


def is_instructor(course):
	return (
		len(list(filter(lambda x: x.name == frappe.session.user, get_instructors(course))))
		> 0
	)


def convert_number_to_character(number):
	return string.ascii_uppercase[number]


def get_signup_optin_checks():

	mapper = frappe._dict(
		{
			"terms_of_use": {"page_name": "terms_page", "title": _("Terms of Use")},
			"privacy_policy": {"page_name": "privacy_policy_page", "title": _("Privacy Policy")},
			"cookie_policy": {"page_name": "cookie_policy_page", "title": _("Cookie Policy")},
		}
	)
	checks = ["terms_of_use", "privacy_policy", "cookie_policy"]
	links = []

	for check in checks:
		if frappe.db.get_single_value("LMS Settings", check):
			page = frappe.db.get_single_value("LMS Settings", mapper[check].get("page_name"))
			route = frappe.db.get_value("Web Page", page, "route")
			links.append("<a href='/" + route + "'>" + mapper[check].get("title") + "</a>")

	return (", ").join(links)


def get_popular_courses():
	courses = frappe.get_all("LMS Course", {"published": 1, "upcoming": 0})
	course_membership = []

	for course in courses:
		course_membership.append(
			{
				"course": course.name,
				"members": cint(frappe.db.count("LMS Batch Membership", {"course": course.name})),
			}
		)

	course_membership = sorted(
		course_membership, key=lambda x: x.get("members"), reverse=True
	)
	return course_membership[:3]


def get_evaluation_details(course, member=None):
	info = frappe.db.get_value(
		"LMS Course",
		course,
		["grant_certificate_after", "max_attempts", "duration"],
		as_dict=True,
	)
	request = frappe.db.get_value(
		"LMS Certificate Request",
		{
			"course": course,
			"member": member or frappe.session.user,
			"date": [">=", getdate()],
		},
		["date", "start_time", "end_time"],
		as_dict=True,
	)

	no_of_attempts = frappe.db.count(
		"LMS Certificate Evaluation",
		{
			"course": course,
			"member": member or frappe.session.user,
			"status": ["!=", "Pass"],
			"creation": [">=", add_months(getdate(), -abs(cint(info.duration)))],
		},
	)

	return frappe._dict(
		{
			"eligible": info.grant_certificate_after == "Evaluation"
			and not request
			and no_of_attempts < info.max_attempts,
			"request": request,
			"no_of_attempts": no_of_attempts,
		}
	)


def format_amount(amount, currency):
	amount_reduced = amount / 1000
	if amount_reduced < 1:
		return amount
	precision = 0 if amount % 1000 == 0 else 1
	return _("{0}k").format(fmt_money(amount_reduced, precision, currency))


def format_number(number):
	number_reduced = number / 1000
	if number_reduced < 1:
		return number
	return f"{frappe.utils.flt(number_reduced, 1)}k"


def first_lesson_exists(course):
	first_chapter = frappe.db.get_value(
		"Chapter Reference", {"parent": course, "idx": 1}, "name"
	)
	if not first_chapter:
		return False

	first_lesson = frappe.db.get_value(
		"Lesson Reference", {"parent": first_chapter, "idx": 1}, "name"
	)
	if not first_lesson:
		return False

	return True


def redirect_to_courses_list():
	frappe.local.flags.redirect_location = "/courses"
	raise frappe.Redirect


def has_course_instructor_role(member=None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Course Creator"},
		"name",
	)


def can_create_courses(member=None):
	if not member:
		member = frappe.session.user

	portal_course_creation = frappe.db.get_single_value(
		"LMS Settings", "portal_course_creation"
	)
	return frappe.session.user != "Guest" and (
		portal_course_creation == "Anyone" or has_course_instructor_role(member)
	)


def has_course_moderator_role(member=None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Moderator"},
		"name",
	)


def get_courses_under_review():
	return frappe.get_all(
		"LMS Course",
		{"status": "Under Review"},
		["name", "upcoming", "title", "image", "enable_certification", "status", "published"],
	)


def get_certificates(member=None):
	return frappe.get_all(
		"LMS Certificate",
		{"member": member or frappe.session.user},
		["course", "member", "issue_date", "expiry_date", "name"],
	)


def validate_image(path):
	if path and "/private" in path:
		file = frappe.get_doc("File", {"file_url": path})
		file.is_private = 0
		file.save(ignore_permissions=True)
		return file.file_url
	return path


def create_notification_log(doc, method):
	topic = frappe.db.get_value(
		"Discussion Topic",
		doc.topic,
		["reference_doctype", "reference_docname", "owner", "title"],
		as_dict=1,
	)

	if topic.reference_doctype != "Course Lesson":
		return

	course = frappe.db.get_value("Course Lesson", topic.reference_docname, "course")
	instructors = frappe.db.get_all(
		"Course Instructor", {"parent": course}, pluck="instructor"
	)

	notification = frappe._dict(
		{
			"subject": _("New reply on the topic {0}").format(topic.title),
			"email_content": doc.reply,
			"document_type": topic.reference_doctype,
			"document_name": topic.reference_docname,
			"for_user": topic.owner,
			"from_user": doc.owner,
			"type": "Alert",
		}
	)

	users = []
	if doc.owner != topic.owner:
		users.append(topic.owner)

	if doc.owner not in instructors:
		users += instructors
	make_notification_logs(notification, users)


def get_lesson_count(course):
	lesson_count = 0
	chapters = frappe.get_all("Chapter Reference", {"parent": course}, ["chapter"])
	for chapter in chapters:
		lesson_count += frappe.db.count("Lesson Reference", {"parent": chapter.chapter})

	return lesson_count


def check_profile_restriction():
	return frappe.db.get_single_value("LMS Settings", "force_profile_completion")


def get_restriction_details():
	user = frappe.db.get_value(
		"User", frappe.session.user, ["profile_complete", "username"], as_dict=True
	)
	return {
		"restrict": not user.profile_complete,
		"username": user.username,
		"prefix": frappe.get_hooks("profile_url_prefix")[0] or "/users/",
	}


def get_all_memberships(member):
	return frappe.get_all(
		"LMS Batch Membership",
		{"member": member},
		["name", "course", "batch", "current_lesson", "member_type", "progress"],
	)


def get_filtered_membership(course, memberships):
	current_membership = list(filter(lambda x: x.course == course, memberships))
	return current_membership[0] if len(current_membership) else None


def show_start_learing_cta(course, membership):
	return (
		not course.disable_self_learning
		and not membership
		and not course.upcoming
		and not check_profile_restriction()
		and not is_instructor(course.name)
		and course.status == "Approved"
		and has_lessons(course)
	)


def has_lessons(course):
	lesson_exists = False
	chapter_exists = frappe.db.get_value(
		"Chapter Reference", {"parent": course.name}, ["name", "chapter"], as_dict=True
	)

	if chapter_exists:
		lesson_exists = frappe.db.exists(
			"Lesson Reference", {"parent": chapter_exists.chapter}
		)

	return lesson_exists


@frappe.whitelist(allow_guest=True)
def get_chart_data(chart_name, timespan, timegrain, from_date, to_date):
	chart = frappe.get_doc("Dashboard Chart", chart_name)
	filters = [([chart.document_type, "docstatus", "<", 2, False])]
	doctype = chart.document_type
	datefield = chart.based_on
	value_field = chart.value_based_on or "1"
	from_date = get_datetime(from_date).strftime("%Y-%m-%d")
	to_date = get_datetime(to_date)

	filters.append([doctype, datefield, ">=", from_date, False])
	filters.append([doctype, datefield, "<=", to_date, False])

	data = frappe.db.get_all(
		doctype,
		fields=[f"{datefield} as _unit", f"SUM({value_field})", "COUNT(*)"],
		filters=filters,
		group_by="_unit",
		order_by="_unit asc",
		as_list=True,
	)

	result = get_result(data, timegrain, from_date, to_date, chart.chart_type)

	return {
		"labels": [
			format_date(get_period(r[0], timegrain), parse_day_first=True)
			if timegrain in ("Daily", "Weekly")
			else get_period(r[0], timegrain)
			for r in result
		],
		"datasets": [{"name": chart.name, "values": [r[1] for r in result]}],
	}


@frappe.whitelist(allow_guest=True)
def get_course_completion_data():
	all_membership = frappe.db.count("LMS Batch Membership")
	completed = frappe.db.count("LMS Batch Membership", {"progress": ["like", "%100%"]})

	return {
		"labels": ["Completed", "In Progress"],
		"datasets": [
			{
				"name": "Course Completion",
				"values": [completed, all_membership - completed],
			}
		],
	}
