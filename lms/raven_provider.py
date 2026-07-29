from __future__ import annotations

import json

import frappe

try:
	from raven_integration.exceptions import ProviderDataError
except ImportError:
	# raven_integration is an optional out-of-tree app (the UI ships a
	# RavenNotInstalledBanner for exactly this case). Importing lms must not depend
	# on it. When it *is* installed the real class wins, so `except ProviderDataError`
	# on the raven_integration side still catches what this module raises.
	class ProviderDataError(Exception):
		"""Raised when provider-side data needed for sync is missing or malformed."""


# `label` / `description` are the rule builder's on-screen wording: the UI renders
# these declarations, so anything a fieldname cannot spell has to live here.
RULE_TYPES = [
	{
		"type": "All Enrolled Students",
		"label": "All Enrolled Students",
		"fields": [
			{
				"fieldname": "payment_filter",
				"fieldtype": "Select",
				"label": "Payment",
				"options": ["Any", "Paid", "Free"],
				"default": "Any",
			},
		],
	},
	{
		"type": "Students of Courses",
		"label": "Students of Courses",
		"fields": [
			{
				"fieldname": "courses",
				"fieldtype": "MultiSelect",
				"label": "Courses",
				"options": "LMS Course",
				"reqd": 1,
			},
			{
				"fieldname": "payment_filter",
				"fieldtype": "Select",
				"label": "Payment",
				"options": ["Any", "Paid", "Free"],
				"default": "Any",
			},
		],
	},
	{
		"type": "Students of Batches",
		"label": "Students of Batches",
		"fields": [
			{
				"fieldname": "batches",
				"fieldtype": "MultiSelect",
				"label": "Batches",
				"options": "LMS Batch",
				"reqd": 1,
			},
			{
				"fieldname": "payment_filter",
				"fieldtype": "Select",
				"label": "Payment",
				"options": ["Any", "Paid", "Free"],
				"default": "Any",
			},
		],
	},
	{
		"type": "Staff",
		"label": "Staff",
		"fields": [
			{
				"fieldname": "staff_role",
				"fieldtype": "Select",
				"label": "Staff role",
				"options": ["Instructor", "Evaluator", "Mentor", "Any"],
				"reqd": 1,
				"default": "Any",
			},
			{
				"fieldname": "staff_scope_courses",
				"fieldtype": "MultiSelect",
				"label": "Scope: Courses",
				"description": "Leave empty for all",
				"options": "LMS Course",
			},
			{
				"fieldname": "staff_scope_batches",
				"fieldtype": "MultiSelect",
				"label": "Scope: Batches",
				"description": "Leave empty for all",
				"options": "LMS Batch",
			},
		],
	},
]


def evaluate(rule_type: str, config: dict) -> set[str]:
	"""Provider entrypoint: config carries the same keys the old LMS rule columns held."""
	return default_evaluator({"rule_type": rule_type, **(config or {})})


# Membership-relevant doctypes: raven_integration's wildcard doc_events handler
# debounces a resync whenever any of these is inserted/updated/trashed.
TRIGGERS = [
	"LMS Enrollment",
	"LMS Batch Enrollment",
	"LMS Payment",
	"Course Instructor",
	"Course Evaluator",
	"LMS Course Mentor Mapping",
]


def get_provider() -> dict:
	return {
		"name": "LMS",
		"label": "Frappe Learning",
		"rule_types": RULE_TYPES,
		"evaluate": evaluate,
		"triggers": TRIGGERS,
	}


def _as_list(value: str | list | None) -> list[str]:
	"""Coerce a rule's course/batch field into a flat list of names (JSON list, JSON string, or a legacy list of ``{"course"/"batch": name}`` dicts)."""
	if not value:
		return []
	if isinstance(value, str):
		try:
			value = json.loads(value)
		except (ValueError, TypeError):
			return [value]
	out: list[str] = []
	for item in value or []:
		if isinstance(item, str):
			out.append(item)
		elif isinstance(item, dict):
			out.append(item.get("course") or item.get("batch") or next(iter(item.values()), None))
	return [x for x in out if x]


def default_evaluator(rule: dict) -> set[str]:
	rt = rule.get("rule_type")
	if rt == "All Enrolled Students":
		return _all_enrolled(rule)
	if rt == "Students of Batches":
		return _students_of_batches(rule)
	if rt == "Students of Courses":
		return _students_of_courses(rule)
	if rt == "Staff":
		return _staff(rule)
	raise ProviderDataError(f"Unknown rule_type: {rt!r}")


def _payment_mode(rule: dict) -> str:
	"""Return the rule's payment filter: 'Any', 'Paid', or 'Free' (default 'Any')."""
	pf = rule.get("payment_filter")
	return pf if pf in ("Any", "Paid", "Free") else "Any"


# Both supported enrollment doctypes share `member` + `payment` columns. LMS
# Payment is NOT submittable (no docstatus) — paid means payment_received = 1.
_ENROLLMENT_DOCTYPES = {"LMS Enrollment", "LMS Batch Enrollment"}
_SCOPE_COLUMNS = {"course", "batch"}


def _enrolled_members(
	doctype: str,
	scope_col: str | None = None,
	scope_vals: list[str] | None = None,
	mode: str = "Any",
) -> set[str]:
	"""Members enrolled via `doctype`, optionally scoped to `scope_col IN scope_vals`.

	`mode` filters by payment: 'Any', 'Paid', or 'Free'. `doctype` and `scope_col`
	are internal constants; the allowlists reject a caller that passes a table or
	column this function has no join semantics for.
	"""
	if doctype not in _ENROLLMENT_DOCTYPES:
		raise ProviderDataError(f"Unsupported enrollment doctype: {doctype!r}")
	if scope_col is not None and scope_col not in _SCOPE_COLUMNS:
		raise ProviderDataError(f"Unsupported scope column: {scope_col!r}")
	if scope_col and not scope_vals:
		return set()

	if mode == "Any":
		filters = {scope_col: ["in", scope_vals]} if scope_col else {}
		return set(frappe.get_all(doctype, filters=filters, pluck="member", distinct=True))

	enrollment = frappe.qb.DocType(doctype)
	payment = frappe.qb.DocType("LMS Payment")

	if mode == "Paid":
		query = (
			frappe.qb.from_(enrollment)
			.inner_join(payment)
			.on((payment.name == enrollment.payment) & (payment.payment_received == 1))
			.select(enrollment.member)
			.distinct()
			.where(enrollment.payment.isnotnull() & (enrollment.payment != ""))
		)
	else:  # Free — a dangling payment link matches neither Paid nor Free.
		query = (
			frappe.qb.from_(enrollment)
			.left_join(payment)
			.on(payment.name == enrollment.payment)
			.select(enrollment.member)
			.distinct()
			.where(enrollment.payment.isnull() | (enrollment.payment == "") | (payment.payment_received != 1))
		)

	if scope_col:
		query = query.where(enrollment[scope_col].isin(scope_vals))

	return set(query.run(pluck=True))


def _all_enrolled(rule: dict) -> set[str]:
	"""Every enrolled student, from course enrollments *and* batch enrollments.

	LMS Batch Enrollment.validate_course_enrollment() mirrors a batch enrollment into
	one LMS Enrollment per Batch Course row, so most batch students are visible in
	LMS Enrollment alone — but not all:

	  * a batch with no Batch Course rows (live-class / seminar batches) mirrors nothing;
	  * courses added to a batch after a student enrolled are never backfilled;
	  * the mirrored LMS Enrollment carries no `payment`, so a paid-batch student reads
	    as Free and drops out of a Paid-filtered rule.

	Membership sync is authoritative, so an omission here *removes* the student from the
	channel. Union both doctypes.
	"""
	mode = _payment_mode(rule)
	return _enrolled_members("LMS Enrollment", mode=mode) | _enrolled_members(
		"LMS Batch Enrollment", mode=mode
	)


def _students_of_batches(rule: dict) -> set[str]:
	return _enrolled_members(
		"LMS Batch Enrollment", "batch", _as_list(rule.get("batches")), _payment_mode(rule)
	)


def _students_of_courses(rule: dict) -> set[str]:
	return _enrolled_members("LMS Enrollment", "course", _as_list(rule.get("courses")), _payment_mode(rule))


# --- Staff schema notes (verified 2026-05-23) ---
# Course Instructor  : child table used by both LMS Course and LMS Batch.
#                      parent=course/batch name, parenttype='LMS Course'|'LMS Batch'.
#                      user field: `instructor`.
# Course Evaluator   : standalone doctype (autoname: field:evaluator).
#                      NOT linked to a course — no course/batch scope is possible.
#                      user field: `evaluator`.
# LMS Course Mentor Mapping : has `course` (Link→LMS Course) and `mentor` (Link→User).
#                      Scope by course is direct; scope by batch resolves through the
#                      batch's Batch Course rows (there is no batch-level mentor).
# LMS Batch          : has `instructors` (Table MultiSelect → Course Instructor) but
#                      no evaluator field — no batch-level evaluator linkage to include.


def _staff(rule: dict) -> set[str]:
	role = rule.get("staff_role")
	scope_courses = _as_list(rule.get("staff_scope_courses"))
	scope_batches = _as_list(rule.get("staff_scope_batches"))

	users: set[str] = set()

	if role in ("Instructor", "Any"):
		users |= _instructor_users(scope_courses, scope_batches)

	if role in ("Evaluator", "Any"):
		# Course Evaluator is a standalone doctype with no course/batch linkage.
		# Scope filters are intentionally ignored for this role.
		users |= set(frappe.get_all("Course Evaluator", pluck="evaluator", distinct=True))

	if role in ("Mentor", "Any"):
		users |= _mentor_users(scope_courses, scope_batches)

	return users


def _mentor_users(scope_courses: list[str], scope_batches: list[str]) -> set[str]:
	"""Return mentor users from LMS Course Mentor Mapping, honouring both scopes.

	LMS Course Mentor Mapping only links a mentor to a *course*; there is no batch
	mentor. A batch scope therefore resolves through the batch's Batch Course rows to
	the courses it teaches, and the two scopes union.

	A scope that was set but resolves to no courses (empty batch, deleted batch) returns
	the empty set — it must never fall back to the unscoped "every mentor on the site"
	query, which is what an unfiltered frappe.get_all would do.
	"""
	if not scope_courses and not scope_batches:
		return set(frappe.get_all("LMS Course Mentor Mapping", pluck="mentor", distinct=True))

	courses = set(scope_courses)
	if scope_batches:
		courses |= set(
			frappe.get_all(
				"Batch Course",
				filters={"parenttype": "LMS Batch", "parent": ["in", scope_batches]},
				pluck="course",
				distinct=True,
			)
		)
	if not courses:
		return set()

	return set(
		frappe.get_all(
			"LMS Course Mentor Mapping",
			filters={"course": ["in", sorted(courses)]},
			pluck="mentor",
			distinct=True,
		)
	)


def _instructor_users(scope_courses: list[str], scope_batches: list[str]) -> set[str]:
	"""Return instructor users from Course Instructor rows, honouring course and/or batch scope (unscoped returns all instructors)."""
	if not scope_courses and not scope_batches:
		return set(frappe.get_all("Course Instructor", pluck="instructor", distinct=True))

	result: set[str] = set()
	if scope_courses:
		rows = frappe.get_all(
			"Course Instructor",
			filters={"parenttype": "LMS Course", "parent": ["in", scope_courses]},
			pluck="instructor",
			distinct=True,
		)
		result |= set(rows)
	if scope_batches:
		rows = frappe.get_all(
			"Course Instructor",
			filters={"parenttype": "LMS Batch", "parent": ["in", scope_batches]},
			pluck="instructor",
			distinct=True,
		)
		result |= set(rows)
	return result
