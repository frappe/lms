import frappe

SAMPLE_COURSE_TITLE = "A guide to Frappe Learning"
# Seeded with the sample course and removed by api.clear_demo_data.
DEMO_QUIZ_TITLE = "Do you know Frappe Learning?"
# Data Import statuses for an import that wrote rows.
IMPORT_DONE = ["Success", "Partial Success"]
# The domain of frappe's fallback sender and of placeholder accounts.
PLACEHOLDER_EMAIL_DOMAIN = "example.com"


@frappe.whitelist()
def get_onboarding_facts() -> dict[str, str | bool | None]:
	"""What the site already has, so the onboarding flows can tick steps done before they shipped."""
	frappe.only_for("System Manager")

	first_course = _first("LMS Course", {"title": ["!=", SAMPLE_COURSE_TITLE]})
	first_batch = _first("LMS Batch", {})

	return {
		"first_course": first_course,
		"first_batch": first_batch,
		"has_course": bool(first_course),
		"has_chapter": _exists_for(first_course, "Course Chapter", {"course": first_course}),
		"has_lesson": _exists_for(first_course, "Course Lesson", {"course": first_course}),
		"has_quiz": bool(_first("LMS Quiz", {"title": ["!=", DEMO_QUIZ_TITLE]})),
		"has_course_pricing": _exists_for(
			first_course,
			"LMS Course",
			{"name": first_course, "paid_course": 1, "course_price": [">", 0]},
		),
		"has_published_course": _exists_for(
			first_course, "LMS Course", {"name": first_course, "published": 1}
		),
		"has_imported_learners": bool(
			_first("Data Import", {"reference_doctype": "User", "status": ["in", IMPORT_DONE]})
		),
		"has_email_account": _has_email_account(),
		"has_batch": bool(first_batch),
		"has_batch_details": _exists_for(
			first_batch, "LMS Batch", {"name": first_batch, "meta_image": ["is", "set"]}
		),
		"has_zoom_account": bool(_first("LMS Zoom Settings", {})),
		"has_google_api": _has_google_api(),
		"has_google_calendar": bool(
			frappe.db.exists("Google Calendar", {"user": frappe.session.user, "refresh_token": ["is", "set"]})
		),
		"has_meet_account": bool(_first("LMS Google Meet Settings", {})),
		"has_live_class": _exists_for(first_batch, "LMS Live Class", {"batch_name": first_batch}),
		"has_published_batch": _exists_for(first_batch, "LMS Batch", {"name": first_batch, "published": 1}),
	}


def _first(doctype: str, filters: dict) -> str | None:
	rows = frappe.get_all(doctype, filters=filters, pluck="name", order_by="creation asc", limit=1)
	return rows[0] if rows else None


def _exists_for(target: str | None, doctype: str, filters: dict) -> bool:
	return bool(target and frappe.db.exists(doctype, filters))


def _has_google_api() -> bool:
	"""Enabled, with a Client ID and a stored Client Secret (the column holds a mask once set)."""
	settings = frappe.db.get_singles_dict("Google Settings", cast=True)
	return bool(settings.get("enable") and settings.get("client_id") and settings.get("client_secret"))


def _has_email_account() -> bool:
	"""An Email Account that sends. frappe falls back to notifications@example.com
	when none is set up, so a row carrying a placeholder address does not count."""
	return bool(
		_first(
			"Email Account",
			{"enable_outgoing": 1, "email_id": ["not like", f"%@{PLACEHOLDER_EMAIL_DOMAIN}"]},
		)
	)
