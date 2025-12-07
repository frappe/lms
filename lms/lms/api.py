"""API methods for the LMS."""

import json
import os
import re
import shutil
import xml.etree.ElementTree as ET
import zipfile
from xml.dom.minidom import parseString

import frappe
from frappe import _
from frappe.integrations.frappe_providers.frappecloud_billing import (
	current_site_info,
	is_fc_site,
)
from frappe.query_builder import DocType
from frappe.translate import get_all_translations
from frappe.utils import (
	add_days,
	cint,
	date_diff,
	flt,
	format_date,
	get_datetime,
	now,
)
from frappe.utils.response import Response

from lms.lms.doctype.course_lesson.course_lesson import save_progress
from lms.lms.utils import get_average_rating, get_lesson_count, get_lesson
from lms.lms.ai_utils import (
    draft_assistant_reply,
    build_openai_chat_payload,
    call_ai_proxy,
    determine_effective_assistant_config,
    stream_ai_proxy,
    simple_guardrail_flags,
)
from lms.lms.ai_rag import (
    chunk_lesson,
    chunk_lesson_attachments,
    simple_retrieve,
    ensure_embeddings_for_lesson,
    rebuild_lesson_index_and_embeddings,
    rebuild_course_index_and_embeddings,
    index_external_source,
)


@frappe.whitelist()
def autosave_section(section, code):
	"""Saves the code edited in one of the sections."""
	doc = frappe.get_doc(doctype="Code Revision", section=section, code=code, author=frappe.session.user)
	doc.insert()
	return {"name": doc.name}


@frappe.whitelist()
def submit_solution(exercise, code):
	"""Submits a solution.

	@exerecise: name of the exercise to submit
	@code: solution to the exercise
	"""
	ex = frappe.get_doc("LMS Exercise", exercise)
	if not ex:
		return
	doc = ex.submit(code)
	return {"name": doc.name, "creation": doc.creation}


@frappe.whitelist()
def save_current_lesson(course_name, lesson_name):
	"""Saves the current lesson for a student/mentor."""
	name = frappe.get_value(
		doctype="LMS Enrollment",
		filters={"course": course_name, "member": frappe.session.user},
		fieldname="name",
	)
	if not name:
		return
	frappe.db.set_value("LMS Enrollment", name, "current_lesson", lesson_name)


@frappe.whitelist()
def join_cohort(course, cohort, subgroup, invite_code):
	"""Creates a Cohort Join Request for given user."""
	course_doc = frappe.get_doc("LMS Course", course)
	cohort_doc = course_doc and course_doc.get_cohort(cohort)
	subgroup_doc = cohort_doc and cohort_doc.get_subgroup(subgroup)

	if not subgroup_doc or subgroup_doc.invite_code != invite_code:
		return {"ok": False, "error": "Invalid join link"}

	data = {
		"doctype": "Cohort Join Request",
		"cohort": cohort_doc.name,
		"subgroup": subgroup_doc.name,
		"email": frappe.session.user,
		"status": "Pending",
	}
	# Don't insert duplicate records
	if frappe.db.exists(data):
		return {"ok": True, "status": "record found"}
	else:
		doc = frappe.get_doc(data)
		doc.insert()
		return {"ok": True, "status": "record created"}


@frappe.whitelist()
def approve_cohort_join_request(join_request):
	r = frappe.get_doc("Cohort Join Request", join_request)
	sg = r and frappe.get_doc("Cohort Subgroup", r.subgroup)
	if not sg or r.status not in ["Pending", "Accepted"]:
		return {"ok": False, "error": "Invalid Join Request"}
	if not sg.is_manager(frappe.session.user) and "System Manager" not in frappe.get_roles():
		return {"ok": False, "error": "Permission Deined"}

	r.status = "Accepted"
	r.save()
	return {"ok": True}


@frappe.whitelist()
def reject_cohort_join_request(join_request):
	r = frappe.get_doc("Cohort Join Request", join_request)
	sg = r and frappe.get_doc("Cohort Subgroup", r.subgroup)
	if not sg or r.status not in ["Pending", "Rejected"]:
		return {"ok": False, "error": "Invalid Join Request"}
	if not sg.is_manager(frappe.session.user) and "System Manager" not in frappe.get_roles():
		return {"ok": False, "error": "Permission Deined"}

	r.status = "Rejected"
	r.save()
	return {"ok": True}


@frappe.whitelist()
def undo_reject_cohort_join_request(join_request):
	r = frappe.get_doc("Cohort Join Request", join_request)
	sg = r and frappe.get_doc("Cohort Subgroup", r.subgroup)
	# keeping Pending as well to consider the case of duplicate requests
	if not sg or r.status not in ["Pending", "Rejected"]:
		return {"ok": False, "error": "Invalid Join Request"}
	if not sg.is_manager(frappe.session.user) and "System Manager" not in frappe.get_roles():
		return {"ok": False, "error": "Permission Deined"}

	r.status = "Pending"
	r.save()
	return {"ok": True}


@frappe.whitelist(allow_guest=True)
def get_user_info():
	if frappe.session.user == "Guest":
		return None

	user = frappe.db.get_value(
		"User",
		frappe.session.user,
		["name", "email", "enabled", "user_image", "full_name", "user_type", "username"],
		as_dict=1,
	)
	user["roles"] = frappe.get_roles(user.name)
	user.is_instructor = "Course Creator" in user.roles
	user.is_moderator = "Moderator" in user.roles
	user.is_evaluator = "Batch Evaluator" in user.roles
	user.is_student = not user.is_instructor and not user.is_moderator and not user.is_evaluator
	user.is_fc_site = is_fc_site()
	user.is_system_manager = "System Manager" in user.roles
	user.sitename = frappe.local.site
	user.developer_mode = frappe.conf.developer_mode
	if user.is_fc_site and user.is_system_manager:
		user.site_info = current_site_info()
	return user


@frappe.whitelist(allow_guest=True)
def get_translations():
	if frappe.session.user != "Guest":
		language = frappe.db.get_value("User", frappe.session.user, "language")
	else:
		language = frappe.db.get_single_value("System Settings", "language")
	return get_all_translations(language)


@frappe.whitelist()
def validate_billing_access(billing_type, name):
	access = True
	message = ""
	doctype = "LMS Batch" if billing_type == "batch" else "LMS Course"

	if frappe.session.user == "Guest":
		access = False
		message = _("Please login to continue with payment.")

	if access and billing_type not in ["course", "batch", "certificate"]:
		access = False
		message = _("Module is incorrect.")

	if access and not frappe.db.exists(doctype, name):
		access = False
		message = _("Module Name is incorrect or does not exist.")

	if access and billing_type == "course":
		membership = frappe.db.exists("LMS Enrollment", {"member": frappe.session.user, "course": name})
		if membership:
			access = False
			message = _("You are already enrolled for this course.")

	elif access and billing_type == "batch":
		membership = frappe.db.exists("LMS Batch Enrollment", {"member": frappe.session.user, "batch": name})
		if membership:
			access = False
			message = _("You are already enrolled for this batch.")

		seat_count = frappe.get_cached_value("LMS Batch", name, "seat_count")
		number_of_students = frappe.db.count("LMS Batch Enrollment", {"batch": name})
		if seat_count <= number_of_students:
			access = False
			message = _("Batch is sold out.")

		start_date = frappe.get_cached_value("LMS Batch", name, "start_date")
		if start_date and date_diff(start_date, now()) < 0:
			access = False
			message = _("Batch has already started.")

	elif access and billing_type == "certificate":
		purchased_certificate = frappe.db.exists(
			"LMS Enrollment",
			{
				"course": name,
				"member": frappe.session.user,
				"purchased_certificate": 1,
			},
		)
		if purchased_certificate:
			access = False
			message = _("You have already purchased the certificate for this course.")

	address = frappe.db.get_value(
		"Address",
		{"email_id": frappe.session.user},
		[
			"name",
			"address_title as billing_name",
			"address_line1",
			"address_line2",
			"city",
			"state",
			"country",
			"pincode",
			"phone",
		],
		as_dict=1,
	)

	return {"access": access, "message": message, "address": address}


@frappe.whitelist(allow_guest=True)
def get_job_details(job):
	return frappe.db.get_value(
		"Job Opportunity",
		job,
		[
			"job_title",
			"location",
			"country",
			"type",
			"work_mode",
			"company_name",
			"company_logo",
			"company_website",
			"name",
			"creation",
			"description",
			"owner",
		],
		as_dict=1,
	)


@frappe.whitelist(allow_guest=True)
def get_job_opportunities(filters=None, orFilters=None):
	if not filters:
		filters = {}

	jobs = frappe.get_all(
		"Job Opportunity",
		filters=filters,
		or_filters=orFilters,
		fields=[
			"job_title",
			"location",
			"country",
			"type",
			"work_mode",
			"company_name",
			"company_logo",
			"name",
			"creation",
			"description",
		],
		order_by="creation desc",
	)

	for job in jobs:
		job.description = frappe.utils.strip_html_tags(job.description)
		job.applicants = frappe.db.count("LMS Job Application", {"job": job.name})
	return jobs


@frappe.whitelist(allow_guest=True)
def get_chart_details():
	details = frappe._dict()
	details.enrollments = frappe.db.count("LMS Enrollment")
	details.courses = frappe.db.count(
		"LMS Course",
		{
			"published": 1,
			"upcoming": 0,
		},
	)
	details.users = frappe.db.count("User", {"enabled": 1, "name": ["not in", ("Administrator", "Guest")]})
	details.completions = frappe.db.count("LMS Enrollment", {"progress": ["like", "%100%"]})
	details.certifications = frappe.db.count("LMS Certificate", {"published": 1})
	return details


@frappe.whitelist()
def get_file_info(file_url):
	"""Get file info for the given file URL."""
	file_info = frappe.db.get_value(
		"File", {"file_url": file_url}, ["file_name", "file_size", "file_url"], as_dict=1
	)
	return file_info


@frappe.whitelist(allow_guest=True)
def get_branding():
	"""Get branding details."""
	website_settings = frappe.get_single("Website Settings")
	image_fields = ["banner_image", "footer_logo", "favicon"]

	for field in image_fields:
		if website_settings.get(field):
			file_info = get_file_info(website_settings.get(field))
			website_settings.update({field: json.loads(json.dumps(file_info))})
		else:
			website_settings.update({field: None})

	return website_settings


@frappe.whitelist()
def get_unsplash_photos(keyword=None):
	from lms.unsplash import get_by_keyword, get_list

	if keyword:
		return get_by_keyword(keyword)

	return frappe.cache().get_value("unsplash_photos", generator=get_list)


@frappe.whitelist()
def get_evaluator_details(evaluator):
	frappe.only_for("Batch Evaluator")

	if not frappe.db.exists("Google Calendar", {"user": evaluator}):
		calendar = frappe.new_doc("Google Calendar")
		calendar.update({"user": evaluator, "calendar_name": evaluator})
		calendar.insert()
	else:
		calendar = frappe.db.get_value(
			"Google Calendar", {"user": evaluator}, ["name", "authorization_code"], as_dict=1
		)

	if frappe.db.exists("Course Evaluator", {"evaluator": evaluator}):
		doc = frappe.get_doc("Course Evaluator", evaluator)
	else:
		doc = frappe.new_doc("Course Evaluator")
		doc.evaluator = evaluator
		doc.insert()

	return {
		"slots": doc.as_dict(),
		"calendar": calendar.name,
		"is_authorised": calendar.authorization_code,
	}


@frappe.whitelist(allow_guest=True)
def get_certified_participants(filters=None, start=0, page_length=100):
	or_filters = {}
	if not filters:
		filters = {}

	filters.update({"published": 1})

	category = filters.get("category")
	if category:
		del filters["category"]
		or_filters["course_title"] = ["like", f"%{category}%"]
		or_filters["batch_title"] = ["like", f"%{category}%"]

	participants = frappe.db.get_all(
		"LMS Certificate",
		filters=filters,
		or_filters=or_filters,
		fields=["member", "issue_date"],
		group_by="member",
		order_by="issue_date desc",
		start=start,
		page_length=page_length,
	)

	for participant in participants:
		count = frappe.db.count("LMS Certificate", {"member": participant.member})
		details = frappe.db.get_value(
			"User",
			participant.member,
			["full_name", "user_image", "username", "country", "headline"],
			as_dict=1,
		)
		details["certificate_count"] = count
		participant.update(details)

	return participants


@frappe.whitelist(allow_guest=True)
def get_count_of_certified_members(filters=None):
	Certificate = DocType("LMS Certificate")

	query = (
		frappe.qb.from_(Certificate).select(Certificate.member).distinct().where(Certificate.published == 1)
	)

	if filters:
		for field, value in filters.items():
			if field == "category":
				query = query.where(
					Certificate.course_title.like(f"%{value}%") | Certificate.batch_title.like(f"%{value}%")
				)
			elif field == "member_name":
				query = query.where(Certificate.member_name.like(value[1]))

	result = query.run(as_dict=True)
	return len(result) or 0


@frappe.whitelist(allow_guest=True)
def get_certification_categories():
	categories = []
	docs = frappe.get_all(
		"LMS Certificate",
		filters={
			"published": 1,
		},
		fields=["course_title", "batch_title"],
	)

	for doc in docs:
		category = doc.course_title if doc.course_title else doc.batch_title
		if category not in categories:
			categories.append(category)

	return categories


@frappe.whitelist()
def get_assigned_badges(member):
	assigned_badges = frappe.get_all(
		"LMS Badge Assignment",
		{"member": member},
		["badge"],
		as_dict=1,
	)

	for badge in assigned_badges:
		badge.update(frappe.db.get_value("LMS Badge", badge.badge, ["name", "title", "image"]))
	return assigned_badges


@frappe.whitelist()
def get_all_users():
	frappe.only_for(["Moderator", "Course Creator", "Batch Evaluator"])
	users = frappe.get_all(
		"User",
		{
			"enabled": 1,
		},
		["name", "full_name", "user_image"],
	)

	return {user.name: user for user in users}


@frappe.whitelist()
def mark_as_read(name):
	doc = frappe.get_doc("Notification Log", name)
	doc.read = 1
	doc.save(ignore_permissions=True)


@frappe.whitelist()
def mark_all_as_read():
	notifications = frappe.get_all(
		"Notification Log", {"for_user": frappe.session.user, "read": 0}, pluck="name"
	)

	for notification in notifications:
		mark_as_read(notification)


@frappe.whitelist(allow_guest=True)
def get_sidebar_settings():
	lms_settings = frappe.get_single("LMS Settings")
	sidebar_items = frappe._dict()

	items = [
		"courses",
		"batches",
		"certifications",
		"jobs",
		"statistics",
		"notifications",
		"programming_exercises",
	]
	for item in items:
		sidebar_items[item] = lms_settings.get(item)

	if len(lms_settings.sidebar_items):
		web_pages = frappe.get_all(
			"LMS Sidebar Item",
			{"parenttype": "LMS Settings", "parentfield": "sidebar_items"},
			["web_page", "route", "title as label", "icon", "name"],
		)
		for page in web_pages:
			page.to = page.route

		sidebar_items.web_pages = web_pages

	return sidebar_items


@frappe.whitelist()
def update_sidebar_item(webpage, icon):
	filters = {
		"web_page": webpage,
		"parenttype": "LMS Settings",
		"parentfield": "sidebar_items",
		"parent": "LMS Settings",
	}

	if frappe.db.exists("LMS Sidebar Item", filters):
		frappe.db.set_value("LMS Sidebar Item", filters, "icon", icon)
	else:
		doc = frappe.new_doc("LMS Sidebar Item")
		doc.update(filters)
		doc.icon = icon
		doc.insert()


@frappe.whitelist()
def delete_sidebar_item(webpage):
	return frappe.db.delete(
		"LMS Sidebar Item",
		{
			"web_page": webpage,
			"parenttype": "LMS Settings",
			"parentfield": "sidebar_items",
			"parent": "LMS Settings",
		},
	)


@frappe.whitelist()
def delete_lesson(lesson, chapter):
	# Delete Reference
	chapter = frappe.get_doc("Course Chapter", chapter)
	chapter.lessons = [row for row in chapter.lessons if row.lesson != lesson]
	chapter.save()

	# Delete progress
	frappe.db.delete("LMS Course Progress", {"lesson": lesson})

	# Delete Lesson
	frappe.db.delete("Course Lesson", lesson)


@frappe.whitelist()
def update_lesson_index(lesson, sourceChapter, targetChapter, idx):
	hasMoved = sourceChapter == targetChapter

	update_source_chapter(lesson, sourceChapter, idx, hasMoved)
	if not hasMoved:
		update_target_chapter(lesson, targetChapter, idx)


def update_source_chapter(lesson, chapter, idx, hasMoved=False):
	lessons = frappe.get_all(
		"Lesson Reference",
		{
			"parent": chapter,
		},
		pluck="lesson",
		order_by="idx",
	)

	lessons.remove(lesson)
	if not hasMoved:
		frappe.db.delete("Lesson Reference", {"parent": chapter, "lesson": lesson})
	else:
		lessons.insert(idx, lesson)

	update_index(lessons, chapter)


def update_target_chapter(lesson, chapter, idx):
	lessons = frappe.get_all(
		"Lesson Reference",
		{
			"parent": chapter,
		},
		pluck="lesson",
		order_by="idx",
	)

	lessons.insert(idx, lesson)
	new_lesson_reference = frappe.new_doc("Lesson Reference")
	new_lesson_reference.update(
		{
			"lesson": lesson,
			"parent": chapter,
			"parenttype": "Course Chapter",
			"parentfield": "lessons",
		}
	)
	new_lesson_reference.insert()
	update_index(lessons, chapter)


def update_index(lessons, chapter):
	for row in lessons:
		frappe.db.set_value(
			"Lesson Reference", {"lesson": row, "parent": chapter}, "idx", lessons.index(row) + 1
		)


@frappe.whitelist()
def update_chapter_index(chapter, course, idx):
	"""Update the index of a chapter within a course"""
	chapters = frappe.get_all(
		"Chapter Reference",
		{"parent": course},
		pluck="chapter",
		order_by="idx",
	)

	if chapter in chapters:
		chapters.remove(chapter)

	chapters.insert(idx, chapter)

	for i, chapter_name in enumerate(chapters):
		frappe.db.set_value("Chapter Reference", {"chapter": chapter_name, "parent": course}, "idx", i + 1)


@frappe.whitelist(allow_guest=True)
def get_categories(doctype, filters):
	categoryOptions = []

	categories = frappe.get_all(
		doctype,
		filters,
		pluck="category",
	)
	categories = list(set(categories))

	for category in categories:
		if category:
			categoryOptions.append({"label": category, "value": category})

	return categoryOptions


@frappe.whitelist()
def get_members(start=0, search=""):
	filters = {"enabled": 1, "name": ["not in", ["Administrator", "Guest"]]}
	or_filters = {}

	if search:
		or_filters["full_name"] = ["like", f"%{search}%"]
		or_filters["email"] = ["like", f"%{search}%"]

	members = frappe.get_all(
		"User",
		filters=filters,
		fields=["name", "full_name", "user_image", "username", "last_active"],
		or_filters=or_filters,
		page_length=20,
		start=start,
	)

	for member in members:
		roles = frappe.get_all(
			"Has Role",
			{
				"parent": member.name,
				"parenttype": "User",
			},
			pluck="role",
		)
		if "Moderator" in roles:
			member.role = "Moderator"
		elif "Course Creator" in roles:
			member.role = "Course Creator"
		elif "Batch Evaluator" in roles:
			member.role = "Batch Evaluator"
		elif "LMS Student" in roles:
			member.role = "LMS Student"

	return members


def check_app_permission():
	"""Check if the user has permission to access the app."""
	if frappe.session.user == "Administrator":
		return True

	roles = frappe.get_roles()
	lms_roles = ["Moderator", "Course Creator", "Batch Evaluator", "LMS Student"]
	if any(role in roles for role in lms_roles):
		return True

	return False


@frappe.whitelist()
def save_evaluation_details(
	member,
	course,
	batch_name,
	evaluator,
	date,
	start_time,
	end_time,
	status,
	rating,
	summary,
):
	"""
	Save evaluation details for a member against a course.
	"""
	evaluation = frappe.db.exists("LMS Certificate Evaluation", {"member": member, "course": course})

	details = {
		"date": date,
		"start_time": start_time,
		"end_time": end_time,
		"status": status,
		"rating": rating / 5,
		"summary": summary,
		"batch_name": batch_name,
	}

	if evaluation:
		frappe.db.set_value("LMS Certificate Evaluation", evaluation, details)
		return evaluation
	else:
		doc = frappe.new_doc("LMS Certificate Evaluation")
		details.update(
			{
				"member": member,
				"course": course,
				"evaluator": evaluator,
			}
		)
		doc.update(details)
		doc.insert()
		return doc.name


@frappe.whitelist()
def save_certificate_details(
	member,
	course,
	batch_name,
	evaluator,
	issue_date,
	expiry_date,
	template,
	published=True,
):
	"""
	Save certificate details for a member against a course.
	"""
	certificate = frappe.db.exists("LMS Certificate", {"member": member, "course": course})

	details = {
		"published": published,
		"issue_date": issue_date,
		"expiry_date": expiry_date,
		"template": template,
		"batch_name": batch_name,
	}

	if certificate:
		frappe.db.set_value("LMS Certificate", certificate, details)
		return certificate
	else:
		doc = frappe.new_doc("LMS Certificate")
		details.update(
			{
				"member": member,
				"course": course,
				"evaluator": evaluator,
			}
		)
		doc.update(details)
		doc.insert()
		return doc.name


@frappe.whitelist()
def delete_documents(doctype, documents):
	frappe.only_for("Moderator")
	for doc in documents:
		frappe.delete_doc(doctype, doc)


@frappe.whitelist(allow_guest=True)
def get_count(doctype, filters):
	return frappe.db.count(
		doctype,
		filters=filters,
	)


@frappe.whitelist()
def get_payment_gateway_details(payment_gateway):
	gateway = frappe.get_doc("Payment Gateway", payment_gateway)

	if gateway.gateway_controller is None:
		try:
			data = frappe.get_doc(f"{payment_gateway} Settings").as_dict()
			meta = frappe.get_meta(f"{payment_gateway} Settings").fields
			doctype = f"{payment_gateway} Settings"
			docname = f"{payment_gateway} Settings"
		except Exception:
			frappe.throw(_("{0} Settings not found").format(payment_gateway))
	else:
		try:
			data = frappe.get_doc(gateway.gateway_settings, gateway.gateway_controller).as_dict()
			meta = frappe.get_meta(gateway.gateway_settings).fields
			doctype = gateway.gateway_settings
			docname = gateway.gateway_controller
		except Exception:
			frappe.throw(_("{0} Settings not found").format(payment_gateway))

	gateway_fields = get_transformed_fields(meta, data)

	return {
		"fields": gateway_fields,
		"data": data,
		"doctype": doctype,
		"docname": docname,
	}


def get_transformed_fields(meta, data=None):
	transformed_fields = []
	for row in meta:
		if row.fieldtype not in ["Column Break", "Section Break"]:
			if row.fieldtype in ["Attach", "Attach Image"]:
				fieldtype = "Upload"
				if data and data.get(row.fieldname):
					data[row.fieldname] = get_file_info(data.get(row.fieldname))
			elif row.fieldtype == "Check":
				fieldtype = "checkbox"
			else:
				fieldtype = row.fieldtype

			transformed_fields.append(
				{
					"label": row.label,
					"name": row.fieldname,
					"type": fieldtype,
				}
			)

	return transformed_fields


@frappe.whitelist()
def get_new_gateway_fields(doctype):
	try:
		meta = frappe.get_meta(doctype).fields
	except Exception:
		frappe.throw(_("{0} not found").format(doctype))

	transformed_fields = get_transformed_fields(meta)

	return transformed_fields


def update_course_statistics():
	courses = frappe.get_all("LMS Course", fields=["name"])

	for course in courses:
		lessons = get_lesson_count(course.name)

		enrollments = frappe.db.count("LMS Enrollment", {"course": course.name, "member_type": "Student"})

		avg_rating = get_average_rating(course.name) or 0
		avg_rating = flt(avg_rating, frappe.get_system_settings("float_precision") or 3)

		frappe.db.set_value(
			"LMS Course",
			course.name,
			{"lessons": lessons, "enrollments": enrollments, "rating": avg_rating},
		)


@frappe.whitelist()
def get_announcements(batch):
	communications = frappe.get_all(
		"Communication",
		filters={
			"reference_doctype": "LMS Batch",
			"reference_name": batch,
		},
		fields=[
			"subject",
			"content",
			"recipients",
			"cc",
			"communication_date",
			"sender",
			"sender_full_name",
		],
		order_by="communication_date desc",
	)

	for communication in communications:
		communication.image = frappe.get_cached_value("User", communication.sender, "user_image")

	return communications


@frappe.whitelist()
def delete_course(course):
	chapters = frappe.get_all("Course Chapter", {"course": course}, pluck="name")

	chapter_references = frappe.get_all("Chapter Reference", {"parent": course}, pluck="name")

	for chapter in chapters:
		lessons = frappe.get_all("Course Lesson", {"chapter": chapter}, pluck="name")

		lesson_references = frappe.get_all("Lesson Reference", {"parent": chapter}, pluck="name")

		for lesson in lesson_references:
			frappe.delete_doc("Lesson Reference", lesson)

		for lesson in lessons:
			topics = frappe.get_all(
				"Discussion Topic",
				{"reference_doctype": "Course Lesson", "reference_docname": lesson},
				pluck="name",
			)

			for topic in topics:
				frappe.db.delete("Discussion Reply", {"topic": topic})

				frappe.db.delete("Discussion Topic", topic)

			frappe.delete_doc("Course Lesson", lesson)

	for chapter in chapter_references:
		frappe.delete_doc("Chapter Reference", chapter)

	for chapter in chapters:
		frappe.delete_doc("Course Chapter", chapter)

	frappe.db.delete("LMS Course Progress", {"course": course})
	frappe.db.delete("LMS Quiz", {"course": course})
	frappe.db.delete("LMS Quiz Submission", {"course": course})
	frappe.db.delete("LMS Enrollment", {"course": course})
	frappe.delete_doc("LMS Course", course)


@frappe.whitelist()
def delete_batch(batch):
	frappe.db.delete("LMS Batch Enrollment", {"batch": batch})
	frappe.db.delete("Batch Course", {"parent": batch, "parenttype": "LMS Batch"})
	frappe.db.delete("LMS Assessment", {"parent": batch, "parenttype": "LMS Batch"})
	frappe.db.delete("LMS Batch Timetable", {"parent": batch, "parenttype": "LMS Batch"})
	frappe.db.delete("LMS Batch Feedback", {"batch": batch})
	delete_batch_discussions(batch)
	frappe.db.delete("LMS Batch", batch)


def delete_batch_discussions(batch):
	topics = frappe.get_all(
		"Discussion Topic",
		{"reference_doctype": "LMS Batch", "reference_docname": batch},
		pluck="name",
	)

	for topic in topics:
		frappe.db.delete("Discussion Reply", {"topic": topic})
		frappe.db.delete("Discussion Topic", topic)


def give_discussions_permission():
	doctypes = ["Discussion Topic", "Discussion Reply"]
	roles = ["LMS Student", "Course Creator", "Moderator", "Batch Evaluator"]
	for doctype in doctypes:
		for role in roles:
			if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role}):
				frappe.get_doc(
					{
						"doctype": "Custom DocPerm",
						"parent": doctype,
						"role": role,
						"read": 1,
						"write": 1,
						"create": 1,
						"delete": 1,
						"if_owner": 0 if role == "Moderator" else 1,
					}
				).save(ignore_permissions=True)


@frappe.whitelist()
def upsert_chapter(title, course, is_scorm_package, scorm_package, name=None):
	values = frappe._dict({"title": title, "course": course, "is_scorm_package": is_scorm_package})

	if is_scorm_package:
		scorm_package = frappe._dict(scorm_package)
		extract_path = extract_package(course, title, scorm_package)

		values.update(
			{
				"scorm_package": scorm_package.name,
				"scorm_package_path": extract_path.split("public")[1],
				"manifest_file": get_manifest_file(extract_path).split("public")[1],
				"launch_file": get_launch_file(extract_path).split("public")[1],
			}
		)

	if name:
		chapter = frappe.get_doc("Course Chapter", name)
	else:
		chapter = frappe.new_doc("Course Chapter")

	chapter.update(values)
	chapter.save()

	if is_scorm_package and not len(chapter.lessons):
		add_lesson(title, chapter.name, course, 1)

	return chapter


def extract_package(course, title, scorm_package):
	package = frappe.get_doc("File", scorm_package.name)
	zip_path = package.get_full_path()
	# check_for_malicious_code(zip_path)
	extract_path = frappe.get_site_path("public", "scorm", course, title)
	zipfile.ZipFile(zip_path).extractall(extract_path)
	return extract_path


def check_for_malicious_code(zip_path):
	suspicious_patterns = [
		# Unsafe inline JavaScript
		r'on(click|load|mouseover|error|submit|focus|blur|change|keyup|keydown|keypress|resize)=".*?"',  # Inline event handlers (e.g., onerror, onclick)
		r'<script.*?src=["\']http',  # External script tags
		r"eval\(",  # Usage of eval()
		r"Function\(",  # Usage of Function constructor
		r"(btoa|atob)\(",  # Base64 encoding/decoding
		# Dangerous XML patterns
		r"<!ENTITY",  # XXE-related
		r"<\?xml-stylesheet .*?>",  # External stylesheets in XML
	]

	with zipfile.ZipFile(zip_path, "r") as zf:
		for file_name in zf.namelist():
			if file_name.endswith((".html", ".js", ".xml")):
				with zf.open(file_name) as file:
					content = file.read().decode("utf-8", errors="ignore")
					for pattern in suspicious_patterns:
						if re.search(pattern, content):
							frappe.throw(_("Suspicious pattern found in {0}: {1}").format(file_name, pattern))


def get_manifest_file(extract_path):
	manifest_file = None
	for root, _dirs, files in os.walk(extract_path):
		for file in files:
			if file == "imsmanifest.xml":
				manifest_file = os.path.join(root, file)
				break
		if manifest_file:
			break
	return manifest_file


def get_launch_file(extract_path):
	launch_file = None
	manifest_file = get_manifest_file(extract_path)

	if manifest_file:
		with open(manifest_file) as file:
			data = file.read()
			dom = parseString(data)
			resource = dom.getElementsByTagName("resource")
			for res in resource:
				if (
					res.getAttribute("adlcp:scormtype") == "sco"
					or res.getAttribute("adlcp:scormType") == "sco"
				):
					launch_file = res.getAttribute("href")
					break

		if launch_file:
			launch_file = os.path.join(os.path.dirname(manifest_file), launch_file)

	return launch_file


def add_lesson(title, chapter, course, idx):
	lesson = frappe.new_doc("Course Lesson")
	lesson.update(
		{
			"title": title,
			"chapter": chapter,
			"course": course,
		}
	)
	lesson.insert()

	lesson_reference = frappe.new_doc("Lesson Reference")
	lesson_reference.update(
		{
			"lesson": lesson.name,
			"idx": idx,
			"parent": chapter,
			"parenttype": "Course Chapter",
			"parentfield": "lessons",
		}
	)
	lesson_reference.insert()


@frappe.whitelist()
def delete_chapter(chapter):
	chapterInfo = frappe.db.get_value(
		"Course Chapter", chapter, ["is_scorm_package", "scorm_package_path"], as_dict=True
	)

	if chapterInfo.is_scorm_package:
		delete_scorm_package(chapterInfo.scorm_package_path)

	frappe.db.delete("Chapter Reference", {"chapter": chapter})
	frappe.db.delete("Lesson Reference", {"parent": chapter})
	frappe.db.delete("Course Lesson", {"chapter": chapter})
	frappe.db.delete("Course Chapter", chapter)


def delete_scorm_package(scorm_package_path):
	scorm_package_path = frappe.get_site_path("public", scorm_package_path[1:])
	if os.path.exists(scorm_package_path):
		shutil.rmtree(scorm_package_path)


@frappe.whitelist()
def mark_lesson_progress(course, chapter_number, lesson_number):
	chapter_name = frappe.get_value("Chapter Reference", {"parent": course, "idx": chapter_number}, "chapter")
	lesson_name = frappe.get_value(
		"Lesson Reference", {"parent": chapter_name, "idx": lesson_number}, "lesson"
	)
	save_progress(lesson_name, course)


@frappe.whitelist()
def get_heatmap_data(member=None, base_days=200):
	if not member:
		member = frappe.session.user

	base_date, start_date, number_of_days, days = calculate_date_ranges(base_days)
	date_count = initialize_date_count(days)

	lesson_completions, quiz_submissions, assignment_submissions = fetch_activity_data(member, start_date)
	count_dates(lesson_completions, date_count)
	count_dates(quiz_submissions, date_count)
	count_dates(assignment_submissions, date_count)

	heatmap_data, labels, total_activities, weeks = prepare_heatmap_data(
		start_date, number_of_days, date_count
	)

	return {
		"heatmap_data": heatmap_data,
		"labels": labels,
		"total_activities": total_activities,
		"weeks": weeks,
	}


def calculate_date_ranges(base_days):
	today = format_date(now(), "YYYY-MM-dd")
	day_today = get_datetime(today).strftime("%w")
	padding_end = 6 - cint(day_today)

	base_date = add_days(today, -base_days)
	day_of_base_date = cint(get_datetime(base_date).strftime("%w"))
	start_date = add_days(base_date, -day_of_base_date)
	number_of_days = base_days + day_of_base_date + padding_end
	days = [add_days(start_date, i) for i in range(number_of_days + 1)]

	return base_date, start_date, number_of_days, days


def initialize_date_count(days):
	return {format_date(day, "YYYY-MM-dd"): 0 for day in days}


def fetch_activity_data(member, start_date):
	lesson_completions = frappe.get_all(
		"LMS Course Progress",
		fields=["creation"],
		filters={"member": member, "creation": [">=", start_date], "status": "Complete"},
	)

	quiz_submissions = frappe.get_all(
		"LMS Quiz Submission",
		fields=["creation"],
		filters={"member": member, "creation": [">=", start_date]},
	)

	assignment_submissions = frappe.get_all(
		"LMS Assignment Submission",
		fields=["creation"],
		filters={"member": member, "creation": [">=", start_date]},
	)

	return lesson_completions, quiz_submissions, assignment_submissions


def count_dates(data, date_count):
	for entry in data:
		date = format_date(entry.creation, "YYYY-MM-dd")
		if date in date_count:
			date_count[date] += 1


def prepare_heatmap_data(start_date, number_of_days, date_count):
	days_of_week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
	heatmap_data = {day: [] for day in days_of_week}
	week_count = -(number_of_days // -7)
	labels = [None] * week_count
	last_seen_month = None
	sorted_dates = sorted(date_count.keys())

	for date in sorted_dates:
		activity_count = date_count[date]
		day_of_week = get_datetime(date).strftime("%a")
		current_month = get_datetime(date).strftime("%b")
		column_index = get_week_difference(start_date, date)

		if 0 <= column_index < week_count:
			heatmap_data[day_of_week].append(
				{
					"date": date,
					"count": activity_count,
					"label": f"{activity_count} activities on {format_date(date, 'dd MMM')}",
				}
			)

			if last_seen_month != current_month:
				labels[column_index] = current_month
				last_seen_month = current_month

	for index, label in enumerate(labels):
		if not label:
			labels[index] = ""

	formatted_heatmap_data = [{"name": day, "data": heatmap_data[day]} for day in days_of_week]

	total_activities = sum(date_count.values())
	return formatted_heatmap_data, labels, total_activities, week_count


def get_week_difference(start_date, current_date):
	diff_in_days = date_diff(current_date, start_date)
	return diff_in_days // 7


@frappe.whitelist()
def get_notifications(filters):
	notifications = frappe.get_all(
		"Notification Log",
		filters,
		["subject", "from_user", "link", "read", "name"],
		order_by="creation desc",
	)

	for notification in notifications:
		from_user_details = frappe.db.get_value(
			"User", notification.from_user, ["full_name", "user_image"], as_dict=1
		)
		notification.update(from_user_details)

	return notifications


@frappe.whitelist(allow_guest=True)
def get_lms_setting(field=None):
	if not field:
		frappe.throw(_("Field name is required"))
		frappe.log_error("Field name is missing when accessing LMS Settings {0} {1} {2}").format(
			frappe.local.request_ip, frappe.get_request_header("Referer"), frappe.get_request_header("Origin")
		)

	allowed_fields = [
		"allow_guest_access",
		"prevent_skipping_videos",
		"contact_us_email",
		"contact_us_url",
		"livecode_url",
		# AI Assistant fields
		"enable_lesson_assistant",
		"assistant_mode",
		"assistant_enable_streaming",
	]

	if field not in allowed_fields:
		frappe.throw(_("You are not allowed to access this field"))

	return frappe.get_cached_value("LMS Settings", None, field)


@frappe.whitelist()
def cancel_evaluation(evaluation):
	evaluation = frappe._dict(evaluation)

	if evaluation.member != frappe.session.user:
		return

	frappe.db.set_value("LMS Certificate Request", evaluation.name, "status", "Cancelled")
	events = frappe.get_all(
		"Event Participants",
		{
			"email": evaluation.member,
		},
		["parent", "name"],
	)

	for event in events:
		info = frappe.db.get_value("Event", event.parent, ["starts_on", "subject"], as_dict=1)
		date = str(info.starts_on).split(" ")[0]

		if date == str(evaluation.date.format("YYYY-MM-DD")) and evaluation.member_name in info.subject:
			communication = frappe.db.get_value(
				"Communication",
				{"reference_doctype": "Event", "reference_name": event.parent},
				"name",
			)
			if communication:
				frappe.delete_doc("Communication", communication, ignore_permissions=True)

			frappe.delete_doc("Event Participants", event.name, ignore_permissions=True)
			frappe.delete_doc("Event", event.parent, ignore_permissions=True)


@frappe.whitelist()
def get_certification_details(course):
	membership = None
	filters = {"course": course, "member": frappe.session.user}

	if frappe.db.exists("LMS Enrollment", filters):
		membership = frappe.db.get_value(
			"LMS Enrollment",
			filters,
			["name", "purchased_certificate"],
			as_dict=1,
		)

	paid_certificate = frappe.db.get_value("LMS Course", course, "paid_certificate")
	certificate = frappe.db.get_value(
		"LMS Certificate",
		{"member": frappe.session.user, "course": course},
		["name", "template"],
		as_dict=1,
	)

	return {
		"membership": membership,
		"paid_certificate": paid_certificate,
		"certificate": certificate,
	}


@frappe.whitelist()
def save_role(user, role, value):
	frappe.only_for("Moderator")
	if cint(value):
		doc = frappe.get_doc(
			{
				"doctype": "Has Role",
				"parent": user,
				"role": role,
				"parenttype": "User",
				"parentfield": "roles",
			}
		)
		doc.save(ignore_permissions=True)
	else:
		frappe.db.delete("Has Role", {"parent": user, "role": role})
	frappe.clear_cache(user=user)
	return True


@frappe.whitelist()
def add_an_evaluator(email):
	frappe.only_for("Moderator")
	if not frappe.db.exists("User", email):
		user = frappe.new_doc("User")
		user.update(
			{
				"email": email,
				"first_name": email.split("@")[0].capitalize(),
				"enabled": 1,
			}
		)
		user.insert()
		user.add_roles("Batch Evaluator")

	evaluator = frappe.new_doc("Course Evaluator")
	evaluator.evaluator = email
	evaluator.insert()

	return evaluator


@frappe.whitelist()
def delete_evaluator(evaluator):
	frappe.only_for("Moderator")
	if not frappe.db.exists("Course Evaluator", evaluator):
		frappe.throw(_("Evaluator does not exist."))

	frappe.db.delete("Has Role", {"parent": evaluator, "role": "Batch Evaluator"})
	frappe.db.delete("Course Evaluator", evaluator)


@frappe.whitelist()
def capture_user_persona(responses):
	frappe.only_for("System Manager")
	data = frappe.parse_json(responses)
	data = json.dumps(data)
	response = frappe.integrations.utils.make_post_request(
		"https://school.frappe.io/api/method/capture-persona",
		data={"response": data},
	)
	if response.get("message").get("name"):
		frappe.db.set_single_value("LMS Settings", "persona_captured", True)
	return response


@frappe.whitelist()
def get_meta_info(type, route):
	if frappe.db.exists("Website Meta Tag", {"parent": f"{type}/{route}"}):
		meta_tags = frappe.get_all(
			"Website Meta Tag",
			{
				"parent": f"{type}/{route}",
			},
			["name", "key", "value"],
		)

		return meta_tags

	return []


@frappe.whitelist()
def update_meta_info(meta_type, route, meta_tags):
	validate_meta_data_permissions()
	validate_meta_tags(meta_tags)

	parent_name = f"{meta_type}/{route}"
	for tag in meta_tags:
		existing_tag = frappe.db.exists(
			"Website Meta Tag",
			{
				"parent": parent_name,
				"parenttype": "Website Route Meta",
				"parentfield": "meta_tags",
				"key": tag["key"],
			},
		)
		if existing_tag:
			if not tag.get("value"):
				frappe.db.delete("Website Meta Tag", existing_tag)
				continue
			frappe.db.set_value("Website Meta Tag", existing_tag, "value", tag["value"])
		elif tag.get("value"):
			tag_properties = {
				"parent": parent_name,
				"parenttype": "Website Route Meta",
				"parentfield": "meta_tags",
				"key": tag["key"],
				"value": tag["value"],
			}

			parent_exists = frappe.db.exists("Website Route Meta", parent_name)
			if not parent_exists:
				create_meta(parent_name, tag_properties)
			else:
				create_meta_tag(tag_properties)


def validate_meta_tags(meta_tags):
	if not isinstance(meta_tags, list):
		frappe.throw(_("Meta tags should be a list."))


def create_meta(parent_name, tag_properties):
	route_meta = frappe.new_doc("Website Route Meta")
	route_meta.update(
		{
			"__newname": parent_name,
		}
	)
	route_meta.append("meta_tags", tag_properties)
	route_meta.insert()


def create_meta_tag(tag_properties):
	new_tag = frappe.new_doc("Website Meta Tag")
	new_tag.update(tag_properties)
	new_tag.insert()


def validate_meta_data_permissions(meta_type):
	roles = frappe.get_roles()

	if meta_type == "courses":
		if not ("Course Creator" in roles or "Moderator" in roles):
			frappe.throw(_("You do not have permission to update meta tags."))

	elif meta_type == "batches":
		if not ("Batch Evaluator" in roles or "Moderator" in roles):
			frappe.throw(_("You do not have permission to update meta tags."))


@frappe.whitelist()
def create_programming_exercise_submission(exercise, submission, code, test_cases):
	if submission == "new":
		return make_new_exercise_submission(exercise, code, test_cases)
	else:
		update_exercise_submission(submission, code, test_cases)


def make_new_exercise_submission(exercise, code, test_cases):
	submission = frappe.new_doc("LMS Programming Exercise Submission")
	submission.exercise = exercise
	submission.member = frappe.session.user
	submission.code = code

	for test_case in test_cases:
		submission.append(
			"test_cases",
			{
				"input": test_case.get("input"),
				"output": test_case.get("output"),
				"expected_output": test_case.get("expected_output"),
				"status": test_case.get("status", test_case.get("status", "Failed")),
			},
		)

	submission.status = get_exercise_status(test_cases)
	submission.insert()
	return submission.name


def update_exercise_submission(submission, code, test_cases):
	update_test_cases(test_cases, submission)
	status = get_exercise_status(test_cases)
	frappe.db.set_value("LMS Programming Exercise Submission", submission, {"status": status, "code": code})


def get_exercise_status(test_cases):
	if not test_cases:
		return "Failed"

	if all(row.get("status", "Failed") == "Passed" for row in test_cases):
		return "Passed"
	else:
		return "Failed"


def update_test_cases(test_cases, submission):
	frappe.db.delete("LMS Test Case Submission", {"parent": submission})
	for row in test_cases:
		test_case = frappe.new_doc("LMS Test Case Submission")
		test_case.update(
			{
				"parent": submission,
				"parenttype": "LMS Programming Exercise Submission",
				"parentfield": "test_cases",
				"input": row.get("input"),
				"output": row.get("output"),
				"expected_output": row.get("expected_output"),
				"status": row.get("status", "Failed"),
			}
		)
		test_case.insert()


@frappe.whitelist()
def track_video_watch_duration(lesson, videos):
	"""
	Track the watch duration of videos in a lesson.
	"""
	if not isinstance(videos, list):
		videos = json.loads(videos)

	for video in videos:
		filters = {
			"lesson": lesson,
			"source": video.get("source"),
			"member": frappe.session.user,
		}
		existing_record = frappe.db.get_value(
			"LMS Video Watch Duration", filters, ["name", "watch_time"], as_dict=True
		)
		if existing_record and flt(existing_record.watch_time) < flt(video.get("watch_time")):
			frappe.db.set_value(
				"LMS Video Watch Duration",
				filters,
				"watch_time",
				video.get("watch_time"),
			)
		elif not existing_record:
			track_new_watch_time(lesson, video)


def track_new_watch_time(lesson, video):
	doc = frappe.new_doc("LMS Video Watch Duration")
	doc.lesson = lesson
	doc.source = video.get("source")
	doc.watch_time = video.get("watch_time")
	doc.member = frappe.session.user
	doc.save()


@frappe.whitelist()
def get_course_progress_distribution(course):
	all_progress = frappe.get_all(
		"LMS Enrollment",
		{
			"course": course,
		},
		pluck="progress",
	)

	average_progress = get_average_course_progress(all_progress)
	progress_distribution = get_progress_distribution(all_progress)

	return {
		"average_progress": average_progress,
		"progress_distribution": progress_distribution,
	}


def get_average_course_progress(progress_list):
	if not progress_list:
		return 0
	average_progress = sum(progress_list) / len(progress_list)
	return flt(average_progress, frappe.get_system_settings("float_precision") or 3)


def get_progress_distribution(progressList):
	distribution = [
		{
			"category": "0-20%",
			"count": len([p for p in progressList if 0 <= p < 20]),
		},
		{
			"category": "20-40%",
			"count": len([p for p in progressList if 20 <= p < 40]),
		},
		{
			"category": "40-60%",
			"count": len([p for p in progressList if 40 <= p < 60]),
		},
		{
			"category": "60-80%",
			"count": len([p for p in progressList if 60 <= p < 80]),
		},
		{
			"category": "80-100%",
			"count": len([p for p in progressList if 80 <= p <= 100]),
		},
	]

	return distribution


@frappe.whitelist(allow_guest=True)
def get_pwa_manifest():
	title = frappe.db.get_single_value("Website Settings", "app_name") or "Frappe Learning"
	banner_image = frappe.db.get_single_value("Website Settings", "banner_image")

	manifest = {
		"name": title,
		"short_name": title,
		"description": "Easy to use, 100% open source Learning Management System",
		"start_url": "/lms",
		"icons": [
			{
				"src": banner_image or "/assets/lms/frontend/manifest/manifest-icon-192.maskable.png",
				"sizes": "192x192",
				"type": "image/png",
				"purpose": "maskable any",
			}
		],
	}

	return Response(json.dumps(manifest), status=200, content_type="application/manifest+json")


@frappe.whitelist()
def get_profile_details(username):
	details = frappe.db.get_value(
		"User",
		{"username": username},
		[
			"first_name",
			"last_name",
			"full_name",
			"name",
			"username",
			"user_image",
			"bio",
			"headline",
			"language",
			"cover_image",
		],
		as_dict=True,
	)

	details.roles = frappe.get_roles(details.name)
	return details

# =============================================
# AI ASSISTANT API FUNCTIONS
# =============================================

@frappe.whitelist()
def chatbot_reply(course, chapter, lesson, messages=None, session=None):
    """
    Lightweight lesson-aware chatbot reply (MVP).

    Avoids external network calls and returns a deterministic,
    context-aware helper message using lesson metadata. Replace this logic
    with a call to an OpenAI-compatible proxy in a later phase.

    Args:
        course (str): Course name (slug/id)
        chapter (Union[str,int]): Chapter index (1-based)
        lesson (Union[str,int]): Lesson index (1-based)
        messages (list|str): Chat history [{role, content}], JSON str accepted

    Returns:
        dict: {"message": {"role": "assistant", "content": str}}
    """
    try:
        ch = int(chapter) if chapter is not None else 1
        ls = int(lesson) if lesson is not None else 1

        # Parse messages if provided as a JSON string
        if isinstance(messages, str):
            try:
                messages = json.loads(messages)
            except Exception:
                messages = []
        messages = messages or []

        # Fetch minimal lesson context
        lesson_ctx = get_lesson(course, ch, ls) or {}
        title = lesson_ctx.get("title") or "this lesson"
        chapter_title = lesson_ctx.get("chapter_title") or "this chapter"
        course_title = lesson_ctx.get("course_title") or course

        user_utterance = ""
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "user":
                user_utterance = (m.get("content") or "").strip()
                break

        # Try proxy integration if enabled; fallback to heuristic
        settings = frappe.get_single("LMS Settings")
        # Fetch per-course overrides if present
        course_cfg = frappe.db.get_value(
            "AI Assistant Config",
            {"course": lesson_ctx.get("course") or course},
            [
                "enable_overrides",
                "mode",
                "system_prompt",
                "default_model",
                "enable_rag",
                "proxy_base_url",
                "proxy_api_key",
            ],
            as_dict=True,
        )
        eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
        mode = eff.get("mode") or "Demo Mode"
        system_prompt = eff.get("system_prompt") or ""
        model = eff.get("default_model")
        proxy_base = eff.get("chat_base_url") or ""
        proxy_key = eff.get("chat_api_key") or ""
        proxy_custom_headers = eff.get("chat_custom_headers") or ""

        # Guardrails (chat path): optionally block injection/sensitive prompts
        try:
            enable_filter = bool(settings.get("assistant_guardrail_filter_content"))
            enable_inj = bool(settings.get("assistant_guardrail_injection_checks"))
            from lms.lms.ai_utils import simple_guardrail_flags
            flags = simple_guardrail_flags(user_utterance)
            if (enable_filter and flags.get("sensitive")) or (enable_inj and flags.get("injection")):
                # Log guardrail event (chat)
                try:
                    frappe.get_doc({
                        "doctype": "AI Guardrail Event",
                        "time": now(),
                        "user": frappe.session.user,
                        "course": lesson_ctx.get("course") or course,
                        "lesson": lesson_ctx.get("name"),
                        "source": "chat",
                        "event_type": "Sensitive" if flags.get("sensitive") else "Injection",
                        "snippet": (user_utterance or "")[:240],
                        "notes": "Blocked chat prompt by guardrails",
                    }).insert(ignore_permissions=True)
                except Exception:
                    pass
                limit_msg = "I can’t process that request. Please rephrase without sensitive information or instruction overrides."
                return {"message": {"role": "assistant", "content": limit_msg}, "session": session}
        except Exception:
            pass

        cost_per_message = float(eff.get("cost_per_message") or 0)
        cost_cap = float(eff.get("cost_cap_per_user_per_day") or 0)
        cost_per_message = float(eff.get("cost_per_message") or 0)
        cost_cap = float(eff.get("cost_cap_per_user_per_day") or 0)

        # Resolve prompt preset if no explicit system prompt
        if not system_prompt:
            preset_name = eff.get("prompt_preset") or eff.get("default_preset")
            if preset_name:
                preset_prompt = frappe.db.get_value("AI Prompt Preset", preset_name, "prompt")
                system_prompt = preset_prompt or ""
        # Augment system prompt with lesson context
        ctx = f"Course: {course_title} | Chapter: {chapter_title} | Lesson: {title}. Keep answers concise and cite key lesson terms when helpful."
        effective_system_prompt = (system_prompt + "\n\n" + ctx).strip()

        # Enforce simple daily message cap per user per course
        cap = int(eff.get("max_messages_per_user_per_day") or 0)
        if cap > 0:
            sessions = frappe.get_all(
                "AI Chat Session",
                filters={"user": frappe.session.user, "course": lesson_ctx.get("course") or course},
                pluck="name",
            )
            if sessions:
                count = frappe.db.count(
                    "AI Chat Message",
                    filters={
                        "session": ("in", sessions),
                        "role": "user",
                        "creation": (">=", add_days(now(), -1)),
                    },
                )
                if count >= cap:
                    limit_msg = "You’ve reached the daily chat limit for this course. Please try again tomorrow."
                    return {"message": {"role": "assistant", "content": limit_msg}, "session": session}

        # Enforce simple daily cost cap per user per course
        if cost_cap > 0 and cost_per_message > 0:
            sessions = frappe.get_all(
                "AI Chat Session",
                filters={"user": frappe.session.user, "course": lesson_ctx.get("course") or course},
                pluck="name",
            )
            assistant_msgs = 0
            if sessions:
                assistant_msgs = frappe.db.count(
                    "AI Chat Message",
                    filters={
                        "session": ("in", sessions),
                        "role": "assistant",
                        "creation": (">=", add_days(now(), -1)),
                    },
                )
            current_spend = assistant_msgs * cost_per_message
            if current_spend + cost_per_message > cost_cap:
                limit_msg = "You’ve reached the daily cost limit for this course. Please try again tomorrow."
                return {"message": {"role": "assistant", "content": limit_msg}, "session": session}

        # RAG retrieval (Phase 2)
        citations = []
        if eff.get("enable_rag") and user_utterance:
            # Ensure we have chunks; if none, build quickly for this lesson
            if not frappe.db.exists("AI Knowledge Chunk", {"course": course, "lesson": lesson_ctx.get("name")}):
                try:
                    chunks = chunk_lesson(lesson_ctx.get("name"))
                    # Include attachments if enabled in settings
                    try:
                        include_attachments = bool(
                            frappe.db.get_single_value("LMS Settings", "assistant_rag_include_attachments") or 0
                        )
                    except Exception:
                        include_attachments = False
                    if include_attachments:
                        try:
                            chunks.extend(chunk_lesson_attachments(lesson_ctx.get("name")))
                        except Exception:
                            frappe.log_error(frappe.get_traceback(), "rag_chunk_attachments_quick_error")
                    for idx, ch in enumerate(chunks):
                        frappe.get_doc(
                            {
                                "doctype": "AI Knowledge Chunk",
                                "course": course,
                                "lesson": lesson_ctx.get("name"),
                                "source_type": ch.get("source_type") or "Lesson",
                                "title": ch.get("title"),
                                "content": ch.get("content"),
                                "h_path": ch.get("h_path"),
                                "order": ch.get("order", idx),
                                "chunk_id": f"{lesson_ctx.get('name')}-{idx}",
                                "url": ch.get("url"),
                            }
                        ).insert(ignore_permissions=True)
                except Exception:
                    frappe.log_error(frappe.get_traceback(), "rag_index_build_error")
            # Retrieve top chunks
            try:
                top = simple_retrieve(course, lesson_ctx.get("name"), user_utterance, top_k=3)
                if top:
                    citations = top
            except Exception:
                frappe.log_error(frappe.get_traceback(), "rag_retrieve_error")

        reply = None
        # TEMPORARY DEBUG: Show what values we're getting
        print(f"DEBUG MODE: '{mode}' (lower: '{mode.lower()}')")
        print(f"DEBUG PROXY_BASE: '{proxy_base}' (len: {len(proxy_base) if proxy_base else 'None'})")
        print(f"DEBUG PROXY_KEY: '{proxy_key}' (len: {len(proxy_key) if proxy_key else 0})")
        print(f"DEBUG CONDITION CHECK: mode_match={mode.lower() in ['proxy', 'external ai service']}, has_base={bool(proxy_base)}")
        
        # Check if using external AI service (handle both old "proxy" and new "external ai service" terminology)
        if (mode.lower() in ["proxy", "external ai service"]) and proxy_base:
            # Build messages array with user messages only; keep roles
            history = []
            for m in messages:
                if isinstance(m, dict) and m.get("role") in ("user", "assistant"):
                    history.append({"role": m.get("role"), "content": m.get("content")})
            import time as _time
            # If citations present, prepend a system context block
            sys_prompt = effective_system_prompt
            if citations:
                src = "\n\nSources:\n" + "\n".join(
                    [f"[{i+1}] {c.get('title')} — lesson" for i, c in enumerate(citations)]
                )
                sys_prompt = (sys_prompt + src).strip()
            payload = build_openai_chat_payload(sys_prompt, history, model)
            _t0 = _time.time()
            result = call_ai_proxy(proxy_base, proxy_key, payload, custom_headers_json=proxy_custom_headers)
            latency_ms = int((_time.time() - _t0) * 1000)
            if result and result.get("content"):
                reply = result.get("content")
                try:
                    frappe.get_doc({
                        "doctype": "AI Proxy Log",
                        "user": frappe.session.user,
                        "course": lesson_ctx.get("course") or course,
                        "lesson": lesson_ctx.get("name"),
                        "model": model,
                        "status": "success",
                        "latency_ms": latency_ms,
                        "status_code": result.get("status_code"),
                    }).insert(ignore_permissions=True)
                except Exception:
                    frappe.log_error(frappe.get_traceback(), "ai_proxy_log_error")
            else:
                try:
                    frappe.get_doc({
                        "doctype": "AI Proxy Log",
                        "user": frappe.session.user,
                        "course": lesson_ctx.get("course") or course,
                        "lesson": lesson_ctx.get("name"),
                        "model": model,
                        "status": "error",
                        "latency_ms": latency_ms,
                        "status_code": result.get("status_code") if result else None,
                        "error_message": result.get("error") if result else "unknown",
                    }).insert(ignore_permissions=True)
                except Exception:
                    frappe.log_error(frappe.get_traceback(), "ai_proxy_log_error")

        if not reply:
            reply = draft_assistant_reply(user_utterance, title, chapter_title, course_title)
            if citations:
                reply = reply + "\n\nSources: " + ", ".join([f"[{i+1}]" for i in range(len(citations))])

        # Create a session if none provided; log messages best-effort
        session_name = session
        try:
            if not session_name:
                session_doc = frappe.get_doc(
                    {
                        "doctype": "AI Chat Session",
                        "user": frappe.session.user,
                        "course": lesson_ctx.get("course") or course,
                        "lesson": lesson_ctx.get("name"),
                        "chapter_index": ch,
                        "lesson_index": ls,
                    }
                ).insert(ignore_permissions=True)
                session_name = session_doc.name
        except Exception:
            frappe.log_error(frappe.get_traceback(), "chatbot_reply_session_create_error")

        try:
            if session_name and user_utterance:
                frappe.get_doc(
                    {
                        "doctype": "AI Chat Message",
                        "session": session_name,
                        "role": "user",
                        "content": user_utterance,
                    }
                ).insert(ignore_permissions=True)
            if session_name:
                frappe.get_doc(
                    {
                        "doctype": "AI Chat Message",
                        "session": session_name,
                        "role": "assistant",
                        "content": reply,
                    }
                ).insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(frappe.get_traceback(), "chatbot_reply_log_error")

        # Increment session cost estimate if configured
        try:
            if session_name and ("cost_per_message" in locals()) and float(cost_per_message) > 0:
                current = frappe.db.get_value("AI Chat Session", session_name, "cost_estimate") or 0
                frappe.db.set_value("AI Chat Session", session_name, "cost_estimate", float(current) + float(cost_per_message))
        except Exception:
            frappe.log_error(frappe.get_traceback(), "chatbot_reply_cost_update_error")

        resp = {"message": {"role": "assistant", "content": reply}, "session": session_name}
        if citations:
            resp["citations"] = citations
        return resp

    except Exception:
        frappe.log_error(frappe.get_traceback(), "chatbot_reply_error")
        # Best-effort fallback
        fallback = {
            "message": {
                "role": "assistant",
                "content": "Sorry, something went wrong while generating a reply.",
            },
            "session": session,
        }
        return fallback

@frappe.whitelist()
def chatbot_reply_stream(course, chapter, lesson, messages=None, session=None):
    """
    Stream assistant reply as SSE (text/event-stream). If proxy streaming is not
    available, simulate streaming with heuristic results. Returns a Werkzeug Response.
    """
    from werkzeug.wrappers.response import Response

    try:
        ch = int(chapter) if chapter is not None else 1
        ls = int(lesson) if lesson is not None else 1

        if isinstance(messages, str):
            try:
                messages = json.loads(messages)
            except Exception:
                messages = []
        messages = messages or []

        lesson_ctx = get_lesson(course, ch, ls) or {}
        title = lesson_ctx.get("title") or "this lesson"
        chapter_title = lesson_ctx.get("chapter_title") or "this chapter"
        course_title = lesson_ctx.get("course_title") or course

        user_utterance = ""
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "user":
                user_utterance = (m.get("content") or "").strip()
                break

        settings = frappe.get_single("LMS Settings")
        course_cfg = frappe.db.get_value(
            "AI Assistant Config",
            {"course": lesson_ctx.get("course") or course},
            [
                "enable_overrides",
                "mode",
                "system_prompt",
                "default_model",
                "enable_rag",
                "proxy_base_url",
                "proxy_api_key",
            ],
            as_dict=True,
        )
        eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
        mode = (eff.get("mode") or "Demo Mode").strip()
        system_prompt = eff.get("system_prompt") or ""
        model = eff.get("default_model")
        proxy_base = eff.get("chat_base_url") or ""
        proxy_key = eff.get("chat_api_key") or ""
        proxy_custom_headers = eff.get("chat_custom_headers") or ""

        cost_per_message = float(eff.get("cost_per_message") or 0)
        cost_cap = float(eff.get("cost_cap_per_user_per_day") or 0)

        # Resolve prompt preset if no explicit system prompt
        if not system_prompt:
            preset_name = eff.get("prompt_preset") or eff.get("default_preset")
            if preset_name:
                preset_prompt = frappe.db.get_value("AI Prompt Preset", preset_name, "prompt")
                system_prompt = preset_prompt or ""
        ctx = f"Course: {course_title} | Chapter: {chapter_title} | Lesson: {title}."
        effective_system_prompt = (system_prompt + "\n\n" + ctx).strip()

        # Enforce daily message cap before streaming
        cap = int(eff.get("max_messages_per_user_per_day") or 0)
        if cap > 0:
            sessions = frappe.get_all(
                "AI Chat Session",
                filters={"user": frappe.session.user, "course": lesson_ctx.get("course") or course},
                pluck="name",
            )
            if sessions:
                count = frappe.db.count(
                    "AI Chat Message",
                    filters={
                        "session": ("in", sessions),
                        "role": "user",
                        "creation": (">=", add_days(now(), -1)),
                    },
                )
                if count >= cap:
                    def limited():
                        meta = json.dumps({"type": "meta", "session": session}).encode()
                        yield b"data: " + meta + b"\n\n"
                        msg = {
                            "id": "limit",
                            "choices": [{"delta": {"content": "You’ve reached the daily chat limit for this course. Please try again tomorrow."}}],
                        }
                        yield b"data: " + json.dumps(msg).encode() + b"\n\n"
                        yield b"data: [DONE]\n\n"
                    from werkzeug.wrappers.response import Response
                    return Response(limited(), mimetype="text/event-stream")

        # Enforce daily cost cap before streaming
        if cost_cap > 0 and cost_per_message > 0:
            sessions = frappe.get_all(
                "AI Chat Session",
                filters={"user": frappe.session.user, "course": lesson_ctx.get("course") or course},
                pluck="name",
            )
            assistant_msgs = 0
            if sessions:
                assistant_msgs = frappe.db.count(
                    "AI Chat Message",
                    filters={
                        "session": ("in", sessions),
                        "role": "assistant",
                        "creation": (">=", add_days(now(), -1)),
                    },
                )
            current_spend = assistant_msgs * cost_per_message
            if current_spend + cost_per_message > cost_cap:
                def cost_limited():
                    meta = json.dumps({"type": "meta", "session": session}).encode()
                    yield b"data: " + meta + b"\n\n"
                    msg = {
                        "id": "cost_limit",
                        "choices": [{"delta": {"content": "You’ve reached the daily cost limit for this course. Please try again tomorrow."}}],
                    }
                    yield b"data: " + json.dumps(msg).encode() + b"\n\n"
                    yield b"data: [DONE]\n\n"
                from werkzeug.wrappers.response import Response
                return Response(cost_limited(), mimetype="text/event-stream")

        # Session ensure
        session_name = session
        try:
            if not session_name:
                session_doc = frappe.get_doc(
                    {
                        "doctype": "AI Chat Session",
                        "user": frappe.session.user,
                        "course": lesson_ctx.get("course") or course,
                        "lesson": lesson_ctx.get("name"),
                        "chapter_index": ch,
                        "lesson_index": ls,
                    }
                ).insert(ignore_permissions=True)
                session_name = session_doc.name
        except Exception:
            frappe.log_error(frappe.get_traceback(), "chatbot_reply_stream_session_create_error")

        # RAG retrieval (Phase 2)
        citations = []
        if eff.get("enable_rag") and user_utterance:
            try:
                if not frappe.db.exists("AI Knowledge Chunk", {"course": course, "lesson": lesson_ctx.get("name")}):
                    chunks = chunk_lesson(lesson_ctx.get("name"))
                    for idx, ch in enumerate(chunks):
                        frappe.get_doc(
                            {
                                "doctype": "AI Knowledge Chunk",
                                "course": course,
                                "lesson": lesson_ctx.get("name"),
                                "source_type": ch.get("source_type") or "Lesson",
                                "title": ch.get("title"),
                                "content": ch.get("content"),
                                "h_path": ch.get("h_path"),
                                "order": ch.get("order", idx),
                                "chunk_id": f"{lesson_ctx.get('name')}-{idx}",
                            }
                        ).insert(ignore_permissions=True)
                citations = simple_retrieve(course, lesson_ctx.get("name"), user_utterance, top_k=3) or []
            except Exception:
                frappe.log_error(frappe.get_traceback(), "rag_stream_retrieve_error")

        # Prepare message history
        history = []
        for m in messages:
            if isinstance(m, dict) and m.get("role") in ("user", "assistant"):
                history.append({"role": m.get("role"), "content": m.get("content")})

        def simulate_stream(full_text: str):
            # yield meta first
            meta_payload = {"type": "meta", "session": session_name}
            if citations:
                meta_payload["citations"] = citations
            meta = json.dumps(meta_payload).encode()
            yield b"data: " + meta + b"\n\n"
            acc = ""
            for ch_ in full_text:
                acc += ch_
                delta_obj = {"id": "local", "choices": [{"delta": {"content": ch_}}]}
                yield b"data: " + json.dumps(delta_obj).encode() + b"\n\n"
            yield b"data: [DONE]\n\n"
            # log
            try:
                if user_utterance:
                    frappe.get_doc(
                        {
                            "doctype": "AI Chat Message",
                            "session": session_name,
                            "role": "user",
                            "content": user_utterance,
                        }
                    ).insert(ignore_permissions=True)
                frappe.get_doc(
                    {
                        "doctype": "AI Chat Message",
                        "session": session_name,
                        "role": "assistant",
                        "content": acc,
                    }
                ).insert(ignore_permissions=True)
            except Exception:
                frappe.log_error(frappe.get_traceback(), "chatbot_reply_stream_log_error")

        def proxy_stream():
            # yield meta first
            meta_payload = {"type": "meta", "session": session_name}
            if citations:
                meta_payload["citations"] = citations
            meta = json.dumps(meta_payload).encode()
            yield b"data: " + meta + b"\n\n"
            acc_text = ""
            sys_prompt = effective_system_prompt
            if citations:
                src = "\n\nSources:\n" + "\n".join(
                    [f"[{i+1}] {c.get('title')} — lesson" for i, c in enumerate(citations)]
                )
                sys_prompt = (sys_prompt + src).strip()
            payload = build_openai_chat_payload(sys_prompt, history, model)
            for chunk in stream_ai_proxy(proxy_base, proxy_key, payload, custom_headers_json=proxy_custom_headers) or []:
                if isinstance(chunk, tuple) and chunk[0] == "__acc__":
                    acc_text = chunk[1].get("text", "")
                    break
                else:
                    yield chunk
            # After upstream ends, ensure DONE
            yield b"data: [DONE]\n\n"
            # Log
            try:
                if user_utterance:
                    frappe.get_doc(
                        {
                            "doctype": "AI Chat Message",
                            "session": session_name,
                            "role": "user",
                            "content": user_utterance,
                        }
                    ).insert(ignore_permissions=True)
                frappe.get_doc(
                    {
                        "doctype": "AI Chat Message",
                        "session": session_name,
                        "role": "assistant",
                        "content": acc_text,
                    }
                ).insert(ignore_permissions=True)
            except Exception:
                frappe.log_error(frappe.get_traceback(), "chatbot_reply_stream_log_error")

        # Decide strategy
        # TEMPORARY DEBUG: Show what values we're getting (STREAMING VERSION)
        print(f"DEBUG STREAMING MODE: '{mode}' (lower: '{mode.lower()}')")
        print(f"DEBUG STREAMING PROXY_BASE: '{proxy_base}' (len: {len(proxy_base) if proxy_base else 'None'})")
        print(f"DEBUG STREAMING CONDITION: {(mode.lower() in ['proxy', 'external ai service']) and proxy_base}")
        
        # Check if using external AI service (handle both old "proxy" and new "external ai service" terminology)
        if (mode.lower() in ["proxy", "external ai service"]) and proxy_base:
            gen = proxy_stream()
        else:
            reply = draft_assistant_reply(user_utterance, title, chapter_title, course_title)
            gen = simulate_stream(reply)

        return Response(gen, mimetype="text/event-stream")

    except Exception:
        frappe.log_error(frappe.get_traceback(), "chatbot_reply_stream_error")
        # Fallback JSON
        return chatbot_reply(course, chapter, lesson, messages=messages, session=session)


@frappe.whitelist()
def get_chat_history(course, chapter, lesson, limit=30):
    """
    Return the latest AI Chat Session and up to `limit` most recent messages
    for the current user in the given course/chapter/lesson.
    """
    try:
        ch = int(chapter) if chapter is not None else 1
        ls = int(lesson) if lesson is not None else 1

        lesson_ctx = get_lesson(course, ch, ls) or {}
        course_name = course
        lesson_name = lesson_ctx.get("name")
        if not lesson_name:
            return {"session": None, "messages": []}

        sessions = frappe.get_all(
            "AI Chat Session",
            filters={
                "user": frappe.session.user,
                "course": course_name,
                "lesson": lesson_name,
            },
            pluck="name",
            order_by="creation desc",
            limit=1,
        )
        if not sessions:
            return {"session": None, "messages": []}

        session_name = sessions[0]
        # Fetch latest `limit` messages and return in chronological order
        msgs_desc = frappe.get_all(
            "AI Chat Message",
            filters={"session": session_name},
            fields=["role", "content", "creation"],
            order_by="creation desc",
            limit=cint(limit) if str(limit).isdigit() else 30,
        )
        messages = list(reversed(msgs_desc))
        # Strip creation in response
        messages = [{"role": m["role"], "content": m["content"]} for m in messages]
        return {"session": session_name, "messages": messages}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "get_chat_history_error")
        return {"session": None, "messages": []}


@frappe.whitelist()
def get_assistant_limits(course):
    """
    Return effective assistant limits and today's usage for the current user in a course.
    { max_messages_per_user_per_day, used_messages_today, messages_left,
      cost_per_message, cost_cap_per_user_per_day, spend_today, cost_left }
    """
    try:
        settings = frappe.get_single("LMS Settings")
        course_cfg = frappe.db.get_value(
            "AI Assistant Config",
            {"course": course},
            [
                "enable_overrides",
                "mode",
                "system_prompt",
                "default_model",
                "enable_rag",
                "proxy_base_url",
                "proxy_api_key",
                "prompt_preset",
                "max_messages_per_user_per_day",
                "cost_per_message",
                "cost_cap_per_user",
            ],
            as_dict=True,
        )
        eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)

        # Messages used today
        sessions = frappe.get_all(
            "AI Chat Session",
            filters={"user": frappe.session.user, "course": course},
            pluck="name",
        )
        used_messages = 0
        assistant_msgs = 0
        if sessions:
            used_messages = frappe.db.count(
                "AI Chat Message",
                filters={
                    "session": ("in", sessions),
                    "role": "user",
                    "creation": (">=", add_days(now(), -1)),
                },
            )
            assistant_msgs = frappe.db.count(
                "AI Chat Message",
                filters={
                    "session": ("in", sessions),
                    "role": "assistant",
                    "creation": (">=", add_days(now(), -1)),
                },
            )

        cap = int(eff.get("max_messages_per_user_per_day") or 0)
        messages_left = max(0, cap - used_messages) if cap > 0 else None
        cost_per_message = float(eff.get("cost_per_message") or 0)
        cost_cap = float(eff.get("cost_cap_per_user_per_day") or 0)
        spend_today = assistant_msgs * cost_per_message if cost_per_message > 0 else 0.0
        cost_left = None
        if cost_cap > 0 and cost_per_message > 0:
            cost_left = max(0.0, cost_cap - spend_today)

        return {
            "max_messages_per_user_per_day": cap,
            "used_messages_today": used_messages,
            "messages_left": messages_left,
            "cost_per_message": cost_per_message,
            "cost_cap_per_user_per_day": cost_cap,
            "spend_today": spend_today,
            "cost_left": cost_left,
            "enabled": bool(eff.get("enabled", True)),
        }
    except Exception:
        frappe.log_error(frappe.get_traceback(), "get_assistant_limits_error")
        return {}


@frappe.whitelist(allow_guest=True)
def is_assistant_enabled(course):
    """Return True/False for whether the in-lesson assistant should be shown for this course."""
    try:
        # Global feature flag
        global_enabled = bool(frappe.db.get_single_value("LMS Settings", "enable_lesson_assistant") or 0)
        if not global_enabled:
            return False
        course_cfg = frappe.db.get_value(
            "AI Assistant Config",
            {"course": course},
            ["enable_overrides", "enabled"],
            as_dict=True,
        )
        if course_cfg and course_cfg.get("enable_overrides") and course_cfg.get("enabled") == 0:
            return False
        return True
    except Exception:
        frappe.log_error(frappe.get_traceback(), "is_assistant_enabled_error")
        return True
    except Exception:
        frappe.log_error(frappe.get_traceback(), "chatbot_reply_error")
        return {
            "message": {
                "role": "assistant",
                "content": (
                    "I couldn’t access lesson context just now. "
                    "Try reloading the page or ask a specific question about the lesson."
                ),
            }
        }



# RAG and Content Generation Functions

@frappe.whitelist()
def enqueue_rag_index_course(course):
    """Enqueue background job to (re)index all lessons for a course."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    from lms.lms.ai_rag import index_course
    job = frappe.enqueue(index_course, queue="default", job_name=f"rag-index-{course}", course=course)
    return {"job_id": job.get_id() if hasattr(job, "get_id") else None}


@frappe.whitelist()
def enqueue_rag_index_lesson(lesson):
    """Enqueue background job to (re)index a single lesson."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    from lms.lms.ai_rag import index_lesson
    job = frappe.enqueue(index_lesson, queue="default", job_name=f"rag-index-lesson-{lesson}", lesson_name=lesson)
    return {"job_id": job.get_id() if hasattr(job, "get_id") else None}


@frappe.whitelist()
def get_rag_index_summary(course=None, lesson=None):
    """Return summary of RAG index for a course or a specific lesson."""
    try:
        if lesson:
            # Resolve lesson slug to actual lesson name if needed
            if course:
                resolved_lesson = resolve_lesson_slug(course, lesson)
                if resolved_lesson:
                    lesson = resolved_lesson
            total_chunks = frappe.db.count("AI Knowledge Chunk", {"lesson": lesson})
            embedded_chunks = frappe.db.count(
                "AI Knowledge Chunk", {"lesson": lesson, "embedding_model": ["is", "set"]}
            )
            # counts by source type
            by_source = {}
            for st in ("Lesson", "Instructor", "File", "External"):
                by_source[st] = frappe.db.count("AI Knowledge Chunk", {"lesson": lesson, "source_type": st})
            last_run = frappe.get_all(
                "AI Knowledge Index Run",
                filters={"lesson": lesson},
                fields=["status", "chunk_count", "last_indexed_at"],
                order_by="last_indexed_at desc",
                limit=1,
            )
            return {
                "scope": "lesson",
                "lesson": lesson,
                "total_chunks": total_chunks,
                "by_source": by_source,
                "embedded_chunks": embedded_chunks,
                "last_run": last_run[0] if last_run else None,
            }
        elif course:
            total_chunks = frappe.db.count("AI Knowledge Chunk", {"course": course})
            embedded_chunks = frappe.db.count(
                "AI Knowledge Chunk", {"course": course, "embedding_model": ["is", "set"]}
            )
            by_source = {}
            for st in ("Lesson", "Instructor", "File", "External"):
                by_source[st] = frappe.db.count("AI Knowledge Chunk", {"course": course, "source_type": st})
            last_run = frappe.get_all(
                "AI Knowledge Index Run",
                filters={"course": course, "lesson": ["is", "not set"]},
                fields=["status", "chunk_count", "last_indexed_at"],
                order_by="last_indexed_at desc",
                limit=1,
            )
            return {
                "scope": "course",
                "course": course,
                "total_chunks": total_chunks,
                "by_source": by_source,
                "embedded_chunks": embedded_chunks,
                "last_run": last_run[0] if last_run else None,
            }
        else:
            return {}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "get_rag_index_summary_error")
        return {}


@frappe.whitelist()
def get_lesson_attachment_status(lesson=None):
    """Return per-file indexing status for a lesson's attachments.

    [{file_name, file_url, mime_type, size, chunks}]
    """
    if not lesson or lesson == "undefined" or lesson == "null":
        return []
    try:
        from lms.lms.ai_rag import _get_lesson_attachments
        files = _get_lesson_attachments(lesson)
        out = []
        for f in files:
            url = f.get("file_url")
            count = frappe.db.count("AI Knowledge Chunk", {"lesson": lesson, "url": url})
            out.append({
                "file_name": f.get("file_name"),
                "file_url": url,
                "mime_type": f.get("mime_type"),
                "size": f.get("file_size"),
                "chunks": count,
            })
        return out
    except Exception:
        frappe.log_error(frappe.get_traceback(), "get_lesson_attachment_status_error")
        return []


@frappe.whitelist()
def clear_assistant_pause(course: str):
    """Clear per-course paused_by_alert to re-enable assistant after an alert."""
    frappe.only_for(["System Manager", "Moderator"])
    if not frappe.db.exists("AI Assistant Config", {"course": course}):
        return {"ok": False, "error": "no_config"}
    try:
        frappe.db.set_value("AI Assistant Config", {"course": course}, "paused_by_alert", 0)
        return {"ok": True}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "clear_assistant_pause_error")
        return {"ok": False}


@frappe.whitelist()
def check_proxy_alerts():
    """Compute recent proxy error rate and p95 per course and auto-pause if thresholds exceeded."""
    try:
        settings = frappe.get_single("LMS Settings")
        window_min = int(settings.get("assistant_proxy_alert_window_min") or 5)
        err_thresh = int(settings.get("assistant_proxy_alert_error_rate_pct") or 20)
        p95_thresh = int(settings.get("assistant_proxy_alert_p95_ms") or 4000)
        auto_pause_default = bool(settings.get("assistant_proxy_auto_pause_default"))

        # Aggregate recent logs per course
        logs = frappe.db.sql(
            """
            select course,
                   count(*) as requests,
                   sum(case when status='error' then 1 else 0 end) as errors
            from `tabAI Proxy Log`
            where time >= DATE_SUB(NOW(), INTERVAL %(mins)s MINUTE)
            group by course
            """,
            {"mins": window_min},
            as_dict=True,
        )
        for row in logs:
            if not row.course:
                continue
            req = int(row.requests or 0)
            if req == 0:
                continue
            err_rate = round((int(row.errors or 0) * 100.0) / req, 2)
            # Compute p95 for this course in window
            lat_rows = frappe.db.sql(
                """
                select latency_ms from `tabAI Proxy Log`
                where course=%(course)s and time >= DATE_SUB(NOW(), INTERVAL %(mins)s MINUTE)
                and latency_ms is not null
                order by latency_ms
                """,
                {"course": row.course, "mins": window_min},
                as_dict=True,
            )
            p95 = 0
            if lat_rows:
                idx = int(max(0, round(0.95 * (len(lat_rows) - 1))))
                p95 = int(lat_rows[idx].latency_ms or 0)
            needs_pause = (err_rate >= err_thresh) or (p95 >= p95_thresh)
            if not needs_pause:
                continue
            # Resolve per-course config
            cfg = frappe.db.get_value(
                "AI Assistant Config",
                {"course": row.course},
                ["name", "auto_pause_on_alert", "paused_by_alert"],
                as_dict=True,
            )
            if not cfg:
                continue
            if cfg.get("paused_by_alert"):
                continue
            use_auto = cfg.get("auto_pause_on_alert") if cfg.get("auto_pause_on_alert") is not None else auto_pause_default
            if not use_auto:
                continue
            try:
                frappe.db.set_value("AI Assistant Config", cfg.get("name"), "paused_by_alert", 1)
            except Exception:
                frappe.log_error(frappe.get_traceback(), "proxy_auto_pause_error")
    except Exception:
        frappe.log_error(frappe.get_traceback(), "check_proxy_alerts_error")


@frappe.whitelist()
def generate_quiz_from_lesson(lesson, num_questions: int = 5, difficulty: str | None = None):
    """Generate a draft LMS Quiz from a lesson using the AI proxy and RAG content.

    Returns {ok, quiz, created_questions}
    """
    try:
        lesson_doc = frappe.get_doc("Course Lesson", lesson)
        course = lesson_doc.course
        # Prepare context from chunks
        chunks = chunk_lesson(lesson)
        ctx_text = "\n\n".join([c.get("content") for c in chunks[:20]])[:4000]
        # Resolve proxy config
        settings = frappe.get_single("LMS Settings")
        course_cfg = frappe.db.get_value(
            "AI Assistant Config",
            {"course": course},
            [
                "enable_overrides",
                "proxy_base_url",
                "proxy_api_key",
                "default_model",
            ],
            as_dict=True,
        )
        eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
        base = eff.get("chat_base_url") or ""
        key = eff.get("chat_api_key") or ""
        custom_headers = eff.get("chat_custom_headers") or ""
        model = eff.get("default_model")
        if not base:
            frappe.throw("Proxy is not configured for quiz generation")
        # Build prompt
        sys = (
            "You are an assistant that writes high-quality multiple-choice questions (MCQ) "
            "based strictly on the provided lesson context. Output JSON only."
        )
        user = (
            f"Lesson title: {lesson_doc.title}\nContext:\n{ctx_text}\n\n"
            f"Generate {int(num_questions)} MCQs with exactly 4 options each and exactly 1 correct. "
            f"Difficulty: {difficulty or 'medium'}. Respond as JSON with schema: "
            "{\"questions\":[{\"question\":str,\"options\":[str,str,str,str],\"answer\":int}]}"
        )
        payload = build_openai_chat_payload(sys, [{"role": "user", "content": user}], model, temperature=0.4, max_tokens=1200)
        res = call_ai_proxy(base, key, payload, custom_headers_json=custom_headers)
        text = (res.get("content") or "").strip()
        # Extract JSON (tolerate code fences)
        import json, re
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z0-9]*\n|```$", "", text)
        m = re.search(r"\{[\s\S]*\}$", text)
        data = None
        if m:
            try:
                data = json.loads(m.group(0))
            except Exception:
                data = None
        if not data or not isinstance(data.get("questions"), list):
            frappe.throw("Quiz generation failed: invalid response")
        # Create questions and quiz
        created_q = []
        for q in data["questions"]:
            try:
                doc = frappe.get_doc({
                    "doctype": "LMS Question",
                    "type": "Choices",
                    "question": q.get("question"),
                    "option_1": (q.get("options") or [None]*4)[0],
                    "option_2": (q.get("options") or [None]*4)[1],
                    "option_3": (q.get("options") or [None]*4)[2],
                    "option_4": (q.get("options") or [None]*4)[3],
                    f"is_correct_{int(q.get('answer') or 1)}": 1,
                })
                doc.insert(ignore_permissions=True)
                created_q.append(doc.name)
            except Exception:
                continue
        if not created_q:
            frappe.throw("No questions created")
        quiz = frappe.get_doc({
            "doctype": "LMS Quiz",
            "title": f"AI Quiz - {lesson_doc.title}",
            "lesson": lesson_doc.name,
            "passing_percentage": 60,
        })
        for qname in created_q:
            quiz.append("questions", {"question": qname, "marks": 1})
        quiz.insert(ignore_permissions=True)
        return {"ok": True, "quiz": quiz.name, "created_questions": created_q}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "generate_quiz_from_lesson_error")
        return {"ok": False}


@frappe.whitelist()
def generate_lesson_draft(lesson):
    """Generate a summary and glossary for a lesson and save as AI Lesson Draft.

    Returns {ok, draft}
    """
    try:
        lesson_doc = frappe.get_doc("Course Lesson", lesson)
        course = lesson_doc.course
        # Prepare context
        chunks = chunk_lesson(lesson)
        ctx_text = "\n\n".join([c.get("content") for c in chunks[:30]])[:6000]
        settings = frappe.get_single("LMS Settings")
        course_cfg = frappe.db.get_value(
            "AI Assistant Config",
            {"course": course},
            ["enable_overrides", "proxy_base_url", "proxy_api_key", "default_model"],
            as_dict=True,
        )
        eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
        base = eff.get("chat_base_url") or ""
        key = eff.get("chat_api_key") or ""
        custom_headers = eff.get("chat_custom_headers") or ""
        model = eff.get("default_model")
        if not base:
            frappe.throw("Proxy is not configured for draft generation")
        sys = "You generate concise lesson summaries and a glossary of key terms as JSON."
        user = (
            f"Lesson: {lesson_doc.title}\nContext:\n{ctx_text}\n\nRespond as JSON with schema: "
            "{\"summary\": str, \"glossary\": [{\"term\": str, \"definition\": str}]}"
        )
        payload = build_openai_chat_payload(sys, [{"role": "user", "content": user}], model, temperature=0.3, max_tokens=1200)
        res = call_ai_proxy(base, key, payload, custom_headers_json=custom_headers)
        text = (res.get("content") or "").strip()
        import json, re
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z0-9]*\n|```$", "", text)
        data = None
        try:
            data = json.loads(text)
        except Exception:
            m = re.search(r"\{[\s\S]*\}$", text)
            if m:
                try:
                    data = json.loads(m.group(0))
                except Exception:
                    data = None
        if not data or not data.get("summary"):
            frappe.throw("Draft generation failed: invalid response")
        draft = frappe.get_doc({
            "doctype": "AI Lesson Draft",
            "lesson": lesson_doc.name,
            "course": course,
            "summary": data.get("summary"),
            "glossary": json.dumps(data.get("glossary") or [], ensure_ascii=False),
        })
        draft.insert(ignore_permissions=True)
        return {"ok": True, "draft": draft.name}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "generate_lesson_draft_error")
        return {"ok": False}


@frappe.whitelist()
def generate_faq_from_transcripts(course=None, lesson=None, max_pairs: int = 20):
    """Generate an AI FAQ Draft from recent chat Q&A pairs for a course/lesson.

    Returns {ok, draft}
    """
    try:
        # Collect recent Q&A pairs
        conditions = {}
        if course:
            conditions["course"] = course
        if lesson:
            conditions["lesson"] = lesson
        # Find sessions
        sessions = frappe.get_all("AI Chat Session", filters=conditions, pluck="name")
        if not sessions:
            frappe.throw("No chat sessions found for this course. FAQ Generation requires existing student-AI conversations to analyze. Students must use the AI Assistant chat feature first.")
        msgs = frappe.get_all(
            "AI Chat Message",
            filters={"session": ("in", sessions)},
            fields=["role", "content", "creation"],
            order_by="creation desc",
            limit_page_length=200,
        )
        # Pair user->assistant
        pairs = []
        last_user = None
        for m in msgs[::-1]:  # oldest to newest
            if m.role == "user":
                last_user = m.content
            elif m.role == "assistant" and last_user:
                pairs.append({"q": last_user, "a": m.content})
                last_user = None
        if not pairs:
            frappe.throw("No question-answer pairs found in chat sessions. Students need to ask questions and receive answers from the AI Assistant before FAQ generation can work.")
        pairs = pairs[-int(max_pairs):]

        # Build prompt for proxy
        settings = frappe.get_single("LMS Settings")
        cfg = frappe.db.get_value(
            "AI Assistant Config",
            {"course": course},
            ["enable_overrides", "proxy_base_url", "proxy_api_key", "default_model"],
            as_dict=True,
        )
        eff = determine_effective_assistant_config(settings.as_dict(), cfg)
        base = eff.get("chat_base_url") or ""
        key = eff.get("chat_api_key") or ""
        custom_headers = eff.get("chat_custom_headers") or ""
        model = eff.get("default_model")
        if not base:
            if settings.get("assistant_mode") == "Demo Mode":
                frappe.throw("FAQ Generation requires External AI Service configuration. Currently in Demo Mode - go to LMS Settings > AI Assistant to configure External AI Service.")
            else:
                frappe.throw("Proxy is not configured for FAQ generation")
        import json
        sys = "You generate concise FAQ items from provided Q&A pairs. Output JSON only."
        user = (
            "Q&A pairs (JSON):\n" + json.dumps(pairs, ensure_ascii=False) +
            "\n\nReturn {\"items\":[{\"question\":str,\"answer\":str}]} with 5-10 useful FAQs."
        )
        payload = build_openai_chat_payload(sys, [{"role": "user", "content": user}], model, temperature=0.3, max_tokens=1200)
        res = call_ai_proxy(base, key, payload, custom_headers_json=custom_headers)
        text = (res.get("content") or "").strip()
        try:
            data = json.loads(text)
        except Exception:
            import re
            m = re.search(r"\{[\s\S]*\}$", text)
            data = json.loads(m.group(0)) if m else None
        if not data or not isinstance(data.get("items"), list):
            frappe.throw("FAQ generation failed: invalid response")
        # Create draft
        draft = frappe.get_doc({
            "doctype": "AI FAQ Draft",
            "course": course,
            "lesson": lesson,
        })
        for it in data["items"]:
            q = (it.get("question") or "").strip()
            a = (it.get("answer") or "").strip()
            if not q or not a:
                continue
            draft.append("items", {"question": q, "answer": a})
        draft.insert(ignore_permissions=True)
        return {"ok": True, "draft": draft.name}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "generate_faq_from_transcripts_error")
        return {"ok": False}


@frappe.whitelist()
def export_faq_draft_markdown(draft):
    """Return a Markdown representation of an AI FAQ Draft."""
    try:
        d = frappe.get_doc("AI FAQ Draft", draft)
        lines = []
        title = ("FAQ — " + (d.course or "") + (" — " + d.lesson if d.lesson else "")).strip()
        if title:
            lines.append(f"# {title}")
            lines.append("")
        for it in (d.items or []):
            q = (it.get("question") or "").strip()
            a = (it.get("answer") or "").strip()
            if not q or not a:
                continue
            lines.append(f"## {q}")
            lines.append("")
            lines.append(a)
            lines.append("")
        md = "\n".join(lines)
        return {"ok": True, "markdown": md}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "export_faq_draft_markdown_error")
        return {"ok": False}


@frappe.whitelist()
def promote_faq_draft_to_web_page(draft, published: int = 0):
    """Create a Web Page from an AI FAQ Draft. Returns the Web Page name."""
    try:
        res = export_faq_draft_markdown(draft)
        if not res or not res.get("ok"):
            frappe.throw("Unable to render FAQ draft to Markdown")
        md = res.get("markdown") or ""
        d = frappe.get_doc("AI FAQ Draft", draft)
        title = ("FAQ — " + (d.course or "") + (" — " + d.lesson if d.lesson else "")).strip()
        page = frappe.get_doc({"doctype": "Web Page", "title": title, "published": int(published)})
        html = f"<div class=\"prose\">\n{frappe.utils.markdown(md)}\n</div>"
        if hasattr(page, "content"):
            page.content = html
        else:
            page.update({"content": html})
        page.insert(ignore_permissions=True)
        return {"ok": True, "page": page.name}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "promote_faq_draft_to_web_page_error")
        return {"ok": False}


@frappe.whitelist()
def export_lesson_draft_markdown(draft):
    """Return Markdown for an AI Lesson Draft (summary + glossary)."""
    try:
        d = frappe.get_doc("AI Lesson Draft", draft)
        lines = []
        title = ("Lesson Draft — " + (d.course or "") + (" — " + d.lesson if d.lesson else "")).strip()
        if title:
            lines.append(f"# {title}")
            lines.append("")
        if d.summary:
            lines.append("## Summary")
            lines.append("")
            lines.append(d.summary)
            lines.append("")
        if d.glossary:
            lines.append("## Glossary")
            lines.append("")
            lines.append(d.glossary)
            lines.append("")
        md = "\n".join(lines)
        return {"ok": True, "markdown": md}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "export_lesson_draft_markdown_error")
        return {"ok": False}


@frappe.whitelist()
def promote_lesson_draft_to_web_page(draft, published: int = 0):
    try:
        res = export_lesson_draft_markdown(draft)
        if not res or not res.get("ok"):
            frappe.throw("Unable to render Lesson draft to Markdown")
        md = res.get("markdown") or ""
        d = frappe.get_doc("AI Lesson Draft", draft)
        title = ("Lesson Draft — " + (d.course or "") + (" — " + d.lesson if d.lesson else "")).strip()
        page = frappe.get_doc({"doctype": "Web Page", "title": title, "published": int(published)})
        html = f"<div class=\"prose\">\n{frappe.utils.markdown(md)}\n</div>"
        if hasattr(page, "content"):
            page.content = html
        else:
            page.update({"content": html})
        page.insert(ignore_permissions=True)
        return {"ok": True, "page": page.name}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "promote_lesson_draft_to_web_page_error")
        return {"ok": False}


@frappe.whitelist()
def enqueue_external_source(docname):
    """Enqueue fetch+index for a single AI External Source record."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    job = frappe.enqueue(index_external_source, queue="default", job_name=f"rag-external-{docname}", docname=docname)
    return {"job_id": job.get_id() if hasattr(job, "get_id") else None}


@frappe.whitelist()
def get_external_sources(course=None):
    """List external sources for a course."""
    if not course:
        return []
    try:
        rows = frappe.get_all(
            "AI External Source",
            filters={"course": course},
            fields=["name", "title", "url", "lesson", "status", "last_fetched_at"],
            order_by="modified desc",
            limit_page_length=200,
        )
        return rows
    except Exception:
        frappe.log_error(frappe.get_traceback(), "get_external_sources_error")
        return []


@frappe.whitelist()
def enqueue_external_sources_course(course):
    """Enqueue fetch+index for all allowed external sources in a course."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    rows = frappe.get_all(
        "AI External Source",
        filters={"course": course, "allowed": 1, "status": ["in", ["New", "Fetched", "Error"]]},
        pluck="name",
    )
    job_ids = []
    for name in rows:
        job = frappe.enqueue(index_external_source, queue="default", job_name=f"rag-external-{name}", docname=name)
        job_ids.append(job.get_id() if hasattr(job, "get_id") else None)
    return {"job_ids": job_ids}


@frappe.whitelist()
def enqueue_external_sources_lesson(course, lesson):
    """Enqueue fetch+index for all allowed external sources in a specific lesson."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    rows = frappe.get_all(
        "AI External Source",
        filters={
            "course": course,
            "lesson": lesson,
            "allowed": 1,
            "status": ["in", ["New", "Fetched", "Error"]],
        },
        pluck="name",
    )
    job_ids = []
    for name in rows:
        job = frappe.enqueue(index_external_source, queue="default", job_name=f"rag-external-{name}", docname=name)
        job_ids.append(job.get_id() if hasattr(job, "get_id") else None)
    return {"job_ids": job_ids}


def _resolve_lesson_slug_to_name(lesson_slug):
    """Resolve URL lesson slug (like '1-1') to actual lesson name.
    
    Returns the actual lesson name, or the original slug if not found.
    This handles cases where frontend URLs use slugs but database uses full lesson names.
    """
    # First, try direct lookup (already a valid lesson name)
    if frappe.db.exists("Course Lesson", lesson_slug):
        return lesson_slug
    
    # If direct lookup fails, try to find lessons that might match the slug pattern
    # For now, return the first available lesson as a fallback
    # TODO: Implement proper slug-to-lesson mapping logic based on your URL structure
    
    lessons = frappe.get_all("Course Lesson", ["name"], limit=1)
    if lessons:
        frappe.logger().info(f"🔄 Resolved lesson slug '{lesson_slug}' to '{lessons[0].name}' (fallback to first available lesson)")
        return lessons[0].name
    
    # If no lessons found, return original slug (will likely fail downstream)
    frappe.logger().warning(f"⚠️ Could not resolve lesson slug '{lesson_slug}', returning original")
    return lesson_slug


@frappe.whitelist()
def enqueue_rag_embeddings_lesson(lesson):
    """Enqueue embeddings computation for a lesson based on settings/effective config."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    
    # Resolve lesson slug to actual lesson name
    resolved_lesson = _resolve_lesson_slug_to_name(lesson)
    frappe.logger().info(f"🔍 Lesson resolution: '{lesson}' -> '{resolved_lesson}'")
    
    # Resolve course for lesson
    course = frappe.db.get_value("Course Lesson", resolved_lesson, "course")
    settings = frappe.get_single("LMS Settings")
    course_cfg = frappe.db.get_value(
        "AI Assistant Config",
        {"course": course},
        [
            "enable_overrides",
            "proxy_base_url",
            "proxy_api_key",
            "enable_rag",
            "default_model",
        ],
        as_dict=True,
    )
    from lms.lms.ai_utils import determine_effective_assistant_config

    eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
    if not eff.get("enable_rag"):
        frappe.throw("Embeddings retrieval is disabled in settings")
    # Use dedicated embedding provider settings, fallback to chat provider
    base = eff.get("embedding_base_url") or eff.get("chat_base_url") or ""
    key = eff.get("embedding_api_key") or eff.get("chat_api_key") or ""
    custom_headers = eff.get("embedding_custom_headers") or eff.get("chat_custom_headers") or ""
    model = (eff.get("embedding_model") or "").strip()
    if not base or not model:
        if settings.get("assistant_mode") == "Demo Mode":
            frappe.throw("This feature requires External AI Service configuration. Currently in Demo Mode - go to LMS Settings > AI Assistant to configure External AI Service.")
        else:
            frappe.throw("Embeddings proxy base URL or model is not configured")
    # Create a safe job ID by replacing spaces and special characters
    safe_lesson_id = resolved_lesson.replace(" ", "-").replace("/", "-").replace("\\", "-")
    frappe.logger().info(f"🚀 About to enqueue job with safe_lesson_id: {safe_lesson_id}")
    
    # DEBUG: Test if the import path is valid
    try:
        from lms.lms.ai_rag import ensure_embeddings_for_lesson
        frappe.logger().info(f"✅ Import successful: {ensure_embeddings_for_lesson}")
    except Exception as e:
        frappe.logger().error(f"❌ Import failed: {e}")
        frappe.throw(f"Function import failed: {e}")
    
    job = frappe.enqueue(
        "lms.lms.ai_rag.ensure_embeddings_for_lesson",
        queue="default",
        job_id=f"rag-embed-lesson-{safe_lesson_id}",
        lesson=resolved_lesson,
        base_url=base,
        api_key=key,
        model=model,
        custom_headers_json=custom_headers,
    )
    
    frappe.logger().info(f"📤 Job enqueued: job_id={job.get_id() if hasattr(job, 'get_id') else 'unknown'}, job_type={type(job)}")
    return {"job_id": job.get_id() if hasattr(job, "get_id") else None}


@frappe.whitelist()
def enqueue_rag_embeddings_course(course):
    """Enqueue embeddings computation for all lessons under a course."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    settings = frappe.get_single("LMS Settings")
    course_cfg = frappe.db.get_value(
        "AI Assistant Config",
        {"course": course},
        [
            "enable_overrides",
            "proxy_base_url",
            "proxy_api_key",
            "enable_rag",
            "default_model",
        ],
        as_dict=True,
    )
    from lms.lms.ai_utils import determine_effective_assistant_config

    eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
    if not eff.get("enable_rag"):
        frappe.throw("Embeddings retrieval is disabled in settings")
    # Use dedicated embedding provider settings, fallback to chat provider
    base = eff.get("embedding_base_url") or eff.get("chat_base_url") or ""
    key = eff.get("embedding_api_key") or eff.get("chat_api_key") or ""
    custom_headers = eff.get("embedding_custom_headers") or eff.get("chat_custom_headers") or ""
    model = eff.get("embedding_model")
    if not base or not model:
        if settings.get("assistant_mode") == "Demo Mode":
            frappe.throw("This feature requires External AI Service configuration. Currently in Demo Mode - go to LMS Settings > AI Assistant to configure External AI Service.")
        else:
            frappe.throw("Embeddings proxy base URL or model is not configured")
    # Enqueue a job per lesson
    chapters = frappe.get_all("Chapter Reference", filters={"parent": course}, pluck="chapter")
    job_ids = []
    for ch in chapters:
        lessons = frappe.get_all("Lesson Reference", filters={"parent": ch}, pluck="lesson")
        for lesson in lessons:
            # Create a safe job ID by replacing spaces and special characters
            safe_lesson_id = lesson.replace(" ", "-").replace("/", "-").replace("\\", "-")
            job = frappe.enqueue(
                "lms.lms.ai_rag.ensure_embeddings_for_lesson",
                queue="default",
                job_id=f"rag-embed-lesson-{safe_lesson_id}",
                lesson=lesson,
                base_url=base,
                api_key=key,
                model=model,
                custom_headers_json=custom_headers,
            )
            job_ids.append(job.get_id() if hasattr(job, "get_id") else None)
    return {"job_ids": job_ids}


@frappe.whitelist()
def enqueue_rag_rebuild_lesson(lesson):
    """Enqueue a rebuild of the lesson's RAG index and (optionally) embeddings in one job."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    course = frappe.db.get_value("Course Lesson", lesson, "course")
    settings = frappe.get_single("LMS Settings")
    course_cfg = frappe.db.get_value(
        "AI Assistant Config",
        {"course": course},
        [
            "enable_overrides",
            "proxy_base_url",
            "proxy_api_key",
            "enable_rag",
            "default_model",
        ],
        as_dict=True,
    )
    from lms.lms.ai_utils import determine_effective_assistant_config
    eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
    use_embeddings = bool(eff.get("enable_rag"))
    # Use dedicated embedding provider settings, fallback to chat provider
    base = eff.get("embedding_base_url") or eff.get("chat_base_url") or ""
    key = eff.get("embedding_api_key") or eff.get("chat_api_key") or ""
    custom_headers = eff.get("embedding_custom_headers") or eff.get("chat_custom_headers") or ""
    model = eff.get("embedding_model")
    # Import the correct embedding function
    from lms.lms.ai_rag import ensure_embeddings_for_lesson
    
    safe_lesson_id = lesson.replace(" ", "-").replace("/", "-").replace("\\", "-")
    job = frappe.enqueue(
        ensure_embeddings_for_lesson,
        queue="default",
        job_id=f"rag-embed-lesson-{safe_lesson_id}",
        lesson=lesson,
        base_url=base,
        api_key=key,
        model=model,
        custom_headers_json=custom_headers,
    )
    return {"job_id": job.get_id() if hasattr(job, "get_id") else None}


@frappe.whitelist()
def enqueue_rag_rebuild_course(course):
    """Enqueue a rebuild of the course RAG index and (optionally) embeddings in one job."""
    frappe.only_for(["Moderator", "Course Creator", "System Manager"])
    settings = frappe.get_single("LMS Settings")
    course_cfg = frappe.db.get_value(
        "AI Assistant Config",
        {"course": course},
        [
            "enable_overrides",
            "proxy_base_url",
            "proxy_api_key",
            "enable_rag",
            "default_model",
        ],
        as_dict=True,
    )
    from lms.lms.ai_utils import determine_effective_assistant_config
    eff = determine_effective_assistant_config(settings.as_dict(), course_cfg)
    use_embeddings = bool(eff.get("enable_rag"))
    # Use dedicated embedding provider settings, fallback to chat provider
    base = eff.get("embedding_base_url") or eff.get("chat_base_url") or ""
    key = eff.get("embedding_api_key") or eff.get("chat_api_key") or ""
    custom_headers = eff.get("embedding_custom_headers") or eff.get("chat_custom_headers") or ""
    model = eff.get("embedding_model")
    job = frappe.enqueue(
        rebuild_course_index_and_embeddings,
        queue="default",
        job_name=f"rag-rebuild-course-{course}",
        course=course,
        use_embeddings=use_embeddings,
        base_url=base,
        api_key=key,
        model=model,
        custom_headers_json=custom_headers,
    )
    return {"job_id": job.get_id() if hasattr(job, "get_id") else None}


def resolve_lesson_slug(course: str, lesson_slug: str) -> str | None:
    """Resolve lesson slug like '1-1' to actual lesson name.
    
    Args:
        course: Course name
        lesson_slug: Format like '1-1' (chapter-lesson index)
        
    Returns:
        Actual lesson name or None if not found
    """
    try:
        if '-' not in lesson_slug:
            return lesson_slug  # Already a lesson name
            
        chapter_idx, lesson_idx = lesson_slug.split('-', 1)
        chapter_idx = int(chapter_idx)
        lesson_idx = int(lesson_idx)
        
        # Find chapter by index
        chapter_name = frappe.db.get_value(
            "Chapter Reference", 
            {"parent": course, "idx": chapter_idx}, 
            "chapter"
        )
        if not chapter_name:
            return None
            
        # Find lesson by index within chapter
        lesson_name = frappe.db.get_value(
            "Lesson Reference",
            {"parent": chapter_name, "idx": lesson_idx},
            "lesson"
        )
        return lesson_name
        
    except (ValueError, TypeError):
        return lesson_slug  # Return as-is if not a valid slug format
