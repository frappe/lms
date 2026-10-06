import frappe
from frappe.utils import cint, flt

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
	return {
		**_course_facts(),
		**_assessment_facts(),
		**_learner_facts(),
		**_batch_facts(),
		**_meeting_facts(),
	}


def _course_facts() -> dict[str, str | bool | None]:
	course = _first_row(
		"LMS Course",
		{"title": ["!=", SAMPLE_COURSE_TITLE]},
		["name", "paid_course", "course_price", "published"],
	)
	name = course.name if course else None
	return {
		"first_course": name,
		"first_chapter": _first_chapter(name),
		"has_course": bool(course),
		"has_chapter": _exists_for(name, "Course Chapter", {"course": name}),
		"has_lesson": _exists_for(name, "Course Lesson", {"course": name}),
		"has_quiz": bool(_first("LMS Quiz", {"title": ["!=", DEMO_QUIZ_TITLE]})),
		"has_course_pricing": bool(course and cint(course.paid_course) and flt(course.course_price) > 0),
		"has_published_course": bool(course and cint(course.published)),
	}


def _first_chapter(course: str | None) -> str | None:
	"""The course's first chapter in outline order."""
	if not course:
		return None
	return frappe.db.get_value(
		"Chapter Reference",
		{"parent": course, "parenttype": "LMS Course"},
		"chapter",
		order_by="idx asc",
	)


def _assessment_facts() -> dict[str, bool]:
	return {
		"has_programming_exercise": bool(_first("LMS Programming Exercise", {})),
		"has_assignment": bool(_first("LMS Assignment", {})),
		"has_assessment_in_lesson": _has_assessment_in_lesson(),
	}


def _has_assessment_in_lesson() -> bool:
	"""A student-visible assessment in a lesson outside the sample course, read from
	the placement index each lesson save derives from its content."""
	placement = frappe.qb.DocType("LMS Lesson Assessment")
	lesson = frappe.qb.DocType("Course Lesson")
	course = frappe.qb.DocType("LMS Course")
	rows = (
		frappe.qb.from_(placement)
		.join(lesson)
		.on(placement.parent == lesson.name)
		.join(course)
		.on(lesson.course == course.name)
		.select(placement.name)
		.where(placement.parenttype == "Course Lesson")
		.where(placement.instructor_only == 0)
		.where(course.title != SAMPLE_COURSE_TITLE)
		.limit(1)
		.run()
	)
	return bool(rows)


def _learner_facts() -> dict[str, bool]:
	return {
		"has_imported_learners": bool(
			_first("Data Import", {"reference_doctype": "User", "status": ["in", IMPORT_DONE]})
		),
		"has_email_account": _has_email_account(),
	}


def _batch_facts() -> dict[str, str | bool | None]:
	batch = _first_row("LMS Batch", {}, ["name", "meta_image", "published"])
	name = batch.name if batch else None
	return {
		"first_batch": name,
		"has_batch": bool(batch),
		"has_batch_details": bool(batch and batch.meta_image),
		"has_live_class": _exists_for(name, "LMS Live Class", {"batch_name": name}),
		"has_published_batch": bool(batch and cint(batch.published)),
	}


def _meeting_facts() -> dict[str, bool]:
	return {
		"has_zoom_account": bool(_first("LMS Zoom Settings", {})),
		"has_google_api": _has_google_api(),
		"has_google_calendar": bool(
			frappe.db.exists("Google Calendar", {"user": frappe.session.user, "refresh_token": ["is", "set"]})
		),
		"has_meet_account": bool(_first("LMS Google Meet Settings", {})),
	}


def _first_row(doctype: str, filters: dict, fields: list[str]) -> frappe._dict | None:
	rows = frappe.get_all(doctype, filters=filters, fields=fields, order_by="creation asc", limit=1)
	return rows[0] if rows else None


def _first(doctype: str, filters: dict) -> str | None:
	row = _first_row(doctype, filters, ["name"])
	return row.name if row else None


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
