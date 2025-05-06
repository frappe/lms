import frappe
import re
from bs4 import BeautifulSoup
from frappe import _
from frappe.utils.telemetry import capture

no_cache = 1


def get_context():
	context = frappe._dict()
	context.boot = get_boot()
	frappe.db.commit()

	app_path = frappe.form_dict.get("app_path")
	favicon = (
		frappe.db.get_single_value("Website Settings", "favicon")
		or "/assets/lms/frontend/favicon.png"
	)
	title = frappe.db.get_single_value("Website Settings", "app_name") or "Frappe Learning"

	context.meta = get_meta(app_path, title, favicon)
	context.title = title
	context.favicon = favicon

	capture("active_site", "lms")
	return context


def get_boot():
	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"read_only_mode": frappe.flags.read_only,
			"csrf_token": frappe.sessions.get_csrf_token(),
		}
	)


def get_meta(app_path, title, favicon):
	meta = frappe._dict()
	if app_path:
		meta = get_meta_from_document(app_path)

	route_meta = frappe.get_all("Website Meta Tag", {"parent": app_path}, ["key", "value"])
	description = frappe.db.get_single_value("LMS Settings", "meta_description")
	image = frappe.db.get_single_value("LMS Settings", "meta_image")
	keywords = frappe.db.get_single_value("LMS Settings", "meta_keywords")

	if len(route_meta) > 0:
		for row in route_meta:
			if row.key == "title":
				meta["title"] = row.value
			elif row.key == "image":
				meta["image"] = row.value
			elif row.key == "description":
				meta["description"] = f"{meta.get('description', '')} {row.value}"
			elif row.key == "keywords":
				meta["keywords"] = f"{meta.get('keywords', '')} {row.value}"
			elif row.key == "link":
				meta["link"] = row.value

	if not meta.get("title"):
		meta["title"] = title

	if not meta.get("description"):
		meta["description"] = description

	if not meta.get("image"):
		meta["image"] = image or favicon

	meta["keywords"] = f"{meta.get('keywords')}, {keywords}"

	if not meta:
		meta = {
			"title": title,
			"image": favicon,
			"description": description,
		}

	return meta


def get_meta_from_document(app_path):
	if app_path == "courses":
		return {
			"title": _("Course List"),
			"keywords": "All Courses, Courses, Learn",
			"link": "/courses",
		}

	if re.match(r"^courses/.*$", app_path):
		if "new/edit" in app_path:
			return {
				"title": _("New Course"),
				"image": frappe.db.get_single_value("Website Settings", "banner_image"),
				"keywords": "New Course, Create Course",
				"link": "/lms/courses/new/edit",
			}
		course_name = app_path.split("/")[1]
		course = frappe.db.get_value(
			"LMS Course",
			course_name,
			["title", "image", "description", "tags"],
			as_dict=True,
		)

		if course.description:
			soup = BeautifulSoup(course.description, "html.parser")
			course.description = soup.get_text()

		return {
			"title": course.title,
			"image": course.image,
			"description": course.description,
			"keywords": course.tags,
			"link": f"/courses/{course_name}",
		}

	if app_path == "batches":
		return {
			"title": _("Batches"),
			"keywords": "All Batches, Batches, Learn",
			"link": "/batches",
		}
	if re.match(r"^batches/details/.*$", app_path):
		batch_name = app_path.split("/")[2]
		batch = frappe.db.get_value(
			"LMS Batch",
			batch_name,
			["title", "meta_image", "batch_details", "category", "medium"],
			as_dict=True,
		)

		if batch.batch_details:
			soup = BeautifulSoup(batch.batch_details, "html.parser")
			batch.batch_details = soup.get_text()

		return {
			"title": batch.title,
			"image": batch.meta_image,
			"description": batch.batch_details,
			"keywords": f"{batch.category} {batch.medium}",
			"link": f"/batches/details/{batch_name}",
		}

	if re.match(r"^batches/.*$", app_path):
		batch_name = app_path.split("/")[1]
		if "new/edit" in app_path:
			return {
				"title": _("New Batch"),
				"keywords": "New Batch, Create Batch",
				"link": "/lms/batches/new/edit",
			}
		batch = frappe.db.get_value(
			"LMS Batch",
			batch_name,
			["title", "meta_image", "batch_details", "category", "medium"],
			as_dict=True,
		)

		if batch.batch_details:
			soup = BeautifulSoup(batch.batch_details, "html.parser")
			batch.batch_details = soup.get_text()

		return {
			"title": batch.title,
			"image": batch.meta_image,
			"description": batch.batch_details,
			"keywords": f"{batch.category} {batch.medium}",
			"link": f"/batches/{batch_name}",
		}

	if app_path == "job-openings":
		return {
			"title": _("Job Openings"),
			"keywords": "Job Openings, Jobs, Vacancies",
			"link": "/job-openings",
		}

	if re.match(r"^job-openings/.*$", app_path):
		job_opening_name = app_path.split("/")[1]
		job_opening = frappe.db.get_value(
			"Job Opportunity",
			job_opening_name,
			["job_title", "company_logo", "description"],
			as_dict=True,
		)

		if job_opening.description:
			soup = BeautifulSoup(job_opening.description, "html.parser")
			job_opening.description = soup.get_text()

		return {
			"title": job_opening.job_title,
			"image": job_opening.company_logo,
			"description": job_opening.description,
			"keywords": "Job Openings, Jobs, Vacancies",
			"link": f"/job-openings/{job_opening_name}",
		}

	if app_path == "statistics":
		return {
			"title": _("Statistics"),
			"keywords": "Enrollment Count, Completion, Signups",
			"link": "/statistics",
		}

	if re.match(r"^user/.*$", app_path):
		username = app_path.split("/")[1]
		user = frappe.db.get_value(
			"User",
			{
				"username": username,
			},
			["full_name", "user_image", "bio"],
			as_dict=True,
		)

		if user.bio:
			soup = BeautifulSoup(user.bio, "html.parser")
			user.bio = soup.get_text()

		return {
			"title": user.full_name,
			"image": user.user_image,
			"description": user.bio,
			"keywords": f"{user.full_name}, {user.bio}",
			"link": f"/user/{username}",
		}

	if re.match(r"^badges/.*/.*$", app_path):
		badgeName = app_path.split("/")[1]
		email = app_path.split("/")[2]
		badge = frappe.db.get_value(
			"LMS Badge",
			badgeName,
			["title", "image", "description"],
			as_dict=True,
		)
		return {
			"title": badge.title,
			"image": badge.image,
			"description": badge.description,
			"keywords": f"{badge.title}, {badge.description}",
			"link": f"/badges/{badgeName}/{email}",
		}

	if app_path == "quizzes":
		return {
			"title": _("Quizzes"),
			"keywords": "Quizzes, interactive quizzes, online quizzes",
			"link": "/quizzes",
		}

	if re.match(r"^quizzes/[^/]+$", app_path):
		quiz_name = app_path.split("/")[1]
		quiz = frappe.db.get_value(
			"LMS Quiz",
			quiz_name,
			["title"],
			as_dict=True,
		)
		if quiz:
			return {
				"title": quiz.title,
				"keywords": quiz.title,
				"link": f"/quizzes/{quiz_name}",
			}

	if app_path == "assignments":
		return {
			"title": _("Assignments"),
			"keywords": "Assignments, interactive assignments, online assignments",
			"link": "/assignments",
		}

	if re.match(r"^assignments/[^/]+$", app_path):
		assignment_name = app_path.split("/")[1]
		assignment = frappe.db.get_value(
			"LMS Assignment",
			assignment_name,
			["title"],
			as_dict=True,
		)
		if assignment:
			return {
				"title": assignment.title,
				"keywords": assignment.title,
				"link": f"/assignments/{assignment_name}",
			}

	if app_path == "programs":
		return {
			"title": _("Programs"),
			"keywords": "All Programs, Programs, Learn",
			"link": "/programs",
		}

	if app_path == "certified-participants":
		return {
			"title": _("Certified Participants"),
			"keywords": "All Certified Participants, Certified Participants, Learn, Certification",
			"link": "/certified-participants",
		}

	return {}
