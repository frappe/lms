import frappe
import re
from bs4 import BeautifulSoup
from frappe import _
from frappe.utils.telemetry import capture
from frappe.utils import cint

no_cache = 1


def get_context():
	app_path = frappe.form_dict.get("app_path")
	context = frappe._dict()
	if app_path:
		context.meta = get_meta(app_path)
	else:
		context.meta = {}
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()  # nosemgrep
	context.csrf_token = csrf_token
	context.setup_complete = cint(frappe.get_system_settings("setup_complete"))
	capture("active_site", "lms")
	context.favicon = frappe.db.get_single_value("Website Settings", "favicon")
	return context


def get_meta(app_path):
	if app_path == "courses":
		return {
			"title": _("Course List"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the courses published on our website",
			"keywords": "All Courses, Courses, Learn",
			"link": "/courses",
		}

	if re.match(r"^courses/.*$", app_path):
		if "new/edit" in app_path:
			return {
				"title": _("New Course"),
				"image": frappe.db.get_single_value("Website Settings", "banner_image"),
				"description": "Create a new course",
				"keywords": "New Course, Create Course",
				"link": "/lms/courses/new/edit",
			}
		course_name = app_path.split("/")[1]
		course = frappe.db.get_value(
			"LMS Course",
			course_name,
			["title", "image", "short_introduction", "tags"],
			as_dict=True,
		)
		return {
			"title": course.title,
			"image": course.image,
			"description": course.short_introduction,
			"keywords": course.tags,
			"link": f"/courses/{course_name}",
		}

	if app_path == "batches":
		return {
			"title": _("Batches"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the batches published on our website",
			"keywords": "All Batches, Batches, Learn",
			"link": "/batches",
		}
	if re.match(r"^batches/details/.*$", app_path):
		batch_name = app_path.split("/")[2]
		batch = frappe.db.get_value(
			"LMS Batch",
			batch_name,
			["title", "meta_image", "description", "category", "medium"],
			as_dict=True,
		)
		return {
			"title": batch.title,
			"image": batch.meta_image,
			"description": batch.description,
			"keywords": f"{batch.category} {batch.medium}",
			"link": f"/batches/details/{batch_name}",
		}

	if re.match(r"^batches/.*$", app_path):
		batch_name = app_path.split("/")[1]
		if "new/edit" in app_path:
			return {
				"title": _("New Batch"),
				"image": frappe.db.get_single_value("Website Settings", "banner_image"),
				"description": "Create a new batch",
				"keywords": "New Batch, Create Batch",
				"link": "/lms/batches/new/edit",
			}
		batch = frappe.db.get_value(
			"LMS Batch",
			batch_name,
			["title", "meta_image", "description", "category", "medium"],
			as_dict=True,
		)
		return {
			"title": batch.title,
			"image": batch.meta_image,
			"description": batch.description,
			"keywords": f"{batch.category} {batch.medium}",
			"link": f"/batches/{batch_name}",
		}

	if app_path == "job-openings":
		return {
			"title": _("Job Openings"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the job openings published on our website",
			"keywords": "Job Openings, Jobs, Vacancies",
			"link": "/job-openings",
		}

	if re.match(r"^job-openings/.*$", app_path):
		job_opening_name = app_path.split("/")[1]
		job_opening = frappe.db.get_value(
			"Job Opportunity",
			job_opening_name,
			["job_title", "company_logo", "company_name"],
			as_dict=True,
		)
		return {
			"title": job_opening.job_title,
			"image": job_opening.company_logo,
			"description": job_opening.company_name,
			"keywords": "Job Openings, Jobs, Vacancies",
			"link": f"/job-openings/{job_opening_name}",
		}

	if app_path == "statistics":
		return {
			"title": _("Statistics"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the statistics of this platform",
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
