"""API methods for the LMS.
"""

import frappe
from frappe.translate import get_all_translations
from frappe import _
from frappe.query_builder import DocType
from frappe.query_builder.functions import Count
from frappe.utils import time_diff, now_datetime, get_datetime


@frappe.whitelist()
def autosave_section(section, code):
	"""Saves the code edited in one of the sections."""
	doc = frappe.get_doc(
		doctype="Code Revision", section=section, code=code, author=frappe.session.user
	)
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
	if (
		not sg.is_manager(frappe.session.user) and "System Manager" not in frappe.get_roles()
	):
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
	if (
		not sg.is_manager(frappe.session.user) and "System Manager" not in frappe.get_roles()
	):
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
	if (
		not sg.is_manager(frappe.session.user) and "System Manager" not in frappe.get_roles()
	):
		return {"ok": False, "error": "Permission Deined"}

	r.status = "Pending"
	r.save()
	return {"ok": True}


@frappe.whitelist()
def add_mentor_to_subgroup(subgroup, email):
	try:
		sg = frappe.get_doc("Cohort Subgroup", subgroup)
	except frappe.DoesNotExistError:
		return {"ok": False, "error": f"Invalid subgroup: {subgroup}"}

	if (
		not sg.get_cohort().is_admin(frappe.session.user)
		and "System Manager" not in frappe.get_roles()
	):
		return {"ok": False, "error": "Permission Deined"}

	try:
		user = frappe.get_doc("User", email)
	except frappe.DoesNotExistError:
		return {"ok": False, "error": f"Invalid user: {email}"}

	sg.add_mentor(email)
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
	return user


@frappe.whitelist(allow_guest=True)
def get_translations():
	if frappe.session.user != "Guest":
		language = frappe.db.get_value("User", frappe.session.user, "language")
	else:
		language = frappe.db.get_single_value("System Settings", "language")
	return get_all_translations(language)


@frappe.whitelist()
def validate_billing_access(type, name):
	access = True
	message = ""
	doctype = "LMS Course" if type == "course" else "LMS Batch"

	if frappe.session.user == "Guest":
		access = False
		message = _("Please login to continue with payment.")

	if type not in ["course", "batch"]:
		access = False
		message = _("Module is incorrect.")

	if not frappe.db.exists(doctype, name):
		access = False
		message = _("Module Name is incorrect or does not exist.")

	if type == "course":
		membership = frappe.db.exists(
			"LMS Enrollment", {"member": frappe.session.user, "course": name}
		)
		if membership:
			access = False
			message = _("You are already enrolled for this course.")

	else:
		membership = frappe.db.exists(
			"Batch Student", {"student": frappe.session.user, "parent": name}
		)
		if membership:
			access = False
			message = _("You are already enrolled for this batch.")

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
			"type",
			"company_name",
			"company_logo",
			"name",
			"creation",
			"description",
			"owner",
		],
		as_dict=1,
	)


@frappe.whitelist(allow_guest=True)
def get_job_opportunities():
	jobs = frappe.get_all(
		"Job Opportunity",
		{"status": "Open", "disabled": False},
		["job_title", "location", "type", "company_name", "company_logo", "name", "creation"],
		order_by="creation desc",
	)
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
	details.users = frappe.db.count(
		"User", {"enabled": 1, "name": ["not in", ("Administrator", "Guest")]}
	)
	details.completions = frappe.db.count(
		"LMS Enrollment", {"progress": ["like", "%100%"]}
	)
	details.lesson_completions = frappe.db.count("LMS Course Progress")
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
	return {
		"brand_name": frappe.db.get_single_value("Website Settings", "app_name"),
		"brand_html": frappe.db.get_single_value("Website Settings", "brand_html"),
		"favicon": frappe.db.get_single_value("Website Settings", "favicon"),
	}


@frappe.whitelist()
def get_unsplash_photos(keyword=None):
	from lms.unsplash import get_list, get_by_keyword

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
		doc = frappe.get_doc("Course Evaluator", evaluator, as_dict=1)
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
def get_certified_participants():
	LMSCertificate = DocType("LMS Certificate")
	participants = (
		frappe.qb.from_(LMSCertificate)
		.select(LMSCertificate.member)
		.distinct()
		.where(LMSCertificate.published == 1)
		.orderby(LMSCertificate.creation, order=frappe.qb.desc)
		.run(as_dict=1)
	)

	participant_details = []
	for participant in participants:
		details = frappe.db.get_value(
			"User",
			participant.member,
			["name", "full_name", "username", "user_image"],
			as_dict=True,
		)
		course_names = frappe.get_all(
			"LMS Certificate", {"member": participant.member}, pluck="course"
		)
		courses = []
		for course in course_names:
			courses.append(frappe.db.get_value("LMS Course", course, "title"))
		details["courses"] = courses
		participant_details.append(details)
	return participant_details


@frappe.whitelist()
def get_assigned_badges(member):
	assigned_badges = frappe.get_all(
		"LMS Badge Assignment",
		{"member": member},
		["badge"],
		as_dict=1,
	)

	for badge in assigned_badges:
		badge.update(
			frappe.db.get_value("LMS Badge", badge.badge, ["name", "title", "image"])
		)
	return assigned_badges


@frappe.whitelist()
def get_certificates(member):
	"""Get certificates for a member."""
	return frappe.get_all(
		"LMS Certificate",
		filters={"member": member},
		fields=["name", "course", "course_title", "issue_date", "template"],
		order_by="creation desc",
	)


@frappe.whitelist()
def get_all_users():
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
		"certified_participants",
		"jobs",
		"statistics",
		"notifications",
	]
	for item in items:
		sidebar_items[item] = lms_settings.get(item)

	if len(lms_settings.sidebar_items):
		web_pages = frappe.get_all(
			"LMS Sidebar Item",
			{"parenttype": "LMS Settings", "parentfield": "sidebar_items"},
			["web_page", "route", "title as label", "icon"],
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
	frappe.db.delete("Lesson Reference", {"parent": chapter, "lesson": lesson})
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
	"""Get members for the given search term and start index.
	Args: start (int): Start index for the query.
	    search (str): Search term to filter the results.
	Returns: List of members.
	"""

	filters = {"enabled": 1, "name": ["not in", ["Administrator", "Guest"]]}

	if search:
		filters["full_name"] = ["like", f"%{search}%"]

	members = frappe.get_all(
		"User",
		filters=filters,
		fields=["name", "full_name", "user_image", "username", "last_active"],
		page_length=20,
		start=start,
	)

	for member in members:
		roles = frappe.get_roles(member.name)
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
