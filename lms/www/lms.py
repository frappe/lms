import frappe
from frappe.utils.telemetry import capture
from frappe import _

no_cache = 1


def get_context():
	app_path = frappe.form_dict.get("app_path")
	print(app_path)
	context = frappe._dict()
	context.meta = get_meta(app_path)
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
	if app_path == "job-openings":
		return {
			"title": _("Job Openings"),
			"image": frappe.db.get_single_value("Website Settings", "banner_image"),
			"description": "This page lists all the job openings published on our website",
			"keywords": "Job Openings, Jobs, Vacancies",
		}
