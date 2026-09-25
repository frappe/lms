"""Outbound calls from the site to the AI Gateway."""

import frappe
from frappe.utils import get_url
from frappe.utils.password import get_decrypted_password

REVIEW_JOB_PATH = "/ai/copilot/jobs/review"
COURSE_IMPORT_JOB_PATH = "/ai/copilot/jobs/course-import"
TIMEOUT_SECONDS = 10


def settings():
	return frappe.get_cached_doc("Copilot Settings")


def gateway_configured():
	return bool(settings().gateway_url)


def enqueue_review(project_submission, rewrite_of=None):
	"""Ask the Gateway to review a submission once this request commits."""
	if not gateway_configured():
		return False
	frappe.enqueue(
		"lms.copilot.gateway.request_review",
		queue="short",
		enqueue_after_commit=True,
		project_submission=project_submission,
		rewrite_of=rewrite_of,
	)
	return True


def _post(path, payload):
	import requests

	config = settings()
	api_key = get_decrypted_password(
		"Copilot Settings", "Copilot Settings", "gateway_api_key", raise_exception=False
	)
	response = requests.post(
		config.gateway_url.rstrip("/") + path,
		json=payload,
		headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
		timeout=TIMEOUT_SECONDS,
	)
	response.raise_for_status()
	return response


def enqueue_course_import(course_import):
	"""Ask the Gateway to draft a course from an import once this request commits."""
	if not gateway_configured():
		return False
	frappe.enqueue(
		"lms.copilot.gateway.request_course_draft",
		queue="short",
		enqueue_after_commit=True,
		course_import=course_import,
	)
	return True


def request_course_draft(course_import):
	config = settings()
	if not config.gateway_url:
		return
	try:
		_post(
			COURSE_IMPORT_JOB_PATH,
			{"site": get_url(), "course_import": course_import, "model": config.default_model or ""},
		)
	except Exception as error:
		frappe.db.set_value(
			"Copilot Course Import",
			course_import,
			{"status": "Failed", "error": f"Could not reach the AI Gateway: {str(error)[:300]}"},
		)
		frappe.log_error(title="Copilot course import request failed")


def request_review(project_submission, rewrite_of=None):
	import requests

	config = settings()
	if not config.gateway_url:
		return
	api_key = get_decrypted_password(
		"Copilot Settings", "Copilot Settings", "gateway_api_key", raise_exception=False
	)
	payload = {
		"site": get_url(),
		"project_submission": project_submission,
		"rewrite_of": rewrite_of,
		"model": config.review_model or config.default_model,
	}
	try:
		response = requests.post(
			config.gateway_url.rstrip("/") + REVIEW_JOB_PATH,
			json=payload,
			headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
			timeout=TIMEOUT_SECONDS,
		)
		response.raise_for_status()
		status = frappe.db.get_value("Copilot Project Submission", project_submission, "status")
		if status in ("Submitted", "Rewrite Requested"):
			frappe.db.set_value("Copilot Project Submission", project_submission, "status", "Testing")
	except Exception as error:
		frappe.db.set_value(
			"Copilot Project Submission",
			project_submission,
			"error",
			f"Could not reach the AI Gateway: {str(error)[:300]}",
		)
		frappe.log_error(title="Copilot review request failed")
