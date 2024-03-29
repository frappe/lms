import frappe
from frappe.utils.telemetry import capture
from frappe import _
import re

no_cache = 1


def get_context():
	app_path = frappe.form_dict.get("app_path")
	context = frappe._dict()
	if app_path:
		context.meta = get_meta(app_path)
	else:
		context.meta = {}
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()
	context.csrf_token = csrf_token
	if frappe.session.user != "Guest":
		capture("active_site", "lms")
	return context


def get_meta(app_path):
	if app_path == "courses":
		return {
			"title": _("Course List"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the courses published on our website",
			"keywords": "All Courses, Courses, Learn",
		}

	if re.match(r"^courses/.*$", app_path):
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
		}

	if app_path == "batches":
		return {
			"title": _("Batches"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the batches published on our website",
			"keywords": "All Batches, Batches, Learn",
		}

	if re.match(r"^batches/.*$", app_path):
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
		}

	if app_path == "job-openings":
		return {
			"title": _("Job Openings"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the job openings published on our website",
			"keywords": "Job Openings, Jobs, Vacancies",
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
			"title": job_opening.title,
			"image": job_opening.company_logo,
			"description": job_opening.company_name,
		}

	if app_path == "statistics":
		return {
			"title": _("Statistics"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the statistics of this platform",
			"keywords": "Enrollment Count, Completion, Signups",
		}
