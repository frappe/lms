"""Course-scoped Frappe permissions for Copilot records."""

import frappe


_SITE_WIDE_REVIEW_ROLES = {"System Manager", "Moderator", "Batch Evaluator"}


def _identity(user=None):
	user = user or frappe.session.user
	return user, set(frappe.get_roles(user))


def _is_site_wide_reviewer(user, roles):
	return user == "Administrator" or bool(roles & _SITE_WIDE_REVIEW_ROLES)


def _course_query(doctype, user=None):
	user, roles = _identity(user)
	if _is_site_wide_reviewer(user, roles) or "Course Creator" not in roles:
		return ""
	escaped_user = frappe.db.escape(user)
	return f"""`tab{doctype}`.course in (
		select parent from `tabCourse Instructor`
		where instructor = {escaped_user} and parenttype = 'LMS Course'
	)"""


def feedback_draft_query(user=None):
	return _course_query("Copilot Feedback Draft", user)


def project_submission_query(user=None):
	return _course_query("Copilot Project Submission", user)


def proposal_query(user=None):
	return _course_query("Copilot Proposal", user)


def weekly_insight_query(user=None):
	return _course_query("Copilot Weekly Insight", user)


def rubric_query(user=None):
	user, roles = _identity(user)
	if user == "Administrator" or roles & {"System Manager", "Moderator", "Batch Evaluator"}:
		return ""
	if "Course Creator" not in roles:
		return ""
	escaped_user = frappe.db.escape(user)
	return f"""`tabCopilot Rubric`.assignment in (
		select name from `tabLMS Assignment`
		where course in (
			select parent from `tabCourse Instructor`
			where instructor = {escaped_user} and parenttype = 'LMS Course'
		)
	)"""


def course_has_permission(doc, ptype="read", user=None):
	if doc is None:
		return None
	user, roles = _identity(user)
	if _is_site_wide_reviewer(user, roles) or "Course Creator" not in roles:
		return None
	if ptype not in ("read", "select", "print"):
		return False
	course = doc.get("course")
	if not course:
		return False
	return bool(
		frappe.db.exists(
			"Course Instructor",
			{"instructor": user, "parent": course, "parenttype": "LMS Course"},
		)
	)


def rubric_has_permission(doc, ptype="read", user=None):
	if doc is None:
		return None
	user, roles = _identity(user)
	if user == "Administrator" or roles & {"System Manager", "Moderator"}:
		return None
	if ptype in ("read", "select", "print") and "Batch Evaluator" in roles:
		return None
	if "Course Creator" not in roles:
		return None
	assignment = doc.get("assignment")
	course = frappe.db.get_value("LMS Assignment", assignment, "course") if assignment else None
	if not course:
		return False
	return bool(
		frappe.db.exists(
			"Course Instructor",
			{"instructor": user, "parent": course, "parenttype": "LMS Course"},
		)
	)
