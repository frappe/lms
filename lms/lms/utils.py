import hashlib
import json
import re

import frappe
import requests
from frappe import _
from frappe.desk.doctype.dashboard_chart.dashboard_chart import get_result
from frappe.desk.doctype.notification_log.notification_log import make_notification_logs
from frappe.desk.notifications import extract_mentions
from frappe.model.document import Document
from frappe.rate_limiter import rate_limit
from frappe.utils import (
	add_months,
	cint,
	flt,
	fmt_money,
	format_datetime,
	get_datetime,
	get_frappe_version,
	get_fullname,
	get_time_str,
	getdate,
	nowtime,
	pretty_date,
	rounded,
)
from pypika import Case
from pypika import functions as fn

from lms.lms.md import find_macros

RE_SLUG_NOTALLOWED = re.compile("[^a-z0-9]+")


def get_lms_path():
	path = frappe.conf.get("lms_path") or "lms"
	return path.strip("/")


def get_lms_route(path=""):
	base = f"/{get_lms_path()}"
	if not path:
		return base
	return f"{base}/{path.lstrip('/')}"


def extend_bootinfo(bootinfo: dict):
	bootinfo["lms_path"] = get_lms_path()


def slugify(title: str, used_slugs: list = None):
	"""Converts title to a slug.

	If a list of used slugs is specified, it will make sure the generated slug
	is not one of them.

		>>> slugify("Hello World!")
		'hello-world'
		>>> slugify("Hello World!", ["hello-world"])
		'hello-world-2'
		>>> slugify("Hello World!", ["hello-world", "hello-world-2"])
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


def generate_slug(title: str, doctype: str):
	result = frappe.get_all(doctype, fields=["name"])
	slugs = {row["name"] for row in result}
	return slugify(title, used_slugs=slugs)


def get_membership(course: str, member: str = None):
	if not member:
		member = frappe.session.user

	filters = {"member": member, "course": course}

	if frappe.db.exists("LMS Enrollment", filters):
		membership = frappe.db.get_value(
			"LMS Enrollment",
			filters,
			[
				"name",
				"current_lesson",
				"progress",
				"member",
				"course",
				"purchased_certificate",
				"certificate",
			],
			as_dict=True,
		)
		return membership

	return False


def get_chapters(course: str):
	"""Returns all chapters of this course."""
	if not course:
		return []
	chapters = frappe.get_all("Chapter Reference", {"parent": course}, ["idx", "chapter"], order_by="idx")
	for chapter in chapters:
		chapter_details = frappe.db.get_value(
			"Course Chapter",
			{"name": chapter.chapter},
			["name", "title"],
			as_dict=True,
		)
		chapter.update(chapter_details)
	return chapters


def get_lessons(course: str, chapter: str = None, get_details: bool = True, progress: bool = False):
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


def get_lesson_details(chapter: dict, progress: bool = False):
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
				"chapter",
				"content",
			],
			as_dict=True,
		)
		lesson_details.number = f"{chapter.idx}-{row.idx}"
		lesson_details.icon = get_lesson_icon(lesson_details.body, lesson_details.content)

		if progress:
			lesson_details.is_complete = get_progress(lesson_details.course, lesson_details.name)

		lessons.append(lesson_details)
	return lessons


def get_lesson_icon(body: str, content: str):
	if content:
		content = json.loads(content)

		for block in content.get("blocks"):
			if block.get("type") == "upload" and block.get("data").get("file_type").lower() in [
				"mp4",
				"webm",
				"ogg",
				"mov",
			]:
				return "icon-youtube"

			if block.get("type") == "embed" and block.get("data").get("service") in [
				"youtube",
				"vimeo",
				"cloudflareStream",
				"bunnyStream",
			]:
				return "icon-youtube"

			if block.get("type") == "quiz":
				return "icon-quiz"
			if block.get("type") == "assignment":
				return "icon-assignment"
			if block.get("type") == "program":
				return "icon-code"

		return "icon-list"

	macros = find_macros(body)
	for macro in macros:
		if macro[0] == "YouTubeVideo" or macro[0] == "Video":
			return "icon-youtube"
		elif macro[0] == "Quiz":
			return "icon-quiz"

	return "icon-list"


def get_instructors(doctype: str, docname: str):
	instructor_details = []
	instructors = frappe.get_all(
		"Course Instructor",
		{"parent": docname, "parenttype": doctype},
		order_by="idx",
		pluck="instructor",
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


def get_average_rating(course: str):
	ratings = [review.rating for review in get_reviews(course)]
	if not len(ratings):
		return None
	return sum(ratings) / len(ratings)


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_reviews(course: str):
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
			"User", review.owner, ["username", "full_name", "user_image"], as_dict=True
		)
		review.creation = pretty_date(review.creation)

	return reviews


def get_lesson_index(lesson_name: str) -> str:
	"""Returns the {chapter_index}.{lesson_index} for the lesson."""
	lesson = frappe.db.get_value("Lesson Reference", {"lesson": lesson_name}, ["idx", "parent"], as_dict=True)
	if not lesson:
		return "1-1"

	chapter = frappe.db.get_value("Chapter Reference", {"chapter": lesson.parent}, ["idx"], as_dict=True)
	if not chapter:
		return "1-1"

	return f"{chapter.idx}-{lesson.idx}"


def get_lesson_url(course: str, lesson_number: str):
	if not lesson_number:
		return
	return get_lms_route(f"courses/{course}/learn/{lesson_number}")


def get_progress(course: str, lesson: str, member: str = None):
	if not member:
		member = frappe.session.user

	return frappe.db.exists(
		"LMS Course Progress",
		{"course": course, "member": member, "lesson": lesson, "status": "Complete"},
		["status"],
	)


def get_course_progress(course: str, member: str = None):
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


def is_instructor(course: str) -> bool:
	instructors = get_instructors("LMS Course", course)
	for instructor in instructors:
		if instructor.name == frappe.session.user:
			return True
	return False


def has_course_instructor_role(member: str = None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Course Creator"},
		"name",
	)


def has_moderator_role(member: str = None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Moderator"},
		"name",
	)


def has_evaluator_role(member: str = None):
	return frappe.db.get_value(
		"Has Role",
		{"parent": member or frappe.session.user, "role": "Batch Evaluator"},
		"name",
	)


def has_student_role(member: str = None):
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


def validate_image(path: str) -> str:
	if path and "/private" in path:
		frappe.db.set_value(
			"File",
			{"file_url": path},
			"is_private",
			0,
		)
		return path.replace("/private", "")
	return path


def handle_notifications(doc: Document, method: str):
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


def get_course_details_for_notification(topic: dict):
	users = []
	course = frappe.db.get_value("Course Lesson", topic.reference_docname, "course")
	course_title = frappe.db.get_value("LMS Course", course, "title")
	instructors = frappe.db.get_all(
		"Course Instructor", {"parent": course, "parenttype": "LMS Course"}, pluck="instructor"
	)

	users.append(topic.owner)
	users += instructors

	subject = _("New reply on the topic {0} in course {1}").format(topic.title, course_title)
	link = get_lesson_url(course, get_lesson_index(topic.reference_docname))

	return subject, link, users


def get_batch_details_for_notification(topic: dict):
	users = []
	batch_title = frappe.db.get_value("LMS Batch", topic.reference_docname, "title")
	subject = _("New comment in batch {0}").format(batch_title)
	link = get_lms_route(f"batches/{topic.reference_docname}#discussions")
	instructors = frappe.db.get_all(
		"Course Instructor",
		{"parenttype": "LMS Batch", "parent": topic.reference_docname},
		pluck="instructor",
	)
	students = frappe.db.get_all("LMS Batch Enrollment", {"batch": topic.reference_docname}, pluck="member")
	users += instructors
	users += students
	return subject, link, users


def create_notification_log(doc: Document, topic: dict):
	if topic.reference_doctype == "Course Lesson":
		subject, link, users = get_course_details_for_notification(topic)
	else:
		subject, link, users = get_batch_details_for_notification(topic)

	if doc.owner in users:
		users.remove(doc.owner)

	notification = frappe._dict(
		{
			"subject": subject,
			"email_content": doc.reply,
			"document_type": topic.reference_doctype,
			"document_name": topic.reference_docname,
			"from_user": doc.owner,
			"type": "Alert",
			"link": link,
		}
	)

	make_notification_logs(notification, users)


def notify_mentions_on_portal(doc: Document, topic: dict):
	mentions = extract_mentions(doc.reply)
	if not mentions:
		return

	from_user_name = get_fullname(doc.owner)

	if topic.reference_doctype == "Course Lesson":
		course = frappe.db.get_value("Course Lesson", topic.reference_docname, "course")
		subject = _("{0} mentioned you in a comment in {1}").format(
			frappe.bold(from_user_name), frappe.bold(topic.title)
		)
		link = get_lesson_url(course, get_lesson_index(topic.reference_docname))
	else:
		batch_title = frappe.db.get_value("LMS Batch", topic.reference_docname, "title")
		subject = _("{0} mentioned you in a comment in {1}").format(
			frappe.bold(from_user_name), frappe.bold(batch_title)
		)
		link = get_lms_route(f"batches/{topic.reference_docname}#discussions")

	for user in mentions:
		notification = frappe._dict(
			{
				"subject": subject,
				"email_content": doc.reply,
				"document_type": topic.reference_doctype,
				"document_name": topic.reference_docname,
				"for_user": user,
				"from_user": doc.owner,
				"type": "Mention",
				"link": link,
			}
		)
		make_notification_logs(notification, user)


def notify_mentions_via_email(doc: Document, topic: dict):
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


def get_lesson_count(course: str) -> int:
	lesson_count = 0
	chapters = frappe.get_all("Chapter Reference", {"parent": course}, ["chapter"])
	for chapter in chapters:
		lesson_count += frappe.db.count("Lesson Reference", {"parent": chapter.chapter})

	return lesson_count


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_chart_data(
	chart_name: str,
	timegrain: str = "Daily",
	from_date: str = None,
	to_date: str = None,
):
	from_date, to_date = get_chart_date_range(from_date, to_date)
	chart = frappe.get_doc("Dashboard Chart", chart_name)
	doctype = chart.document_type
	datefield = chart.based_on
	value_field = chart.value_based_on or "1"

	data = get_chart_details(doctype, datefield, value_field, chart, from_date, to_date)
	result = get_result(data, timegrain, from_date, to_date, chart.chart_type)
	data = []
	for row in result:
		data.append(
			{
				"date": row[0],
				"count": row[1],
			}
		)
	return data


def get_chart_date_range(from_date: str, to_date: str):
	if not from_date:
		from_date = add_months(getdate(), -1)
	if not to_date:
		to_date = getdate()

	from_date = get_datetime(from_date).strftime("%Y-%m-%d")
	to_date = get_datetime(to_date)

	return from_date, to_date


def get_chart_filters(doctype: str, chart: object, datefield: str, from_date: str, to_date: str):
	version = get_frappe_version()
	if version.startswith("15.") or version.startswith("14."):
		filters = [([chart.document_type, "docstatus", "<", 2, False])]
		filters = filters + json.loads(chart.filters_json)
		filters.append([doctype, datefield, ">=", from_date, False])
		filters.append([doctype, datefield, "<=", to_date, False])
	else:
		filters = [([chart.document_type, "docstatus", "<", 2])]
		filters = filters + json.loads(chart.filters_json)
		filters.append([doctype, datefield, ">=", from_date])
		filters.append([doctype, datefield, "<=", to_date])

	return filters


def get_chart_details(
	doctype: str, datefield: str, value_field: str, chart: object, from_date: str, to_date: str
):
	filters = get_chart_filters(doctype, chart, datefield, from_date, to_date)
	version = get_frappe_version()
	if version.startswith("15.") or version.startswith("14."):
		return frappe.db.get_all(
			doctype,
			fields=[f"{datefield} as _unit", f"SUM({value_field})", "COUNT(*)"],
			filters=filters,
			group_by="_unit",
			order_by="_unit asc",
			as_list=True,
		)
	else:
		return frappe.db.get_all(
			doctype,
			fields=[datefield, {"SUM": value_field}, {"COUNT": "*"}],
			filters=filters,
			group_by=datefield,
			order_by=datefield,
			as_list=True,
		)


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_course_completion_data():
	all_membership = frappe.db.count("LMS Enrollment")
	completed = frappe.db.count("LMS Enrollment", {"progress": ["like", "%100%"]})

	return [
		{"label": "Completed", "value": completed},
		{"label": "In Progress", "value": all_membership - completed},
	]


def get_evaluator(course: str, batch: str = None):
	evaluator = None
	if batch:
		evaluator = frappe.db.get_value(
			"Batch Course",
			{"parent": batch, "course": course},
			"evaluator",
		)
	else:
		evaluator = frappe.db.get_value("LMS Course", course, "evaluator")
	return evaluator


def check_multicurrency(amount: float, currency: str, country: str = None, amount_usd: float = None):
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
	amount = flt(amount * exchange_rate, 2)
	currency = "USD"

	# Check if the amount should be rounded and then apply rounding
	apply_rounding = settings.apply_rounding
	if apply_rounding and amount % 100 != 0:
		amount = amount + 100 - amount % 100

	return rounded(amount), currency


def apply_gst(amount: float, country: str = None) -> tuple:
	gst_applied = 0
	apply_gst = frappe.db.get_single_value("LMS Settings", "apply_gst")

	if not country:
		country = frappe.db.get_value("User", frappe.session.user, "country")

	if apply_gst and country == "India":
		gst_applied = amount * 0.18
		amount += gst_applied

	return amount, gst_applied


def get_current_exchange_rate(source: str, target: str = "USD") -> float:
	url = f"https://api.frankfurter.app/latest?from={source}&to={target}"

	response = requests.request("GET", url)
	details = response.json()
	return details["rates"][target]


def guest_access_allowed():
	allow_guest_access = frappe.get_cached_value("LMS Settings", None, "allow_guest_access")
	if frappe.session.user == "Guest" and not allow_guest_access:
		return False
	return True


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_courses(filters: dict = None, start: int = 0) -> list:
	"""Returns the list of courses."""

	if not guest_access_allowed():
		return []

	if not filters:
		filters = {}

	filters, or_filters, show_featured = update_course_filters(filters)
	fields = get_course_fields()

	courses = frappe.get_all(
		"LMS Course",
		filters=filters,
		fields=fields,
		or_filters=or_filters,
		order_by="enrollments desc",
		start=start,
		page_length=30,
	)

	if show_featured:
		courses = get_featured_courses(filters, or_filters, fields) + courses

	courses = get_enrollment_details(courses)
	courses = get_course_card_details(courses)
	return courses


def get_course_card_details(courses: list) -> list:
	for course in courses:
		course.instructors = get_instructors("LMS Course", course.name)

		if course.paid_course and course.published == 1:
			course.amount, course.currency = check_multicurrency(
				course.course_price, course.currency, None, course.amount_usd
			)
			course.price = fmt_money(course.amount, 0, course.currency)

	return courses


def get_course_or_filters(filters: dict) -> dict:
	or_filters = {}
	or_filters.update({"title": filters.get("title")})
	or_filters.update({"short_introduction": filters.get("title")})
	or_filters.update({"description": filters.get("title")})
	or_filters.update({"tags": filters.get("title")})
	return or_filters


def update_course_filters(filters: dict) -> tuple:
	or_filters = {}
	show_featured = False

	if filters.get("title"):
		or_filters = get_course_or_filters(filters)
		del filters["title"]

	if filters.get("enrolled"):
		enrolled_courses = frappe.get_all("LMS Enrollment", {"member": frappe.session.user}, pluck="course")
		filters.update({"name": ["in", enrolled_courses]})
		del filters["enrolled"]

	if filters.get("created"):
		created_courses = frappe.get_all(
			"Course Instructor", {"instructor": frappe.session.user}, pluck="parent"
		)
		filters.update({"name": ["in", created_courses]})
		del filters["created"]

	if filters.get("live"):
		filters.update({"featured": 0})
		show_featured = True
		del filters["live"]

	if filters.get("certification"):
		or_filters.update({"enable_certification": 1})
		or_filters.update({"paid_certificate": 1})
		del filters["certification"]

	return filters, or_filters, show_featured


def get_enrollment_details(courses: list) -> list:
	for course in courses:
		filters = {
			"course": course.name,
			"member": frappe.session.user,
		}

		if frappe.db.exists("LMS Enrollment", filters):
			course.membership = frappe.db.get_value(
				"LMS Enrollment",
				filters,
				["name", "course", "current_lesson", "progress", "member"],
				as_dict=1,
			)

	return courses


def get_featured_courses(filters: dict, or_filters: dict, fields: list) -> list:
	filters.update({"featured": 1})
	featured_courses = frappe.get_all(
		"LMS Course",
		filters=filters,
		fields=fields,
		or_filters=or_filters,
		order_by="enrollments desc",
	)
	return featured_courses


def get_course_fields():
	return [
		"name",
		"title",
		"tags",
		"image",
		"video_link",
		"card_gradient",
		"short_introduction",
		"description",
		"published",
		"upcoming",
		"featured",
		"disable_self_learning",
		"published_on",
		"category",
		"status",
		"paid_course",
		"paid_certificate",
		"course_price",
		"currency",
		"amount_usd",
		"enable_certification",
		"lessons",
		"enrollments",
		"rating",
	]


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_course_details(course: str):
	if not guest_access_allowed():
		return {}

	is_course_published = frappe.db.get_value("LMS Course", course, "published")
	membership = get_membership(course)
	if not is_course_published and not can_modify_course(course) and not membership:
		return {}

	fields = get_course_fields()
	course_details = frappe.db.get_value(
		"LMS Course",
		course,
		fields,
		as_dict=1,
	)

	course_details.instructors = get_instructors("LMS Course", course_details.name)
	course_details.membership = membership
	# course_details.is_instructor = is_instructor(course_details.name)
	if course_details.paid_course or course_details.paid_certificate:
		"""course_details.course_price, course_details.currency = check_multicurrency(
				course_details.course_price, course_details.currency, None, course_details.amount_usd
		)"""
		course_details.price = fmt_money(course_details.course_price, 0, course_details.currency)

	if frappe.session.user == "Guest":
		course_details.is_instructor = False

	if course_details.membership and course_details.membership.current_lesson:
		course_details.current_lesson = get_lesson_index(course_details.membership.current_lesson)

	return course_details


def get_categorized_courses(courses: list) -> dict:
	live, upcoming, new, enrolled, created, under_review = [], [], [], [], [], []

	for course in courses:
		if course.status == "Under Review":
			under_review.append(course)
		elif course.published and course.upcoming:
			upcoming.append(course)
		elif course.published:
			live.append(course)

		if course.published and not course.upcoming and course.published_on > add_months(getdate(), -3):
			new.append(course)

		if course.membership:
			enrolled.append(course)
		elif course.is_instructor:
			created.append(course)

		categories = [live, enrolled, created]
		for category in categories:
			category.sort(key=lambda x: cint(x.enrollments), reverse=True)

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
def get_course_outline(course: str, progress: bool = False) -> list:
	"""Returns the course outline."""

	if not guest_access_allowed():
		return []

	outline = []
	chapters = frappe.get_all("Chapter Reference", {"parent": course}, ["chapter", "idx"], order_by="idx")
	for chapter in chapters:
		chapter_details = frappe.db.get_value(
			"Course Chapter",
			chapter.chapter,
			["name", "title", "is_scorm_package", "launch_file", "scorm_package"],
			as_dict=True,
		)
		chapter_details["idx"] = chapter.idx
		chapter_details.lessons = get_lessons(course, chapter_details, progress=progress)

		if chapter_details.is_scorm_package:
			chapter_details.scorm_package = frappe.db.get_value(
				"File",
				chapter_details.scorm_package,
				["file_name", "file_size", "file_url"],
				as_dict=1,
			)

		outline.append(chapter_details)
	return outline


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_lesson(course: str, chapter: int, lesson: int) -> dict:
	if not guest_access_allowed():
		return {}

	chapter_name = frappe.db.get_value("Chapter Reference", {"parent": course, "idx": chapter}, "chapter")
	lesson_name = frappe.db.get_value("Lesson Reference", {"parent": chapter_name, "idx": lesson}, "lesson")
	lesson_details = frappe.db.get_value(
		"Course Lesson",
		lesson_name,
		["include_in_preview", "title", "is_scorm_package"],
		as_dict=1,
	)

	if not lesson_details:
		return {}

	if lesson_details.is_scorm_package:
		return {
			"is_scorm_package": True,
			"chapter_name": chapter_name,
		}

	membership = get_membership(course)
	course_info = frappe.db.get_value(
		"LMS Course",
		course,
		["title", "paid_certificate", "disable_self_learning"],
		as_dict=1,
	)

	if not lesson_details.include_in_preview and not membership and not can_modify_course(course):
		return {
			"no_preview": 1,
			"title": lesson_details.title,
			"course_title": course_info.title,
			"disable_self_learning": course_info.disable_self_learning,
		}

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

	lesson_details.chapter_title = frappe.db.get_value("Course Chapter", chapter_name, "title")
	neighbours = get_neighbour_lesson(course, chapter, lesson)
	lesson_details.next = neighbours["next"]
	lesson_details.progress = progress
	lesson_details.prev = neighbours["prev"]
	lesson_details.membership = membership
	lesson_details.icon = get_lesson_icon(lesson_details.body, lesson_details.content)
	lesson_details.instructors = get_instructors("LMS Course", course)
	lesson_details.course_title = course_info.title
	lesson_details.paid_certificate = course_info.paid_certificate
	lesson_details.disable_self_learning = course_info.disable_self_learning
	lesson_details.videos = get_video_details(lesson_name)
	return lesson_details


def get_video_details(lesson_name: str) -> list:
	return frappe.get_all(
		"LMS Video Watch Duration",
		{"lesson": lesson_name, "member": frappe.session.user},
		["source", "watch_time"],
	)


def get_neighbour_lesson(course: str, chapter: int, lesson: int) -> dict:
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
@rate_limit(limit=500, seconds=60 * 60)
def get_batch_details(batch: str):
	if not guest_access_allowed():
		return {}

	batch_students = frappe.get_all("LMS Batch Enrollment", {"batch": batch}, pluck="member")
	is_batch_admin = can_modify_batch(batch)
	is_batch_published = frappe.db.get_value("LMS Batch", batch, "published")
	is_student_enrolled = frappe.session.user in batch_students

	if not (is_batch_published or is_batch_admin or is_student_enrolled):
		return

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
			"certification",
			"timezone",
			"category",
			"zoom_account",
		],
		as_dict=True,
	)

	batch_details.instructors = get_instructors("LMS Batch", batch)
	batch_details.accept_enrollments = batch_details.start_date > getdate()

	if (
		not batch_details.accept_enrollments
		and batch_details.start_date == getdate()
		and get_time_str(batch_details.start_time) > nowtime()
	):
		batch_details.accept_enrollments = True

	batch_details.courses = frappe.get_all(
		"Batch Course", filters={"parent": batch}, fields=["course", "title", "evaluator"]
	)
	if can_modify_batch(batch):
		batch_details.students = batch_students
	elif is_student_enrolled:
		batch_details.students = [frappe.session.user]

	if batch_details.paid_batch and batch_details.start_date >= getdate():
		batch_details.amount, batch_details.currency = check_multicurrency(
			batch_details.amount, batch_details.currency, None, batch_details.amount_usd
		)
		batch_details.price = fmt_money(batch_details.amount, 0, batch_details.currency)

	if batch_details.seat_count:
		batch_details.seats_left = batch_details.seat_count - len(batch_students)

	return batch_details


def categorize_batches(batches: list) -> dict:
	upcoming, archived, private, enrolled = [], [], [], []

	for batch in batches:
		if not batch.published:
			private.append(batch)
		elif getdate(batch.start_date) < getdate():
			archived.append(batch)
		elif getdate(batch.start_date) == getdate() and get_time_str(batch.start_time) < nowtime():
			archived.append(batch)
		else:
			upcoming.append(batch)

		if frappe.session.user != "Guest":
			if frappe.db.exists("LMS Batch Enrollment", {"member": frappe.session.user, "batch": batch.name}):
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
def get_question_details(question: str) -> dict:
	fields = ["question", "type", "multiple"]
	for i in range(1, 5):
		fields.append(f"option_{i}")
		fields.append(f"explanation_{i}")

	question_details = frappe.db.get_value("LMS Question", question, fields, as_dict=1)
	return question_details


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_batch_courses(batch: str) -> list:
	if not guest_access_allowed():
		return []

	courses = []
	course_list = frappe.get_all("Batch Course", {"parent": batch}, ["name", "course"])

	for course in course_list:
		details = get_course_details(course.course)
		if details.get("name"):
			details.batch_course = course.name
			courses.append(details)

	return courses


@frappe.whitelist()
def get_assessments(batch: str) -> list:
	member = frappe.session.user
	assessments = frappe.get_all(
		"LMS Assessment",
		{"parent": batch},
		["name", "assessment_type", "assessment_name"],
		order_by="idx",
	)

	for assessment in assessments:
		if assessment.assessment_type == "LMS Assignment":
			assessment = get_assignment_details(assessment, member)

		elif assessment.assessment_type == "LMS Quiz":
			assessment = get_quiz_details(assessment, member)

		elif assessment.assessment_type == "LMS Programming Exercise":
			assessment = get_exercise_details(assessment, member)

	return assessments


def get_assignment_details(assessment: dict, member: str) -> dict:
	assessment.title = frappe.db.get_value("LMS Assignment", assessment.assessment_name, "title")

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
	assessment.url = get_lms_route(f"assignment-submission/{assessment.assessment_name}/{submission_name}")

	return assessment


def get_quiz_details(assessment: dict, member: str) -> dict:
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
		assessment.status = assessment.submission.percentage or assessment.submission.score
	else:
		assessment.status = "Not Attempted"
		assessment.color = "red"
		assessment.completed = False

	assessment.edit_url = f"/quizzes/{assessment.assessment_name}"
	submission_name = existing_submission[0].name if len(existing_submission) else "new-submission"
	assessment.url = f"/quiz-submission/{assessment.assessment_name}/{submission_name}"

	return assessment


def get_exercise_details(assessment: dict, member: str) -> dict:
	assessment.title = frappe.db.get_value("LMS Programming Exercise", assessment.assessment_name, "title")
	filters = {"member": member, "exercise": assessment.assessment_name}

	if frappe.db.exists("LMS Programming Exercise Submission", filters):
		assessment.submission = frappe.db.get_value(
			"LMS Programming Exercise Submission",
			filters,
			["name", "status"],
			as_dict=True,
		)
		assessment.completed = True
		assessment.status = assessment.submission.status
		assessment.edit_url = (
			f"/exercises/{assessment.assessment_name}/submission/{assessment.submission.name}"
		)
	else:
		assessment.status = "Not Attempted"
		assessment.color = "red"
		assessment.completed = False
		assessment.edit_url = f"/exercises/{assessment.assessment_name}/submission/new"


@frappe.whitelist()
def get_batch_assessment_count(batch: str) -> int:
	frappe.only_for(["Moderator", "Batch Evaluator"])
	if not frappe.db.exists("LMS Batch", batch):
		frappe.throw(_("The specified batch does not exist."))
	return frappe.db.count("LMS Assessment", {"parent": batch})


@frappe.whitelist()
def get_batch_students(
	filters: dict, offset: int = 0, limit_start: int = 0, limit_page_length: int = None, limit: int = None
):
	# limit_start and limit_page_length are used for backward compatibility
	start = limit_start or offset
	page_length = limit_page_length or limit
	batch = filters.get("batch")
	if not batch:
		return []

	if not can_modify_batch(batch):
		frappe.throw(_("You are not authorized to view the students of this batch."))

	students = []
	students_list = frappe.get_all(
		"LMS Batch Enrollment",
		filters={"batch": batch},
		fields=["member", "name"],
		offset=start,
		limit=page_length,
		order_by="creation desc",
	)

	for student in students_list:
		details = get_batch_student_details(student)
		calculate_student_progress(batch, details)
		students.append(details)

	return students


def get_course_completion_stats(batch: str) -> list:
	"""Get completion counts per course in batch"""
	BatchCourse = frappe.qb.DocType("Batch Course")
	BatchEnrollment = frappe.qb.DocType("LMS Batch Enrollment")
	Enrollment = frappe.qb.DocType("LMS Enrollment")

	rows = (
		frappe.qb.from_(BatchCourse)
		.left_join(BatchEnrollment)
		.on(BatchEnrollment.batch == BatchCourse.parent)
		.left_join(Enrollment)
		.on((Enrollment.course == BatchCourse.course) & (Enrollment.member == BatchEnrollment.member))
		.where(BatchCourse.parent == batch)
		.groupby(BatchCourse.course, BatchCourse.title)
		.select(
			BatchCourse.title,
			fn.Count(Case().when(Enrollment.progress == 100, Enrollment.member)).distinct().as_("completed"),
		)
	).run(as_dict=True)

	return [{"task": row.title, "value": row.completed or 0} for row in rows]


def get_assignment_pass_stats(batch: str) -> list:
	"""Get pass counts per assignment in batch"""
	Assessment = frappe.qb.DocType("LMS Assessment")
	Assignment = frappe.qb.DocType("LMS Assignment")
	BatchEnrollment = frappe.qb.DocType("LMS Batch Enrollment")
	Submission = frappe.qb.DocType("LMS Assignment Submission")

	rows = (
		frappe.qb.from_(Assessment)
		.join(Assignment)
		.on(Assignment.name == Assessment.assessment_name)
		.left_join(BatchEnrollment)
		.on(BatchEnrollment.batch == Assessment.parent)
		.left_join(Submission)
		.on(
			(Submission.assignment == Assessment.assessment_name)
			& (Submission.member == BatchEnrollment.member)
		)
		.where((Assessment.parent == batch) & (Assessment.assessment_type == "LMS Assignment"))
		.groupby(Assessment.assessment_name, Assignment.title)
		.select(
			Assignment.title,
			fn.Count(Case().when(Submission.status == "Pass", Submission.member)).distinct().as_("passed"),
		)
	).run(as_dict=True)

	return [{"task": row.title, "value": row.passed or 0} for row in rows]


def get_quiz_pass_stats(batch: str) -> list:
	"""Get pass counts per quiz in batch"""
	Assessment = frappe.qb.DocType("LMS Assessment")
	Quiz = frappe.qb.DocType("LMS Quiz")
	BatchEnrollment = frappe.qb.DocType("LMS Batch Enrollment")
	Submission = frappe.qb.DocType("LMS Quiz Submission")

	rows = (
		frappe.qb.from_(Assessment)
		.join(Quiz)
		.on(Quiz.name == Assessment.assessment_name)
		.left_join(BatchEnrollment)
		.on(BatchEnrollment.batch == Assessment.parent)
		.left_join(Submission)
		.on((Submission.quiz == Assessment.assessment_name) & (Submission.member == BatchEnrollment.member))
		.where((Assessment.parent == batch) & (Assessment.assessment_type == "LMS Quiz"))
		.groupby(Assessment.assessment_name, Quiz.title)
		.select(
			Quiz.title,
			fn.Count(Case().when(Submission.percentage >= Submission.passing_percentage, Submission.member))
			.distinct()
			.as_("passed"),
		)
	).run(as_dict=True)

	return [{"task": row.title, "value": row.passed or 0} for row in rows]


@frappe.whitelist()
def get_batch_chart_data(batch: str) -> list:
	"""Get completion counts per course and assessment"""
	if not can_modify_batch(batch):
		frappe.throw(_("You are not authorized to view the chart data of this batch."))
	if not frappe.db.exists("LMS Batch", batch):
		frappe.throw(_("The specified batch does not exist."))

	return get_course_completion_stats(batch) + get_assignment_pass_stats(batch) + get_quiz_pass_stats(batch)


def get_batch_student_details(student: dict) -> dict:
	details = frappe.db.get_value(
		"User",
		student.member,
		["full_name", "email", "username", "last_active", "user_image"],
		as_dict=True,
	)
	details.last_active = format_datetime(details.last_active, "dd MMM YY")
	details.name = student.name
	details.assessments = frappe._dict()
	return details


def calculate_student_progress(batch: str, details: dict):
	batch_courses = frappe.get_all("Batch Course", {"parent": batch}, ["course", "title"])
	assessments = frappe.get_all(
		"LMS Assessment",
		filters={"parent": batch},
		fields=["name", "assessment_type", "assessment_name"],
	)

	calculate_course_progress(batch_courses, details)
	calculate_assessment_progress(assessments, details)

	if len(batch_courses) + len(assessments):
		details.progress = flt(
			(
				(details.average_course_progress * len(batch_courses))
				+ (details.average_assessments_progress * len(assessments))
			)
			/ (len(batch_courses) + len(assessments)),
			2,
		)
	else:
		details.progress = 0


def calculate_course_progress(batch_courses: list, details: dict):
	course_progress = []
	details.courses = frappe._dict()

	for course in batch_courses:
		progress = (
			frappe.db.get_value(
				"LMS Enrollment", {"course": course.course, "member": details.email}, "progress"
			)
			or 0
		)
		details.courses[course.title] = progress
		course_progress.append(progress)

	details.average_course_progress = (
		flt(sum(course_progress) / len(batch_courses), 2) if len(batch_courses) else 0
	)


def calculate_assessment_progress(assessments: list, details: dict):
	assessments_completed = 0
	details.assessments = frappe._dict()

	for assessment in assessments:
		title = frappe.db.get_value(assessment.assessment_type, assessment.assessment_name, "title")
		assessment_info = has_submitted_assessment(
			assessment.assessment_name, assessment.assessment_type, details.email
		)
		details.assessments[title] = assessment_info

		if assessment_info.result == "Pass":
			assessments_completed += 1

	details.average_assessments_progress = (
		flt((assessments_completed / len(assessments) * 100), 2) if len(assessments) else 0
	)


def has_submitted_assessment(assessment: str, assessment_type: str, member: str = None):
	if not member:
		member = frappe.session.user

	if assessment_type == "LMS Assignment":
		doctype = "LMS Assignment Submission"
		docfield = "assignment"
		fields = ["status"]
		not_attempted = "Not Attempted"
	elif assessment_type == "LMS Quiz":
		doctype = "LMS Quiz Submission"
		docfield = "quiz"
		fields = ["percentage"]
		not_attempted = 0
	elif assessment_type == "LMS Programming Exercise":
		doctype = "LMS Programming Exercise Submission"
		docfield = "exercise"
		fields = ["status"]
		not_attempted = "Not Attempted"

	filters = {}
	filters[docfield] = assessment
	filters["member"] = member

	attempt = frappe.db.exists(doctype, filters)
	if attempt:
		fields.append("name")
		attempt_details = frappe.db.get_value(doctype, filters, fields, as_dict=1)
		if assessment_type == "LMS Quiz":
			result = "Failed"
			passing_percentage = frappe.db.get_value("LMS Quiz", assessment, "passing_percentage")
			if attempt_details.percentage >= passing_percentage:
				result = "Pass"
		else:
			result = attempt_details.status
		return frappe._dict(
			{
				"status": attempt_details.percentage
				if assessment_type == "LMS Quiz"
				else attempt_details.status,
				"result": result,
				"assessment": assessment,
				"type": assessment_type,
				"submission": attempt_details.name,
			}
		)
	else:
		return frappe._dict(
			{
				"status": not_attempted,
				"result": "Failed",
			}
		)


def can_access_topic(doctype: str, docname: str) -> bool:
	is_student = False
	if doctype == "Course Lesson":
		course = frappe.db.get_value("Course Lesson", docname, "course")
		is_student = frappe.db.exists("LMS Enrollment", {"course": course, "member": frappe.session.user})
		if not is_student and not can_modify_course(course):
			return False
	elif doctype == "LMS Batch":
		is_student = frappe.db.exists(
			"LMS Batch Enrollment", {"batch": docname, "member": frappe.session.user}
		)
		if not is_student and not can_modify_batch(docname):
			return False
	return True


@frappe.whitelist()
def get_discussion_topics(doctype: str, docname: str, single_thread: bool = False):
	if not can_access_topic(doctype, docname):
		frappe.throw(_("You are not authorized to view the discussion topics for this item."))

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
		topic.user = frappe.db.get_value("User", topic.owner, ["full_name", "user_image"], as_dict=True)

	return topics


def create_discussion_topic(doctype: str, docname: str) -> str:
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
def get_discussion_replies(topic: str):
	topic_details = frappe.db.get_value(
		"Discussion Topic", topic, ["reference_doctype", "reference_docname"], as_dict=1
	)
	if not can_access_topic(topic_details.reference_doctype, topic_details.reference_docname):
		frappe.throw(_("You are not authorized to view the discussion replies for this topic."))

	replies = frappe.get_all(
		"Discussion Reply",
		{
			"topic": topic,
		},
		["name", "owner", "creation", "modified", "reply"],
		order_by="creation",
	)

	for reply in replies:
		reply.user = frappe.db.get_value("User", reply.owner, ["full_name", "user_image"], as_dict=True)

	return replies


@frappe.whitelist()
def get_order_summary(doctype: str, docname: str, coupon: str = None, country: str = None):
	details = get_paid_course_details(docname) if doctype == "LMS Course" else get_paid_batch_details(docname)

	details.amount, details.currency = check_multicurrency(
		details.amount, details.currency, country, details.amount_usd
	)

	details.original_amount = details.amount
	details.original_amount_formatted = fmt_money(details.amount, 0, details.currency)

	adjust_amount_for_coupon(details, coupon, doctype, docname)
	get_gst_details(details, country)

	details.total_amount = details.amount
	details.total_amount_formatted = fmt_money(details.amount, 0, details.currency)

	return details


def get_paid_course_details(docname: str) -> dict:
	details = frappe.db.get_value(
		"LMS Course",
		docname,
		[
			"title",
			"name",
			"paid_course",
			"paid_certificate",
			"course_price as amount",
			"currency",
			"amount_usd",
		],
		as_dict=True,
	)

	if not details.paid_course and not details.paid_certificate:
		raise frappe.throw(_("This course is free."))

	return details


def get_paid_batch_details(docname: str) -> dict:
	details = frappe.db.get_value(
		"LMS Batch",
		docname,
		["title", "name", "paid_batch", "amount", "currency", "amount_usd"],
		as_dict=True,
	)

	if not details.paid_batch:
		raise frappe.throw(_("To join this batch, please contact the Administrator."))

	return details


def adjust_amount_for_coupon(details: dict, coupon: str, doctype: str, docname: str):
	if not coupon:
		return
	discount_amount, subtotal, coupon_name = apply_coupon(doctype, docname, coupon, details.amount)
	details.amount = subtotal
	details.discount_amount = discount_amount
	details.discount_amount_formatted = fmt_money(discount_amount, 0, details.currency)
	details.coupon = coupon_name


def get_gst_details(details: dict, country: str):
	if details.currency != "INR":
		return

	details.amount, details.gst_applied = apply_gst(details.amount, country)
	details.gst_amount_formatted = fmt_money(details.gst_applied, 0, details.currency)


def apply_coupon(doctype: str, docname: str, code: str, base_amount: float):
	coupon_name = frappe.db.exists("LMS Coupon", {"code": code, "enabled": 1})
	if not coupon_name:
		frappe.throw(_("The coupon code '{0}' is invalid.").format(code))

	coupon = frappe.db.get_value(
		"LMS Coupon",
		coupon_name,
		[
			"expires_on",
			"usage_limit",
			"redemption_count",
			"discount_type",
			"percentage_discount",
			"fixed_amount_discount",
			"name",
			"code",
		],
		as_dict=True,
	)

	validate_coupon(code, coupon)
	validate_coupon_applicability(doctype, docname, coupon_name)

	discount_amount = calculate_discount_amount(base_amount, coupon)
	subtotal = max(flt(base_amount) - flt(discount_amount), 0)

	return discount_amount, subtotal, coupon_name


def validate_coupon(code: str, coupon: dict):
	if coupon.expires_on and getdate(coupon.expires_on) < getdate():
		frappe.throw(_("This coupon has expired."))

	if coupon.usage_limit and cint(coupon.redemption_count) >= cint(coupon.usage_limit):
		frappe.throw(_("This coupon has reached its maximum usage limit."))


def validate_coupon_applicability(doctype: str, docname: str, coupon_name: str):
	applicable_item = frappe.db.exists(
		"LMS Coupon Item", {"parent": coupon_name, "reference_doctype": doctype, "reference_name": docname}
	)
	if not applicable_item:
		frappe.throw(
			_("This coupon is not applicable to this {0}.").format(
				"Course" if doctype == "LMS Course" else "Batch"
			)
		)


def calculate_discount_amount(base_amount: float, coupon: dict) -> float:
	discount_amount = 0

	if coupon.discount_type == "Percentage":
		discount_amount = (base_amount * coupon.percentage_discount) / 100
	elif coupon.discount_type == "Fixed Amount":
		discount_amount = base_amount - coupon.fixed_amount_discount

	return discount_amount


@frappe.whitelist()
def get_lesson_creation_details(course: str, chapter: int, lesson: int) -> dict:
	frappe.only_for(["Moderator", "Course Creator"])
	chapter_name = frappe.db.get_value("Chapter Reference", {"parent": course, "idx": chapter}, "chapter")
	lesson_name = frappe.db.get_value("Lesson Reference", {"parent": chapter_name, "idx": lesson}, "lesson")

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
		"chapter": frappe.db.get_value("Course Chapter", chapter_name, ["title", "name"], as_dict=True),
		"lesson": lesson_details if lesson_name else None,
	}


@frappe.whitelist()
def get_roles(name: str) -> dict:
	frappe.only_for(["Moderator", "Batch Evaluator"])
	return {
		"moderator": has_moderator_role(name),
		"course_creator": has_course_instructor_role(name),
		"batch_evaluator": has_evaluator_role(name),
		"lms_student": has_student_role(name),
	}


def publish_notifications(doc: Document, method: str):
	frappe.publish_realtime("publish_lms_notifications", user=doc.for_user, after_commit=True)


def update_payment_record(doctype: str, docname: str):
	request = get_integration_requests(doctype, docname)

	if len(request):
		data = request[0].data
		data = frappe._dict(json.loads(data))
		payment_doc = get_payment_doc(data.payment)

		update_payment_details(data)
		update_coupon_redemption(payment_doc)

		if payment_doc.payment_for_certificate:
			update_certificate_purchase(docname, data.payment)
		elif doctype == "LMS Course":
			enroll_in_course(docname, data.payment)
		else:
			enroll_in_batch(docname, data.payment)


def get_integration_requests(doctype: str, docname: str):
	return frappe.get_all(
		"Integration Request",
		{
			"reference_doctype": doctype,
			"reference_docname": docname,
			"owner": frappe.session.user,
		},
		["data"],
		order_by="creation desc",
		limit=1,
	)


def get_payment_doc(payment_name: str) -> dict:
	return frappe.db.get_value(
		"LMS Payment", payment_name, ["name", "coupon", "payment_for_certificate"], as_dict=True
	)


def update_payment_details(data: dict):
	payment_id = get_payment_id(data)

	frappe.db.set_value(
		"LMS Payment",
		data.payment,
		{
			"payment_received": 1,
			"payment_id": data.get(payment_id),
			"order_id": data.get("order_id"),
		},
	)


def get_payment_id(data: dict) -> str:
	payment_gateway = data.get("payment_gateway")
	if payment_gateway == "Razorpay":
		payment_id = "razorpay_payment_id"
	elif "Stripe" in payment_gateway:
		payment_id = "stripe_token_id"
	else:
		payment_id = "order_id"
	return payment_id


def update_coupon_redemption(payment_doc: dict):
	if payment_doc.coupon:
		redemption_count = frappe.db.get_value("LMS Coupon", payment_doc.coupon, "redemption_count") or 0

		frappe.db.set_value(
			"LMS Coupon",
			payment_doc.coupon,
			"redemption_count",
			redemption_count + 1,
		)


def enroll_in_course(course: str, payment_name: str):
	if not frappe.db.exists("LMS Enrollment", {"member": frappe.session.user, "course": course}):
		enrollment = frappe.new_doc("LMS Enrollment")
		payment = frappe.db.get_value("LMS Payment", payment_name, ["name", "source"], as_dict=True)

		enrollment.update(
			{
				"member": frappe.session.user,
				"course": course,
				"payment": payment.name,
			}
		)
		enrollment.save(ignore_permissions=True)


@frappe.whitelist()
def enroll_in_batch(batch: str, payment_name: str = None):
	if not frappe.db.exists("LMS Batch", batch):
		frappe.throw(_("The specified batch does not exist."))

	payment_doc = get_payment_details(payment_name)
	create_enrollment(batch, payment_doc)


def get_payment_details(payment_name: str) -> dict:
	payment_doc = None
	if payment_name:
		payment_doc = frappe.db.get_value(
			"LMS Payment", payment_name, ["name", "source", "payment_received"], as_dict=True
		)
	return payment_doc


def create_enrollment(batch: str, payment_doc: dict = None):
	new_student = frappe.new_doc("LMS Batch Enrollment")
	new_student.update(
		{
			"member": frappe.session.user,
			"batch": batch,
		}
	)

	if payment_doc:
		new_student.update(
			{
				"payment": payment_doc.name,
				"source": payment_doc.source,
			}
		)
	new_student.save()


def update_certificate_purchase(course: str, payment_name: str):
	frappe.db.set_value(
		"LMS Enrollment",
		{"member": frappe.session.user, "course": course},
		{
			"purchased_certificate": 1,
			"payment": payment_name,
		},
	)


@frappe.whitelist()
def get_programs():
	if not guest_access_allowed():
		frappe.throw(_("Please login to view programs."))

	enrolled_programs = frappe.get_all(
		"LMS Program Member", {"member": frappe.session.user}, ["parent as name", "progress"]
	)
	for program in enrolled_programs:
		program.update(
			frappe.db.get_value(
				"LMS Program", program.name, ["name", "course_count", "member_count"], as_dict=True
			)
		)

	published_programs = frappe.get_all(
		"LMS Program",
		{
			"published": 1,
		},
		["name", "course_count", "member_count"],
	)

	programs_to_remove = []
	for program in published_programs:
		if program.name in [p.name for p in enrolled_programs]:
			programs_to_remove.append(program)
	published_programs = [program for program in published_programs if program not in programs_to_remove]

	return {
		"enrolled": enrolled_programs,
		"published": published_programs,
	}


@frappe.whitelist()
def get_program_details(program_name: str) -> dict:
	if not guest_access_allowed():
		frappe.throw(_("Please login to view program details."))

	is_published = frappe.db.get_value("LMS Program", program_name, "published")
	is_member = frappe.db.exists(
		"LMS Program Member", {"parent": program_name, "member": frappe.session.user}
	)
	if not is_published and not is_member:
		frappe.throw(_("You are not authorized to view the details of this program."))

	program = frappe.db.get_value(
		"LMS Program",
		program_name,
		[
			"name",
			"member_count",
			"course_count",
			"published",
			"enforce_course_order",
		],
		as_dict=1,
	)
	program_courses = frappe.get_all(
		"LMS Program Course", {"parent": program_name}, ["course"], order_by="idx"
	)

	program.courses = []
	previous_progress = 0
	for i, course in enumerate(program_courses):
		details = get_course_details(course.course)
		if i == 0:
			details.eligible = True
		elif previous_progress == 100:
			details.eligible = True
		else:
			details.eligible = False

		previous_progress = details.membership.progress if details.membership else 0
		program.courses.append(details)
		if frappe.session.user != "Guest":
			program.progress = frappe.db.get_value(
				"LMS Program Member",
				{"parent": program_name, "member": frappe.session.user},
				"progress",
			)

	return program


@frappe.whitelist()
def enroll_in_program(program: str):
	validate_program_enrollment(program)

	if not frappe.db.exists("LMS Program Member", {"parent": program, "member": frappe.session.user}):
		program_member = frappe.new_doc("LMS Program Member")
		program_member.update(
			{
				"parent": program,
				"parenttype": "LMS Program",
				"parentfield": "members",
				"member": frappe.session.user,
			}
		)
		program_member.save(ignore_permissions=True)


def validate_program_enrollment(program: str):
	published = frappe.db.get_value("LMS Program", program, "published")
	if not published:
		frappe.throw(_("You cannot enroll in an unpublished program."))


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_batches(filters: dict = None, start: int = 0, order_by: str = "start_date"):
	if not guest_access_allowed():
		return []

	if not filters:
		filters = {}

	if filters.get("enrolled"):
		enrolled_batches = frappe.get_all(
			"LMS Batch Enrollment", {"member": frappe.session.user}, pluck="batch"
		)
		filters.update({"name": ["in", enrolled_batches]})
		del filters["enrolled"]

	batches = frappe.get_all(
		"LMS Batch",
		filters=filters,
		fields=[
			"name",
			"title",
			"description",
			"seat_count",
			"paid_batch",
			"amount",
			"amount_usd",
			"currency",
			"start_date",
			"end_date",
			"start_time",
			"end_time",
			"timezone",
			"published",
			"category",
		],
		order_by=order_by,
		start=start,
		page_length=20,
	)

	batches = filter_batches_based_on_start_time(batches, filters)
	batches = get_batch_card_details(batches)
	return batches


def filter_batches_based_on_start_time(batches: list, filters: dict) -> list:
	batchType = get_batch_type(filters)
	if batchType == "upcoming":
		batches_to_remove = [
			batch
			for batch in batches
			if getdate(batch.start_date) == getdate() and get_time_str(batch.start_time) < nowtime()
		]
		batches = [batch for batch in batches if batch not in batches_to_remove]
	elif batchType == "archived":
		batches_to_remove = [
			batch
			for batch in batches
			if getdate(batch.start_date) == getdate() and get_time_str(batch.start_time) >= nowtime()
		]
		batches = [batch for batch in batches if batch not in batches_to_remove]
	return batches


def get_batch_type(filters: dict) -> str:
	start_date_filter = filters.get("start_date")
	batchType = None
	if start_date_filter:
		sign = start_date_filter[0]
		if ">" in sign:
			batchType = "upcoming"
		elif "<" in sign:
			batchType = "archived"

	return batchType


def get_batch_card_details(batches: list) -> list:
	for batch in batches:
		batch.instructors = get_instructors("LMS Batch", batch.name)
		students_count = frappe.db.count("LMS Batch Enrollment", {"batch": batch.name})

		if batch.seat_count:
			batch.seats_left = batch.seat_count - students_count

		if batch.paid_batch and batch.start_date >= getdate():
			batch.amount, batch.currency = check_multicurrency(
				batch.amount, batch.currency, None, batch.amount_usd
			)
			batch.price = fmt_money(batch.amount, 0, batch.currency)

	return batches


def get_palette(full_name: str) -> list:
	"""
	Returns a color unique to each member for Avatar"""

	palette = [
		["--orange-avatar-bg", "--orange-avatar-color"],
		["--pink-avatar-bg", "--pink-avatar-color"],
		["--blue-avatar-bg", "--blue-avatar-color"],
		["--green-avatar-bg", "--green-avatar-color"],
		["--dark-green-avatar-bg", "--dark-green-avatar-color"],
		["--red-avatar-bg", "--red-avatar-color"],
		["--yellow-avatar-bg", "--yellow-avatar-color"],
		["--purple-avatar-bg", "--purple-avatar-color"],
		["--gray-avatar-bg", "--gray-avatar-color0"],
	]

	encoded_name = str(full_name).encode("utf-8")
	hash_name = hashlib.md5(encoded_name).hexdigest()
	idx = cint((int(hash_name[4:6], 16) + 1) / 5.33)
	return palette[idx % 8]


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=500, seconds=60 * 60)
def get_related_courses(course: str) -> list:
	if not guest_access_allowed():
		return []

	related_course_details = []
	related_courses = frappe.get_all("Related Courses", {"parent": course}, order_by="idx", pluck="course")

	for related_course in related_courses:
		related_course_details.append(get_course_details(related_course))
	return related_course_details


def persona_captured():
	frappe.db.set_single_value("LMS Settings", "persona_captured", 1)


def validate_discussion_reply(doc: Document, method: str):
	topic = frappe.db.get_value(
		"Discussion Topic", doc.topic, ["reference_doctype", "reference_docname"], as_dict=True
	)

	if topic.reference_doctype == "Course Lesson":
		validate_course_access(topic.reference_docname)

	elif topic.reference_doctype == "LMS Batch":
		validate_batch_access(topic.reference_docname)


def validate_course_access(lesson: str):
	if not frappe.db.exists("Course Lesson", lesson):
		frappe.throw(_("The lesson does not exist."))

	if has_moderator_role():
		return

	if has_course_instructor_role():
		return

	course = frappe.db.get_value("Course Lesson", lesson, "course")
	enrollment_exists = frappe.db.exists("LMS Enrollment", {"member": frappe.session.user, "course": course})
	if not enrollment_exists:
		frappe.throw(_("You do not have access to this course."))


def validate_batch_access(batch: str):
	if not frappe.db.exists("LMS Batch", batch):
		frappe.throw(_("The batch does not exist."))

	if has_moderator_role():
		return

	if has_evaluator_role():
		return

	enrollment_exists = frappe.db.exists(
		"LMS Batch Enrollment", {"member": frappe.session.user, "batch": batch}
	)
	if not enrollment_exists:
		frappe.throw(_("You do not have access to this batch."))


def can_modify_course(course: str) -> bool:
	is_instructor = frappe.db.exists(
		"Course Instructor",
		{"instructor": frappe.session.user, "parent": course, "parenttype": "LMS Course"},
	)
	if not (has_moderator_role() or is_instructor):
		return False
	return True


def can_modify_batch(batch: str) -> bool:
	is_instructor = frappe.db.exists(
		"Course Instructor",
		{
			"instructor": frappe.session.user,
			"parent": batch,
			"parenttype": "LMS Batch",
		},
	)
	if not (has_moderator_role() or is_instructor):
		return False
	return True
