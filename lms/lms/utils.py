import re
import string
import frappe
import json
import razorpay
import requests
from frappe import _
from frappe.desk.doctype.dashboard_chart.dashboard_chart import get_result
from frappe.desk.doctype.notification_log.notification_log import (
	make_notification_logs,
	enqueue_create_notification,
	get_title,
)
from frappe.desk.search import get_user_groups
from frappe.desk.notifications import extract_mentions
from frappe.utils import (
	add_months,
	cint,
	cstr,
	flt,
	fmt_money,
	format_date,
	get_datetime,
	getdate,
	validate_phone_number,
	get_fullname,
	pretty_date,
	get_time_str,
	nowtime,
	format_datetime,
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


def get_membership(course, member=None, batch=None):
	if not member:
		member = frappe.session.user

	filters = {"member": member, "course": course}
	if batch:
		filters["batch_old"] = batch

	is_member = frappe.db.exists("LMS Enrollment", filters)
	if is_member:
		membership = frappe.db.get_value(
			"LMS Enrollment",
			filters,
			["name", "batch_old", "current_lesson", "member_type", "progress", "member"],
			as_dict=True,
		)

		if membership and membership.batch_old:
			membership.batch_title = frappe.db.get_value(
				"LMS Batch Old", membership.batch_old, "title"
			)
		return membership

	return False


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


def get_lessons(course, chapter=None, get_details=True, progress=False):
	"""If chapter is passed, returns lessons of only that chapter.
	Else returns lessons of all chapters of the course"""
	lessons = []
	lesson_count = 0
	if chapter:
		if get_details:
			return get_lesson_details(chapter, progress=progress)
		else:
			return frappe.db.count("Lesson Reference", {"parent": chapter.name})

	for chapter in get_chapters(course):
		if get_details:
			lessons += get_lesson_details(chapter, progress=progress)
		else:
			lesson_count += frappe.db.count("Lesson Reference", {"parent": chapter.name})

	return lessons if get_details else lesson_count


def get_lesson_details(chapter, progress=False):
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
				"instructor_notes",
				"course",
			],
			as_dict=True,
		)
		lesson_details.number = f"{chapter.idx}.{row.idx}"
		lesson_details.icon = get_lesson_icon(lesson_details.body)

		if progress:
			lesson_details.is_complete = get_progress(lesson_details.course, lesson_details.name)

		lessons.append(lesson_details)
	return lessons


def get_lesson_icon(content):
	icon = None
	macros = find_macros(content)

	for macro in macros:
		if macro[0] == "YouTubeVideo" or macro[0] == "Video":
			icon = "icon-youtube"
		elif macro[0] == "Quiz":
			icon = "icon-quiz"

	if not icon:
		icon = "icon-list"

	return icon


@frappe.whitelist(allow_guest=True)
def get_tags(course):
	tags = frappe.db.get_value("LMS Course", course, "tags")
	return tags.split(",") if tags else []


def get_instructors(course):
	instructor_details = []
	instructors = frappe.get_all(
		"Course Instructor", {"parent": course}, order_by="idx", pluck="instructor"
	)

	for instructor in instructors:
		instructor_details.append(
			frappe.db.get_value(
				"User",
				instructor,
				["name", "username", "full_name", "user_image", "first_name"],
				as_dict=True,
			)
		)
	return instructor_details


def get_students(course, batch=None):
	"""Returns (email, full_name, username) of all the students of this batch as a list of dict."""
	filters = {"course": course, "member_type": "Student"}

	if batch:
		filters["batch_old"] = batch

	return frappe.get_all("LMS Enrollment", filters, ["member"])


def get_average_rating(course):
	ratings = [review.rating for review in get_reviews(course)]
	if not len(ratings):
		return None
	return sum(ratings) / len(ratings)


@frappe.whitelist(allow_guest=True)
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
		review.creation = pretty_date(review.creation)

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
		return "1-1"

	chapter = frappe.db.get_value(
		"Chapter Reference", {"chapter": lesson.parent}, ["idx"], as_dict=True
	)
	if not chapter:
		return "1-1"

	return f"{chapter.idx}-{lesson.idx}"


def get_lesson_url(course, lesson_number):
	if not lesson_number:
		return
	return f"/courses/{course}/learn/{lesson_number}"


def get_batch(course, batch_name):
	return frappe.get_all("LMS Batch Old", {"name": batch_name, "course": course})


def get_slugified_chapter_title(chapter):
	return slugify(chapter)


def get_progress(course, lesson, member=None):
	if not member:
		member = frappe.session.user

	return frappe.db.exists(
		"LMS Course Progress",
		{"course": course, "member": member, "lesson": lesson},
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
			"LMS Enrollment", {"member": member.name, "member_type": "Mentor"}
		)
		course_mentors.append(member)
	return course_mentors


def is_eligible_to_review(course):
	"""Checks if user is eligible to review the course"""
	if frappe.db.count(
		"LMS Course Review", {"course": course, "owner": frappe.session.user}
	):
		return False
	return True


def get_course_progress(course, member=None):
	"""Returns the course progress of the session user"""
	lesson_count = get_lessons(course, get_details=False)
	if not lesson_count:
		return 0
	completed_lessons = frappe.db.count(
		"LMS Course Progress",
		{"course": course, "member": member or frappe.session.user, "status": "Complete"},
	)
	precision = cint(frappe.db.get_default("float_precision")) or 3
	return flt(((completed_lessons / lesson_count) * 100), precision)


def get_initial_members(course):
	members = frappe.get_all("LMS Enrollment", {"course": course}, ["member"], limit=3)

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
				"members": cint(frappe.db.count("LMS Enrollment", {"course": course.name})),
			}
		)

	course_membership = sorted(
		course_membership, key=lambda x: x.get("members"), reverse=True
	)
	return course_membership[:3]


def format_amount(amount, currency):
	amount_reduced = amount / 1000
	if amount_reduced < 1:
		return fmt_money(amount, 0, currency)
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
	frappe.local.flags.redirect_location = "/lms/courses"
	raise frappe.Redirect


def has_course_instructor_role(member=None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Course Creator"},
		"name",
	)


def can_create_courses(course, member=None):
	if not member:
		member = frappe.session.user

	instructors = frappe.get_all(
		"Course Instructor",
		{
			"parent": course,
		},
		pluck="instructor",
	)

	if frappe.session.user == "Guest":
		return False

	if has_course_moderator_role(member):
		return True

	if has_course_instructor_role(member) and member in instructors:
		return True

	if not course and has_course_instructor_role(member):
		return True

	return False


def has_course_moderator_role(member=None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Moderator"},
		"name",
	)


def has_course_evaluator_role(member=None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Batch Evaluator"},
		"name",
	)


def has_student_role(member=None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "LMS Student"},
		"name",
	)


def get_courses_under_review():
	return frappe.get_all(
		"LMS Course",
		{"status": "Under Review"},
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
		],
	)


def validate_image(path):
	if path and "/private" in path:
		file = frappe.get_doc("File", {"file_url": path})
		file.is_private = 0
		file.save()
		return file.file_url
	return path


def handle_notifications(doc, method):
	topic = frappe.db.get_value(
		"Discussion Topic",
		doc.topic,
		["reference_doctype", "reference_docname", "owner", "title"],
		as_dict=1,
	)
	if topic.reference_doctype not in ["Course Lesson", "LMS Batch"]:
		return
	create_notification_log(doc, topic)
	notify_mentions_on_portal(doc, topic)
	notify_mentions_via_email(doc, topic)


def create_notification_log(doc, topic):
	users = []
	if topic.reference_doctype == "Course Lesson":
		course = frappe.db.get_value("Course Lesson", topic.reference_docname, "course")
		course_title = frappe.db.get_value("LMS Course", course, "title")
		instructors = frappe.db.get_all(
			"Course Instructor", {"parent": course}, pluck="instructor"
		)

		if doc.owner != topic.owner:
			users.append(topic.owner)

		users += instructors
		subject = _("New reply on the topic {0} in course {1}").format(
			topic.title, course_title
		)
		link = get_lesson_url(course, get_lesson_index(topic.reference_docname))

	else:
		batch_title = frappe.db.get_value("LMS Batch", topic.reference_docname, "title")
		subject = _("New comment in batch {0}").format(batch_title)
		link = f"/batches/{topic.reference_docname}"
		moderators = frappe.get_all("Has Role", {"role": "Moderator"}, pluck="parent")
		users += moderators

	notification = frappe._dict(
		{
			"subject": subject,
			"email_content": doc.reply,
			"document_type": topic.reference_doctype,
			"document_name": topic.reference_docname,
			"for_user": topic.owner,
			"from_user": doc.owner,
			"type": "Alert",
			"link": link,
		}
	)

	make_notification_logs(notification, users)


def notify_mentions_on_portal(doc, topic):
	mentions = extract_mentions(doc.reply)
	if not mentions:
		return

	from_user_name = get_fullname(doc.owner)

	if topic.reference_doctype == "Course Lesson":
		course = frappe.db.get_value("Course Lesson", topic.reference_docname, "course")
		subject = _("{0} mentioned you in a comment in {1}").format(
			from_user_name, topic.title
		)
		link = get_lesson_url(course, get_lesson_index(topic.reference_docname))
	else:
		batch_title = frappe.db.get_value("LMS Batch", topic.reference_docname, "title")
		subject = _("{0} mentioned you in a comment in {1}").format(
			from_user_name, batch_title
		)
		link = f"/batches/{topic.reference_docname}"

	for user in mentions:
		notification = frappe._dict(
			{
				"subject": subject,
				"email_content": doc.reply,
				"document_type": topic.reference_doctype,
				"document_name": topic.reference_docname,
				"for_user": user,
				"from_user": doc.owner,
				"type": "Alert",
				"link": link,
			}
		)
		make_notification_logs(notification, user)


def notify_mentions_via_email(doc, topic):
	outgoing_email_account = frappe.get_cached_value(
		"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
	)
	if not outgoing_email_account or not frappe.conf.get("mail_login"):
		return

	mentions = extract_mentions(doc.reply)
	if not mentions:
		return

	sender_fullname = get_fullname(doc.owner)
	recipients = [
		frappe.db.get_value(
			"User",
			{"enabled": 1, "name": name},
			"email",
		)
		for name in mentions
	]
	subject = _("{0} mentioned you in a comment").format(sender_fullname)
	template = "mention_template"

	if topic.reference_doctype == "LMS Batch":
		link = f"/batches/{topic.reference_docname}#discussions"
	if topic.reference_doctype == "Course Lesson":
		course = frappe.db.get_value("Course Lesson", topic.reference_docname, "course")
		lesson_index = get_lesson_index(topic.reference_docname)
		link = get_lesson_url(course, lesson_index)

	args = {
		"sender": sender_fullname,
		"content": doc.reply,
		"link": link,
	}

	for recipient in recipients:
		frappe.sendmail(
			recipients=recipient,
			subject=subject,
			template=template,
			args=args,
			header=[subject, "green"],
			retry=3,
		)


def get_lesson_count(course):
	lesson_count = 0
	chapters = frappe.get_all("Chapter Reference", {"parent": course}, ["chapter"])
	for chapter in chapters:
		lesson_count += frappe.db.count("Lesson Reference", {"parent": chapter.chapter})

	return lesson_count


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
		"LMS Enrollment",
		{"member": member},
		["name", "course", "batch_old", "current_lesson", "member_type", "progress"],
	)


def get_filtered_membership(course, memberships):
	current_membership = list(filter(lambda x: x.course == course, memberships))
	return current_membership[0] if len(current_membership) else None


def show_start_learing_cta(course, membership):

	if course.disable_self_learning or course.upcoming:
		return False
	if is_instructor(course.name):
		return False
	if course.status != "Approved":
		return False
	if not has_lessons(course):
		return False
	if not membership:
		return True


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
def get_chart_data(
	chart_name,
	timespan="Select Date Range",
	timegrain="Daily",
	from_date=None,
	to_date=None,
):
	if not from_date:
		from_date = add_months(getdate(), -1)
	if not to_date:
		to_date = getdate()
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
		"datasets": [{"name": chart.name, "data": [r[1] for r in result]}],
	}


@frappe.whitelist(allow_guest=True)
def get_course_completion_data():
	all_membership = frappe.db.count("LMS Enrollment")
	completed = frappe.db.count("LMS Enrollment", {"progress": ["like", "%100%"]})

	return {
		"labels": ["Completed", "In Progress"],
		"datasets": [
			{
				"name": "Course Completion",
				"data": [completed, all_membership - completed],
			}
		],
	}


def get_telemetry_boot_info():
	POSTHOG_PROJECT_FIELD = "posthog_project_id"
	POSTHOG_HOST_FIELD = "posthog_host"

	if not frappe.conf.get(POSTHOG_HOST_FIELD) or not frappe.conf.get(
		POSTHOG_PROJECT_FIELD
	):
		return {}

	return {
		"posthog_host": frappe.conf.get(POSTHOG_HOST_FIELD),
		"posthog_project_id": frappe.conf.get(POSTHOG_PROJECT_FIELD),
		"enable_telemetry": 1,
	}


def is_onboarding_complete():
	course_created = frappe.db.a_row_exists("LMS Course")
	chapter_created = frappe.db.a_row_exists("Course Chapter")
	lesson_created = frappe.db.a_row_exists("Course Lesson")

	if course_created and chapter_created and lesson_created:
		frappe.db.set_single_value("LMS Settings", "is_onboarding_complete", 1)

	return {
		"is_onboarded": frappe.db.get_single_value("LMS Settings", "is_onboarding_complete"),
		"course_created": course_created,
		"chapter_created": chapter_created,
		"lesson_created": lesson_created,
		"first_course": frappe.get_all("LMS Course", limit=1, order_by=None, pluck="name")[0]
		if course_created
		else None,
	}


def has_submitted_assessment(assessment, type, member=None):
	if not member:
		member = frappe.session.user

	doctype = (
		"LMS Assignment Submission" if type == "LMS Assignment" else "LMS Quiz Submission"
	)
	docfield = "assignment" if type == "LMS Assignment" else "quiz"

	filters = {}
	filters[docfield] = assessment
	filters["member"] = member
	return frappe.db.exists(doctype, filters)


def has_graded_assessment(submission):
	status = frappe.db.get_value("LMS Assignment Submission", submission, "status")
	return False if status == "Not Graded" else True


def get_evaluator(course, batch):
	evaluator = None
	evaluator = frappe.db.get_value(
		"Batch Course",
		{"parent": batch, "course": course},
		"evaluator",
	)
	return evaluator


@frappe.whitelist()
def get_upcoming_evals(student, courses):
	upcoming_evals = frappe.get_all(
		"LMS Certificate Request",
		{
			"member": student,
			"course": ["in", courses],
			"date": [">=", frappe.utils.nowdate()],
		},
		["date", "start_time", "course", "evaluator", "google_meet_link"],
		order_by="date",
	)

	for evals in upcoming_evals:
		evals.course_title = frappe.db.get_value("LMS Course", evals.course, "title")
		evals.evaluator_name = frappe.db.get_value("User", evals.evaluator, "full_name")
	return upcoming_evals


@frappe.whitelist()
def get_payment_options(doctype, docname, phone, country):
	if not frappe.db.exists(doctype, docname):
		frappe.throw(_("Invalid document provided."))

	validate_phone_number(phone, True)
	details = get_details(doctype, docname)

	details.amount, details.currency = check_multicurrency(
		details.amount, details.currency, country, details.amount_usd
	)
	if details.currency == "INR":
		details.amount, details.gst_applied = apply_gst(details.amount, country)

	client = get_client()
	order = create_order(client, details.amount, details.currency)

	options = {
		"key_id": frappe.db.get_single_value("LMS Settings", "razorpay_key"),
		"name": frappe.db.get_single_value("Website Settings", "app_name"),
		"description": _("Payment for {0} course").format(details["title"]),
		"order_id": order["id"],
		"amount": cint(order["amount"]) * 100,
		"currency": order["currency"],
		"prefill": {
			"name": frappe.db.get_value("User", frappe.session.user, "full_name"),
			"email": frappe.session.user,
			"contact": phone,
		},
	}
	return options


def check_multicurrency(amount, currency, country=None, amount_usd=None):
	settings = frappe.get_single("LMS Settings")
	show_usd_equivalent = settings.show_usd_equivalent

	# Countries for which currency should not be converted
	exception_country = settings.exception_country
	exception_country = [country.country for country in exception_country]

	# Get users country
	if not country:
		country = frappe.db.get_value("Address", {"email_id": frappe.session.user}, "country")

	if not country:
		country = frappe.db.get_value("User", frappe.session.user, "country")

	if not country:
		country = get_country_code()

	# If the country is the one for which conversion is not needed then return as is
	if not country or (exception_country and country in exception_country):
		return amount, currency

	# If conversion is disabled from settings or the currency is already USD then return as is
	if not show_usd_equivalent or currency == "USD":
		return amount, currency

	# If Explicit USD price is given then return that without conversion
	if amount_usd and country and country not in exception_country:
		return amount_usd, "USD"

	# Conversion logic starts here. Exchange rate is fetched and amount is converted.
	exchange_rate = get_current_exchange_rate(currency, "USD")
	amount = amount * exchange_rate
	currency = "USD"

	# Check if the amount should be rounded and then apply rounding
	apply_rounding = settings.apply_rounding
	if apply_rounding and amount % 100 != 0:
		amount = amount + 100 - amount % 100

	return amount, currency


def apply_gst(amount, country=None):
	gst_applied = 0
	apply_gst = frappe.db.get_single_value("LMS Settings", "apply_gst")

	if not country:
		country = frappe.db.get_value("User", frappe.session.user, "country")

	if apply_gst and country == "India":
		gst_applied = amount * 0.18
		amount += gst_applied

	return amount, gst_applied


def get_details(doctype, docname):
	if doctype == "LMS Course":
		details = frappe.db.get_value(
			"LMS Course",
			docname,
			["name", "title", "paid_course", "currency", "course_price as amount", "amount_usd"],
			as_dict=True,
		)
		if not details.paid_course:
			frappe.throw(_("This course is free."))
	else:
		details = frappe.db.get_value(
			"LMS Batch",
			docname,
			["name", "title", "paid_batch", "currency", "amount", "amount_usd"],
			as_dict=True,
		)
		if not details.paid_batch:
			frappe.throw(_("To join this batch, please contact the Administrator."))

	return details


def save_address(address):
	filters = {"email_id": frappe.session.user}
	exists = frappe.db.exists("Address", filters)
	if exists:
		address_doc = frappe.get_last_doc("Address", filters=filters)
	else:
		address_doc = frappe.new_doc("Address")

	address_doc.update(address)
	address_doc.update(
		{
			"address_title": frappe.db.get_value("User", frappe.session.user, "full_name"),
			"address_type": "Billing",
			"is_primary_address": 1,
			"email_id": frappe.session.user,
		}
	)
	address_doc.save(ignore_permissions=True)
	return address_doc.name


def get_client():
	settings = frappe.get_single("LMS Settings")
	razorpay_key = settings.razorpay_key
	razorpay_secret = settings.get_password("razorpay_secret", raise_exception=True)

	if not razorpay_key and not razorpay_secret:
		frappe.throw(
			_(
				"There is a problem with the payment gateway. Please contact the Administrator to proceed."
			)
		)

	return razorpay.Client(auth=(razorpay_key, razorpay_secret))


def create_order(client, amount, currency):
	try:
		return client.order.create(
			{
				"amount": cint(amount) * 100,
				"currency": currency,
			}
		)
	except Exception as e:
		frappe.throw(
			_(
				"Error during payment: {0} Please contact the Administrator. Amount {1} Currency {2} Formatted {3}"
			).format(e, amount, currency, cint(amount))
		)


@frappe.whitelist()
def verify_payment(response, doctype, docname, address, order_id):
	client = get_client()
	client.utility.verify_payment_signature(
		{
			"razorpay_order_id": order_id,
			"razorpay_payment_id": response["razorpay_payment_id"],
			"razorpay_signature": response["razorpay_signature"],
		}
	)

	payment = record_payment(address, response, client, doctype, docname)
	if doctype == "LMS Course":
		return create_membership(docname, payment)
	else:
		return add_student_to_batch(docname, payment)


def record_payment(address, response, client, doctype, docname):
	address = frappe._dict(address)
	address_name = save_address(address)

	payment_details = get_payment_details(doctype, docname, address)
	payment_doc = frappe.new_doc("LMS Payment")
	payment_doc.update(
		{
			"member": frappe.session.user,
			"billing_name": address.billing_name,
			"address": address_name,
			"payment_received": 1,
			"order_id": response["razorpay_order_id"],
			"payment_id": response["razorpay_payment_id"],
			"amount": payment_details["amount"],
			"currency": payment_details["currency"],
			"amount_with_gst": payment_details["amount_with_gst"],
			"gstin": address.gstin,
			"pan": address.pan,
			"source": address.source,
			"payment_for_document_type": doctype,
			"payment_for_document": docname,
		}
	)
	payment_doc.save(ignore_permissions=True)
	return payment_doc


def get_payment_details(doctype, docname, address):
	amount_field = "course_price" if doctype == "LMS Course" else "amount"
	amount = frappe.db.get_value(doctype, docname, amount_field)
	currency = frappe.db.get_value(doctype, docname, "currency")
	amount_usd = frappe.db.get_value(doctype, docname, "amount_usd")
	amount_with_gst = 0

	amount, currency = check_multicurrency(amount, currency, None, amount_usd)
	if currency == "INR" and address.country == "India":
		amount_with_gst, gst_applied = apply_gst(amount, address.country)

	return {
		"amount": amount,
		"currency": currency,
		"amount_with_gst": amount_with_gst,
	}


def create_membership(course, payment):
	membership = frappe.new_doc("LMS Enrollment")
	membership.update(
		{"member": frappe.session.user, "course": course, "payment": payment.name}
	)
	membership.save(ignore_permissions=True)
	return f"/lms/courses/{course}/learn/1-1"


def add_student_to_batch(batchname, payment):
	student = frappe.new_doc("Batch Student")
	current_count = frappe.db.count("Batch Student", {"parent": batchname})
	student.update(
		{
			"student": frappe.session.user,
			"payment": payment.name,
			"source": payment.source,
			"parent": batchname,
			"parenttype": "LMS Batch",
			"parentfield": "students",
			"idx": current_count + 1,
		}
	)
	student.save(ignore_permissions=True)
	return f"/batches/{batchname}"


def get_current_exchange_rate(source, target="USD"):
	url = f"https://api.frankfurter.app/latest?from={source}&to={target}"

	response = requests.request("GET", url)
	details = response.json()
	return details["rates"][target]


@frappe.whitelist()
def change_currency(amount, currency, country=None):
	amount = cint(amount)
	amount, currency = check_multicurrency(amount, currency, country)
	return fmt_money(amount, 0, currency)


@frappe.whitelist(allow_guest=True)
def get_courses():
	"""Returns the list of courses."""
	courses = []
	course_list = frappe.get_all("LMS Course", pluck="name")
	for course in course_list:
		courses.append(get_course_details(course))

	courses = get_categorized_courses(courses)
	return courses


@frappe.whitelist(allow_guest=True)
def get_course_details(course):
	course_details = frappe.db.get_value(
		"LMS Course",
		course,
		[
			"name",
			"title",
			"tags",
			"description",
			"image",
			"video_link",
			"short_introduction",
			"published",
			"upcoming",
			"featured",
			"disable_self_learning",
			"published_on",
			"status",
			"paid_course",
			"course_price",
			"currency",
			"amount_usd",
			"enable_certification",
		],
		as_dict=1,
	)
	course_details.tags = course_details.tags.split(",") if course_details.tags else []
	course_details.lesson_count = get_lesson_count(course_details.name)

	course_details.enrollment_count = frappe.db.count(
		"LMS Enrollment", {"course": course_details.name, "member_type": "Student"}
	)
	course_details.enrollment_count_formatted = format_number(
		course_details.enrollment_count
	)

	avg_rating = get_average_rating(course_details.name) or 0
	course_details.avg_rating = flt(
		avg_rating, frappe.get_system_settings("float_precision") or 3
	)

	course_details.instructors = get_instructors(course_details.name)
	if course_details.paid_course:
		"""course_details.course_price, course_details.currency = check_multicurrency(
		        course_details.course_price, course_details.currency, None, course_details.amount_usd
		)"""
		course_details.price = fmt_money(
			course_details.course_price, 0, course_details.currency
		)

	if frappe.session.user == "Guest":
		course_details.membership = None
		course_details.is_instructor = False
	else:
		course_details.membership = frappe.db.get_value(
			"LMS Enrollment",
			{"member": frappe.session.user, "course": course_details.name},
			["name", "course", "current_lesson", "progress", "member"],
			as_dict=1,
		)
		course_details.is_instructor = is_instructor(course_details.name)

	if course_details.membership and course_details.membership.current_lesson:
		course_details.current_lesson = get_lesson_index(
			course_details.membership.current_lesson
		)

	return course_details


def get_categorized_courses(courses):
	live, upcoming, new, enrolled, created, under_review = [], [], [], [], [], []

	for course in courses:
		if course.status == "Under Review":
			under_review.append(course)
		elif course.published and course.upcoming:
			upcoming.append(course)
		elif course.published:
			live.append(course)

		if (
			course.published
			and not course.upcoming
			and course.published_on > add_months(getdate(), -3)
		):
			new.append(course)

		if course.membership and course.published:
			enrolled.append(course)
		elif course.is_instructor:
			created.append(course)

		categories = [live, enrolled, created]
		for category in categories:
			category.sort(key=lambda x: x.enrollment_count, reverse=True)

		live.sort(key=lambda x: x.featured, reverse=True)

	return {
		"live": live,
		"new": new,
		"upcoming": upcoming,
		"enrolled": enrolled,
		"created": created,
		"under_review": under_review,
	}


@frappe.whitelist(allow_guest=True)
def get_course_outline(course, progress=False):
	"""Returns the course outline."""
	outline = []
	chapters = frappe.get_all(
		"Chapter Reference", {"parent": course}, ["chapter", "idx"], order_by="idx"
	)
	for chapter in chapters:
		chapter_details = frappe.db.get_value(
			"Course Chapter",
			chapter.chapter,
			["name", "title", "description"],
			as_dict=True,
		)
		chapter_details["idx"] = chapter.idx
		chapter_details.lessons = get_lessons(course, chapter_details, progress=progress)
		outline.append(chapter_details)
	return outline


@frappe.whitelist(allow_guest=True)
def get_lesson(course, chapter, lesson):
	chapter_name = frappe.db.get_value(
		"Chapter Reference", {"parent": course, "idx": chapter}, "chapter"
	)
	lesson_name = frappe.db.get_value(
		"Lesson Reference", {"parent": chapter_name, "idx": lesson}, "lesson"
	)
	lesson_details = frappe.db.get_value(
		"Course Lesson", lesson_name, ["include_in_preview", "title"], as_dict=1
	)
	membership = get_membership(course)
	course_title = frappe.db.get_value("LMS Course", course, "title")
	if (
		not lesson_details.include_in_preview
		and not membership
		and not has_course_moderator_role()
		and not is_instructor(course)
	):
		return {"no_preview": 1, "title": lesson_details.title, "course_title": course_title}

	lesson_details = frappe.db.get_value(
		"Course Lesson",
		lesson_name,
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
			"instructor_notes",
			"course",
			"content",
			"instructor_content",
		],
		as_dict=True,
	)

	if frappe.session.user == "Guest":
		progress = 0
	else:
		progress = get_progress(course, lesson_details.name)

	lesson_details.rendered_content = render_html(lesson_details)
	neighbours = get_neighbour_lesson(course, chapter, lesson)
	lesson_details.next = neighbours["next"]
	lesson_details.progress = progress
	lesson_details.prev = neighbours["prev"]
	lesson_details.membership = membership
	lesson_details.instructors = get_instructors(course)
	lesson_details.course_title = course_title
	return lesson_details


def get_neighbour_lesson(course, chapter, lesson):
	numbers = []
	current = f"{chapter}.{lesson}"
	chapters = frappe.get_all("Chapter Reference", {"parent": course}, ["idx", "chapter"])
	for chapter in chapters:
		lessons = frappe.get_all("Lesson Reference", {"parent": chapter.chapter}, pluck="idx")
		for lesson in lessons:
			numbers.append(f"{chapter.idx}.{lesson}")

	tuples_list = [tuple(int(x) for x in s.split(".")) for s in numbers]
	sorted_tuples = sorted(tuples_list)
	sorted_numbers = [".".join(str(num) for num in t) for t in sorted_tuples]
	index = sorted_numbers.index(current)

	return {
		"prev": sorted_numbers[index - 1] if index - 1 >= 0 else None,
		"next": sorted_numbers[index + 1] if index + 1 < len(sorted_numbers) else None,
	}


@frappe.whitelist(allow_guest=True)
def get_batches():
	batches = []
	filters = {}
	if frappe.session.user == "Guest":
		filters.update({"start_date": [">=", getdate()], "published": 1})
	batch_list = frappe.get_all("LMS Batch", filters)

	for batch in batch_list:
		batches.append(get_batch_details(batch.name))

	batches = categorize_batches(batches)
	return batches


@frappe.whitelist(allow_guest=True)
def get_batch_details(batch):
	batch_details = frappe.db.get_value(
		"LMS Batch",
		batch,
		[
			"name",
			"title",
			"description",
			"batch_details",
			"batch_details_raw",
			"start_date",
			"end_date",
			"start_time",
			"end_time",
			"seat_count",
			"published",
			"amount",
			"amount_usd",
			"currency",
			"paid_batch",
			"evaluation_end_date",
			"allow_self_enrollment",
			"timezone",
			"category",
		],
		as_dict=True,
	)

	batch_details.instructors = get_instructors(batch)

	batch_details.courses = frappe.get_all(
		"Batch Course", filters={"parent": batch}, fields=["course", "title"]
	)
	batch_details.students = frappe.get_all(
		"Batch Student", {"parent": batch}, pluck="student"
	)
	if batch_details.paid_batch and batch_details.start_date >= getdate():
		batch_details.amount, batch_details.currency = check_multicurrency(
			batch_details.amount, batch_details.currency, None, batch_details.amount_usd
		)
		batch_details.price = fmt_money(batch_details.amount, 0, batch_details.currency)

	if batch_details.seat_count:
		batch_details.seats_left = batch_details.seat_count - len(batch_details.students)

	return batch_details


def categorize_batches(batches):
	upcoming, archived, private, enrolled = [], [], [], []

	for batch in batches:
		if not batch.published:
			private.append(batch)
		elif getdate(batch.start_date) < getdate():
			archived.append(batch)
		elif (
			getdate(batch.start_date) == getdate() and get_time_str(batch.start_time) < nowtime()
		):
			archived.append(batch)
		else:
			upcoming.append(batch)

		if frappe.session.user != "Guest":
			if frappe.db.exists(
				"Batch Student", {"student": frappe.session.user, "parent": batch.name}
			):
				enrolled.append(batch)

	categories = [archived, private, enrolled]
	for category in categories:
		category.sort(key=lambda x: x.start_date, reverse=True)

	upcoming.sort(key=lambda x: x.start_date)
	return {
		"upcoming": upcoming,
		"archived": archived,
		"private": private,
		"enrolled": enrolled,
	}


def get_country_code():
	ip = frappe.local.request_ip
	res = requests.get(f"http://ip-api.com/json/{ip}")

	try:
		data = res.json()
		if data.get("status") != "fail":
			return frappe.db.get_value("Country", {"code": data.get("countryCode")}, "name")
	except Exception:
		pass
	return


@frappe.whitelist()
def get_question_details(question):
	fields = ["question", "type", "multiple"]
	for i in range(1, 5):
		fields.append(f"option_{i}")
		fields.append(f"explanation_{i}")
		fields.append(f"is_correct_{i}")

	question_details = frappe.db.get_value("LMS Question", question, fields, as_dict=1)
	return question_details


@frappe.whitelist(allow_guest=True)
def get_batch_courses(batch):
	courses = []
	course_list = frappe.get_all("Batch Course", {"parent": batch}, ["name", "course"])

	for course in course_list:
		details = get_course_details(course.course)
		details.batch_course = course.name
		courses.append(details)

	return courses


@frappe.whitelist()
def get_assessments(batch, member=None):
	if not member:
		member = frappe.session.user

	assessments = frappe.get_all(
		"LMS Assessment",
		{"parent": batch},
		["name", "assessment_type", "assessment_name"],
	)

	for assessment in assessments:
		if assessment.assessment_type == "LMS Assignment":
			assessment = get_assignment_details(assessment, member)

		elif assessment.assessment_type == "LMS Quiz":
			assessment = get_quiz_details(assessment, member)

	return assessments


def get_assignment_details(assessment, member):
	assessment.title = frappe.db.get_value(
		"LMS Assignment", assessment.assessment_name, "title"
	)

	existing_submission = frappe.db.exists(
		{
			"doctype": "LMS Assignment Submission",
			"member": member,
			"assignment": assessment.assessment_name,
		}
	)
	assessment.completed = False
	if existing_submission:
		assessment.submission = frappe.db.get_value(
			"LMS Assignment Submission",
			existing_submission,
			["name", "status", "comments"],
			as_dict=True,
		)
		assessment.completed = True
		assessment.status = assessment.submission.status
	else:
		assessment.status = "Not Attempted"
		assessment.color = "red"

	assessment.edit_url = f"/assignments/{assessment.assessment_name}"
	submission_name = existing_submission if existing_submission else "new-submission"
	assessment.url = (
		f"/assignment-submission/{assessment.assessment_name}/{submission_name}"
	)

	return assessment


def get_quiz_details(assessment, member):
	assessment_details = frappe.db.get_value(
		"LMS Quiz", assessment.assessment_name, ["title", "passing_percentage"], as_dict=1
	)
	assessment.title = assessment_details.title

	existing_submission = frappe.get_all(
		"LMS Quiz Submission",
		{
			"member": member,
			"quiz": assessment.assessment_name,
		},
		["name", "score", "percentage"],
		order_by="percentage desc",
	)

	if len(existing_submission):
		assessment.submission = existing_submission[0]
		assessment.completed = True
		assessment.status = assessment.submission.score
	else:
		assessment.status = "Not Attempted"
		assessment.color = "red"
		assessment.completed = False

	assessment.edit_url = f"/quizzes/{assessment.assessment_name}"
	submission_name = (
		existing_submission[0].name if len(existing_submission) else "new-submission"
	)
	assessment.url = f"/quiz-submission/{assessment.assessment_name}/{submission_name}"

	return assessment


@frappe.whitelist()
def get_batch_students(batch):
	students = []

	students_list = frappe.get_all(
		"Batch Student", filters={"parent": batch}, fields=["student", "name"]
	)

	batch_courses = frappe.get_all("Batch Course", {"parent": batch}, pluck="course")

	assessments = frappe.get_all(
		"LMS Assessment",
		filters={"parent": batch},
		fields=["name", "assessment_type", "assessment_name"],
	)

	for student in students_list:
		courses_completed = 0
		assessments_completed = 0
		detail = frappe.db.get_value(
			"User",
			student.student,
			["full_name", "email", "username", "last_active", "user_image"],
			as_dict=True,
		)
		detail.last_active = format_datetime(detail.last_active, "dd MMM YY")
		detail.name = student.name
		students.append(detail)

		for course in batch_courses:
			progress = frappe.db.get_value(
				"LMS Enrollment", {"course": course, "member": student.student}, "progress"
			)

			if progress == 100:
				courses_completed += 1

		detail.courses_completed = courses_completed

		for assessment in assessments:
			if has_submitted_assessment(
				assessment.assessment_name, assessment.assessment_type, student.student
			):
				assessments_completed += 1

		detail.assessments_completed = assessments_completed

	return students


@frappe.whitelist()
def get_discussion_topics(doctype, docname, single_thread):
	if single_thread:
		filters = {
			"reference_doctype": doctype,
			"reference_docname": docname,
		}
		topic = frappe.db.exists("Discussion Topic", filters)
		if topic:
			return frappe.db.get_value("Discussion Topic", topic, ["name"], as_dict=1)
		else:
			return create_discussion_topic(doctype, docname)
	topics = frappe.get_all(
		"Discussion Topic",
		{
			"reference_doctype": doctype,
			"reference_docname": docname,
		},
		["name", "title", "owner", "creation", "modified"],
		order_by="creation desc",
	)

	for topic in topics:
		topic.user = frappe.db.get_value(
			"User", topic.owner, ["full_name", "user_image"], as_dict=True
		)

	return topics


def create_discussion_topic(doctype, docname):
	doc = frappe.new_doc("Discussion Topic")
	doc.update(
		{
			"title": docname,
			"reference_doctype": doctype,
			"reference_docname": docname,
		}
	)
	doc.insert()
	return doc


@frappe.whitelist()
def get_discussion_replies(topic):
	replies = frappe.get_all(
		"Discussion Reply",
		{
			"topic": topic,
		},
		["name", "owner", "creation", "modified", "reply"],
		order_by="creation",
	)

	for reply in replies:
		reply.user = frappe.db.get_value(
			"User", reply.owner, ["full_name", "user_image"], as_dict=True
		)

	return replies


@frappe.whitelist()
def get_order_summary(doctype, docname, country=None):
	if doctype == "LMS Course":
		details = frappe.db.get_value(
			"LMS Course",
			docname,
			["title", "name", "paid_course", "course_price as amount", "currency", "amount_usd"],
			as_dict=True,
		)

		if not details.paid_course:
			raise frappe.throw(_("This course is free."))

	else:
		details = frappe.db.get_value(
			"LMS Batch",
			docname,
			["title", "name", "paid_batch", "amount", "currency", "amount_usd"],
			as_dict=True,
		)

		if not details.paid_batch:
			raise frappe.throw(_("To join this batch, please contact the Administrator."))

	details.amount, details.currency = check_multicurrency(
		details.amount, details.currency, country, details.amount_usd
	)
	details.original_amount_formatted = fmt_money(details.amount, 0, details.currency)

	if details.currency == "INR":
		details.amount, details.gst_applied = apply_gst(details.amount)
		details.gst_amount_formatted = fmt_money(details.gst_applied, 0, details.currency)

	details.total_amount_formatted = fmt_money(details.amount, 0, details.currency)
	return details


@frappe.whitelist()
def get_lesson_creation_details(course, chapter, lesson):
	chapter_name = frappe.db.get_value(
		"Chapter Reference", {"parent": course, "idx": chapter}, "chapter"
	)
	lesson_name = frappe.db.get_value(
		"Lesson Reference", {"parent": chapter_name, "idx": lesson}, "lesson"
	)

	if lesson_name:
		lesson_details = frappe.db.get_value(
			"Course Lesson",
			lesson_name,
			[
				"name",
				"title",
				"include_in_preview",
				"body",
				"content",
				"instructor_notes",
				"instructor_content",
				"youtube",
				"quiz_id",
			],
			as_dict=1,
		)

	return {
		"course_title": frappe.db.get_value("LMS Course", course, "title"),
		"chapter": frappe.db.get_value(
			"Course Chapter", chapter_name, ["title", "name"], as_dict=True
		),
		"lesson": lesson_details if lesson_name else None,
	}


@frappe.whitelist()
def get_roles(name):
	frappe.only_for("Moderator")
	return {
		"moderator": has_course_moderator_role(name),
		"course_creator": has_course_instructor_role(name),
		"batch_evaluator": has_course_evaluator_role(name),
		"lms_student": has_student_role(name),
	}


def publish_notifications(doc, method):
	frappe.publish_realtime(
		"publish_lms_notifications", user=doc.for_user, after_commit=True
	)
