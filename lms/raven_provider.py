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


# The staff choices that are a Frappe role, mapped to the role that backs them.
# "Evaluator" is the wording the LMS uses on screen; the role behind it is
# `Batch Evaluator`, which is what LMS itself checks (see lms/command_palette.py).
#
# Not the same population as an *assigned* evaluator, which is whoever a course
# or a batch names in its own evaluator field. Measured on one bench: 15 role
# holders, 23 Course Evaluator records, 10 in both. Same word, two branches.
PLATFORM_ROLES = {
	"Course Creator": "Course Creator",
	"Evaluator": "Batch Evaluator",
	"Moderator": "Moderator",
}

# Appended to every user on signup (lms/lms/user.py), so "everyone holding it" is
# close to every user on the site rather than every user who did something.
STUDENT_ROLE = "LMS Student"

# `label` / `description` are the rule builder's on-screen wording: the UI renders
# these declarations, so anything a fieldname cannot spell has to live here.
RULE_TYPES = [
	{
		"type": "Student",
		"label": "Student",
		"fields": [
			{
				"fieldname": "student_scope",
				"fieldtype": "Select",
				"label": "Students",
				"options": ["All", "Enrolled"],
				"reqd": 1,
				# Enrolled, not All. All is every holder of the LMS Student role,
				# which lms/lms/user.py appends on signup. That is close to every
				# user on the site, and not a population to arrive at by leaving a
				# row alone.
				"default": "Enrolled",
			},
			{
				"fieldname": "payment_filter",
				"fieldtype": "Select",
				"label": "Payment",
				"options": ["Any", "Paid", "Free"],
				"default": "Any",
				"depends_on": {"field": "student_scope", "value_in": ["Enrolled"]},
			},
			{
				"fieldname": "enrolled_in",
				"fieldtype": "Select",
				"label": "Enrolled in",
				# "Any" is what used to be the "All Enrolled Students" rule type. It
				# is not the same set as student_scope=All: enrolled in something,
				# versus holding the role. The alternative was to let an empty
				# multiselect mean "all", which is how the scope fields used to read.
				# Rejected because membership sync is authoritative, so a multiselect
				# left empty by accident would silently add every enrolled student.
				"options": ["Any", "Batches", "Courses", "Both"],
				"default": "Any",
				"depends_on": {"field": "student_scope", "value_in": ["Enrolled"]},
			},
			{
				"fieldname": "batches",
				"fieldtype": "MultiSelect",
				"label": "Batches",
				"options": "LMS Batch",
				"reqd": 1,
				"depends_on": {"field": "enrolled_in", "value_in": ["Batches", "Both"]},
			},
			{
				"fieldname": "courses",
				"fieldtype": "MultiSelect",
				"label": "Courses",
				"options": "LMS Course",
				"reqd": 1,
				"depends_on": {"field": "enrolled_in", "value_in": ["Courses", "Both"]},
			},
		],
	},
	{
		"type": "Staff",
		"label": "Staff",
		"fields": [
			{
				"fieldname": "staff_kind",
				"fieldtype": "Select",
				"label": "Staff",
				"options": ["All", "Platform role", "Assigned on"],
				"reqd": 1,
				"default": "All",
			},
			{
				"fieldname": "platform_roles",
				"fieldtype": "MultiSelectStatic",
				"label": "Roles",
				"description": "A role granted across the site, not a tagging on one course or batch.",
				"options": list(PLATFORM_ROLES),
				"reqd": 1,
				"depends_on": {"field": "staff_kind", "value_in": ["Platform role"]},
			},
			{
				"fieldname": "assigned_as",
				"fieldtype": "Select",
				"label": "Assigned as",
				# The description carries the whole distinction from the Platform
				# role branch, which offers an "Evaluator" naming different people.
				"description": "Named in a course or batch's own instructor or evaluator field.",
				"options": ["Instructor", "Evaluator"],
				"reqd": 1,
				"depends_on": {"field": "staff_kind", "value_in": ["Assigned on"]},
			},
			{
				"fieldname": "assigned_scope",
				"fieldtype": "Select",
				"label": "On",
				"options": ["Any", "Batches", "Courses", "Both"],
				"default": "Any",
				"depends_on": {"field": "staff_kind", "value_in": ["Assigned on"]},
			},
			{
				"fieldname": "staff_scope_batches",
				"fieldtype": "MultiSelect",
				"label": "Batches",
				"options": "LMS Batch",
				"reqd": 1,
				"depends_on": {"field": "assigned_scope", "value_in": ["Batches", "Both"]},
			},
			{
				"fieldname": "staff_scope_courses",
				"fieldtype": "MultiSelect",
				"label": "Courses",
				"options": "LMS Course",
				"reqd": 1,
				"depends_on": {"field": "assigned_scope", "value_in": ["Courses", "Both"]},
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
	# The parents, not the child tables the Staff choices actually read. A child row
	# is written by the parent's update_child_table(), which calls d.db_update()
	# directly and never run_method, so doc_events, and with it raven_integration's
	# wildcard handler, does not fire for `Course Instructor` or `Has Role` at all.
	# The document that is saved is the course or batch being tagged, and the User
	# whose Has Role rows the three role choices read.
	"LMS Course",
	"LMS Batch",
	"User",
]


def get_provider() -> dict:
	return {
		"name": "LMS",
		"label": "Frappe Learning",
		"rule_types": RULE_TYPES,
		"evaluate": evaluate,
		"triggers": TRIGGERS,
	}


@frappe.whitelist()
def get_raven_setup() -> dict:
	"""Whether both apps are installed and the integration is on.

	LMS answers the install half itself: frappe raises AppNotInstalledError for a
	method of an app that is not installed, and frappe-ui rethrows that before any
	`onError` runs, so the screen whose job is to say "install it" cannot render.

	Gated on the same `raven_integration_manager_roles` hook that widens
	raven_integration's own gate, read from the hook rather than imported, so the
	two cannot drift and this still works with that app absent.
	"""
	frappe.only_for(["System Manager", *(frappe.get_hooks("raven_integration_manager_roles") or [])])
	apps = frappe.get_installed_apps()
	state = {
		"raven": "raven" in apps,
		"raven_integration": "raven_integration" in apps,
		"enabled": False,
	}
	if state["raven"] and state["raven_integration"]:
		from raven_integration.api import is_setup

		state.update(is_setup())
	return state


def _as_list(value: str | list | None) -> list[str]:
	"""Flatten a rule's course/batch field: a JSON string, a list of names, or a legacy list of dicts."""
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
	if rt == "Student":
		return _students(rule)
	if rt == "Staff":
		return _staff(rule)
	raise ProviderDataError(
		f"Unknown rule_type: {rt!r}. This provider declares Student and Staff. A rule "
		f"stored against an older vocabulary cannot be evaluated. Re-create it in "
		f"Settings > Raven."
	)


def _students(rule: dict) -> set[str]:
	"""Who a Student condition names: the LMS Student role, or an enrollment."""
	scope = rule.get("student_scope")
	if scope == "All":
		return _role_users(STUDENT_ROLE)
	if scope != "Enrolled":
		raise ProviderDataError(
			f"Unknown student_scope: {scope!r}. The Student condition names All or "
			f"Enrolled. Edit the condition in Settings > Raven to pick one of them."
		)

	where = rule.get("enrolled_in") or "Any"
	if where == "Any":
		return _all_enrolled(rule)
	if where not in ("Batches", "Courses", "Both"):
		raise ProviderDataError(
			f"Unknown enrolled_in: {where!r}. The Student condition names Any, Batches, "
			f"Courses or Both. Edit the condition in Settings > Raven to pick one of them."
		)

	mode = _payment_mode(rule)
	out: set[str] = set()
	if where in ("Batches", "Both"):
		out |= _enrolled_members("LMS Batch Enrollment", "batch", _as_list(rule.get("batches")), mode)
	if where in ("Courses", "Both"):
		out |= _enrolled_members("LMS Enrollment", "course", _as_list(rule.get("courses")), mode)
	return out


def _payment_mode(rule: dict) -> str:
	"""Return the rule's payment filter: 'Any', 'Paid', or 'Free' (default 'Any')."""
	pf = rule.get("payment_filter")
	return pf if pf in ("Any", "Paid", "Free") else "Any"


# Both supported enrollment doctypes share `member` + `payment` columns. LMS
# Payment is NOT submittable (no docstatus). Paid means payment_received = 1.
_ENROLLMENT_DOCTYPES = {"LMS Enrollment", "LMS Batch Enrollment"}
_SCOPE_COLUMNS = {"course", "batch"}


def _enrolled_members(
	doctype: str,
	scope_col: str | None = None,
	scope_vals: list[str] | None = None,
	mode: str = "Any",
) -> set[str]:
	"""Members enrolled via `doctype`, scoped to `scope_col IN scope_vals`, filtered by payment `mode`."""
	# Allowlisted rather than trusted: both are internal constants, and this function
	# has no join semantics for any other table or column.
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
	else:  # Free: a dangling payment link matches neither Paid nor Free.
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
	"""Every enrolled student, from course enrollments and batch enrollments."""
	# Both, not LMS Enrollment alone. Batch enrollment mirrors itself into one
	# LMS Enrollment per Batch Course row, which misses a batch with no courses,
	# courses added after the student enrolled, and the payment link (so a paid-batch
	# student reads as Free). Sync is authoritative, so each omission removes someone.
	mode = _payment_mode(rule)
	return _enrolled_members("LMS Enrollment", mode=mode) | _enrolled_members(
		"LMS Batch Enrollment", mode=mode
	)


# --- Staff schema notes ---
# Course Instructor  : child table used by both LMS Course and LMS Batch.
#                      parent=course/batch name, parenttype='LMS Course'|'LMS Batch'.
#                      user field: `instructor`.
# LMS Course.evaluator / Batch Course.evaluator : the other per-record tagging.
#                      Both link Course Evaluator. A batch has no evaluator of its
#                      own; its evaluators are the ones on its Batch Course rows.
# Has Role           : child table of User, one row per granted role. The other three
#                      choices read it; a role is site-wide, so they take no scope.


def _staff(rule: dict) -> set[str]:
	"""Who a Staff condition names: a site-wide role, or a tagging on a course or batch."""
	kind = rule.get("staff_kind")

	if kind == "All":
		return _role_users(*PLATFORM_ROLES.values())

	if kind == "Platform role":
		chosen = _as_list(rule.get("platform_roles"))
		unknown = [c for c in chosen if c not in PLATFORM_ROLES]
		if unknown:
			raise ProviderDataError(
				f"Unknown platform role(s): {', '.join(repr(u) for u in unknown)}. The "
				f"Staff condition names one or more of {', '.join(PLATFORM_ROLES)}. Edit "
				f"the condition in Settings > Raven."
			)
		return _role_users(*(PLATFORM_ROLES[c] for c in chosen))

	if kind == "Assigned on":
		return _assigned_staff(rule)

	# Raised, not returned empty: sync is authoritative, so "matches nobody" would
	# clear the channel. Old `staff_role` rules land here deliberately, because the
	# old "Evaluator" does not fail, it resolves to a different population.
	raise ProviderDataError(
		f"Unknown staff_kind: {kind!r}. The Staff condition names All, Platform role or "
		f"Assigned on. A rule stored against the older `staff_role` vocabulary cannot be "
		f"evaluated. Re-create it in Settings > Raven."
	)


def _assigned_staff(rule: dict) -> set[str]:
	"""Whoever the chosen courses and batches name, as instructor or as evaluator."""
	scope = rule.get("assigned_scope") or "Any"
	if scope not in ("Any", "Batches", "Courses", "Both"):
		raise ProviderDataError(
			f"Unknown assigned_scope: {scope!r}. The Staff condition names Any, Batches, "
			f"Courses or Both. Edit the condition in Settings > Raven."
		)
	# A scope of Any reads no multiselect: a rule edited down from Courses may
	# still carry one, and what the row shows is what it means.
	courses = _as_list(rule.get("staff_scope_courses")) if scope in ("Courses", "Both") else []
	batches = _as_list(rule.get("staff_scope_batches")) if scope in ("Batches", "Both") else []
	unscoped = scope == "Any"

	# A scope that was chosen but names nothing matches nobody. Falling through
	# would reach the unscoped query, which reads "no scope" as "everyone", so an
	# emptied scope would widen the rule instead of narrowing it. Not reachable
	# from the editor (the multiselects are `reqd`), but reachable from stored data.
	if not unscoped and not courses and not batches:
		return set()

	as_what = rule.get("assigned_as")
	if as_what == "Instructor":
		return _instructor_users(courses, batches)
	if as_what == "Evaluator":
		return _assigned_evaluator_users(courses, batches, unscoped=unscoped)
	raise ProviderDataError(
		f"Unknown assigned_as: {as_what!r}. The Staff condition names Instructor or "
		f"Evaluator. Edit the condition in Settings > Raven."
	)


def _assigned_evaluator_users(
	scope_courses: list[str], scope_batches: list[str], *, unscoped: bool
) -> set[str]:
	"""Evaluators named on a course, or on a batch's Batch Course rows."""
	# The record's evaluator field, not the `Batch Evaluator` role: that is the
	# Platform role branch, and the two populations only partly overlap.
	if unscoped:
		named = frappe.get_all(
			"LMS Course", filters={"evaluator": ["is", "set"]}, pluck="evaluator", distinct=True
		)
		named += frappe.get_all(
			"Batch Course", filters={"evaluator": ["is", "set"]}, pluck="evaluator", distinct=True
		)
		return _enabled_users(named)

	out: list[str] = []
	if scope_courses:
		out += frappe.get_all(
			"LMS Course",
			filters={"name": ["in", scope_courses], "evaluator": ["is", "set"]},
			pluck="evaluator",
			distinct=True,
		)
	if scope_batches:
		out += frappe.get_all(
			"Batch Course",
			filters={
				"parenttype": "LMS Batch",
				"parent": ["in", scope_batches],
				"evaluator": ["is", "set"],
			},
			pluck="evaluator",
			distinct=True,
		)
	return _enabled_users(out)


def _role_users(*roles: str) -> set[str]:
	"""Enabled users holding any of ``roles``.

	Joined rather than read and then narrowed: `LMS Student` is close to every user
	on the site, so a second query listing them all by name grows with the user base.
	"""
	has_role = frappe.qb.DocType("Has Role")
	user = frappe.qb.DocType("User")
	return set(
		frappe.qb.from_(has_role)
		.inner_join(user)
		.on(user.name == has_role.parent)
		.select(has_role.parent)
		.distinct()
		.where(has_role.role.isin(list(roles)) & (has_role.parenttype == "User") & (user.enabled == 1))
		.run(pluck=True)
	)


def _enabled_users(names: list) -> set[str]:
	"""Narrow user names to the ones still enabled."""
	# A Course Instructor row survives its user being disabled, and a disabled user
	# has no Raven User row to link a membership to, so naming one makes sync retry
	# and log the same failure on every pass.
	if not names:
		return set()
	return set(
		frappe.get_all(
			"User", filters={"name": ["in", list(names)], "enabled": 1}, pluck="name", distinct=True
		)
	)


def _instructor_users(scope_courses: list[str], scope_batches: list[str]) -> set[str]:
	"""Instructors named on the scoped courses and batches, or on any of them when unscoped."""
	if not scope_courses and not scope_batches:
		return _enabled_users(frappe.get_all("Course Instructor", pluck="instructor", distinct=True))

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
	return _enabled_users(result)
