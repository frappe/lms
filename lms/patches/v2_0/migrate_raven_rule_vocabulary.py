import json

import frappe

from lms.raven_provider import _as_list

# The Student rule types this replaced, mapped to the `enrolled_in` choice that
# now says the same thing and to the scope field the old rule read. Each pair
# evaluates through the identical helper, so the rewrite names the same people the
# old rule named.
LEGACY_STUDENT_TYPES = {
	"All Enrolled Students": ("Any", None),
	"Students of Courses": ("Courses", "courses"),
	"Students of Batches": ("Batches", "batches"),
}


def execute():
	"""Rewrite stored Raven conditions that still name the vocabulary before Student/Staff.

	LMS v2.61-v2.62 offered "All Enrolled Students", "Students of Courses",
	"Students of Batches" and a Staff rule keyed on `staff_role`. The provider now
	declares Student and Staff only, and raises ProviderDataError for anything else
	- so a channel mapping still holding one is rolled back, logged and skipped on
	every sweep, and stays that way until an admin re-creates the condition.

	Only the conversions that name exactly the same people are made. `staff_role`
	of "Evaluator", "Mentor" or "Any" has no equal in the new vocabulary, and
	membership sync is authoritative, so guessing at one would evict real people
	from a channel with nothing said. A "Students of Courses" or "Students of
	Batches" whose scope is unreadable or empty is left alone for the same reason:
	it would convert into a condition that evaluates to nobody, which sync applies
	by emptying the channel. Those keep raising, which leaves the channel as it is
	and tells the admin what to re-create.

	Bounded by the mappings a site has - a handful of channels, hand-made in
	Settings > Raven - and idempotent, so a re-run rewrites nothing.
	"""
	# The doctype belongs to raven_integration, an optional out-of-tree app. Every
	# site without it has nothing to migrate.
	if not frappe.db.table_exists("Raven Channel Mapping"):
		return

	for name, stored in frappe.db.get_all(
		"Raven Channel Mapping", fields=["name", "member_rules_json"], as_list=True
	):
		tree = _parse(stored)
		if tree is None or not migrate_tree(tree):
			continue
		# db.set_value, not doc.save: saving revalidates every condition, and a
		# mapping that also holds one of the conditions left unconverted would throw
		# and take this mapping's fix with it.
		frappe.db.set_value(
			"Raven Channel Mapping",
			name,
			"member_rules_json",
			json.dumps(tree),
			update_modified=False,
		)


def migrate_tree(node) -> bool:
	"""Convert every convertible LMS condition below `node`, in place. True if any changed."""
	if _is_group(node):
		changed = False
		for child in node.get("conditions") or []:
			# Not `any(...)`: it stops at the first true and would leave the
			# conditions after a converted sibling behind.
			if migrate_tree(child):
				changed = True
		return changed
	return isinstance(node, dict) and _migrate_leaf(node)


def _is_group(node) -> bool:
	"""Same structural test raven_integration's engine applies: a group carries both lists."""
	return isinstance(node, dict) and "conditions" in node and "conjunctions" in node


def _migrate_leaf(leaf: dict) -> bool:
	if leaf.get("provider") != "LMS":
		return False

	config = _parse_config(leaf.get("config"))
	if config is None:
		# A config that cannot be read would convert into a condition scoped to
		# nothing, and a scoped condition naming nothing matches nobody - which sync
		# applies by emptying the channel. Leave it unevaluable instead.
		return False

	student = LEGACY_STUDENT_TYPES.get(leaf.get("rule_type"))
	if student:
		enrolled_in, scope_field = student
		if scope_field and not _as_list(config.get(scope_field)):
			# Same answer as an unreadable config, for the same reason. A scoped
			# condition naming nothing evaluates to nobody, and membership sync is
			# authoritative, so converting one would hand the next sweep an empty
			# expected set and it would clear the channel. Unconverted it keeps
			# raising, which is what leaves the members where they are.
			return False
		leaf["rule_type"] = "Student"
		leaf["config"] = {**config, "student_scope": "Enrolled", "enrolled_in": enrolled_in}
		return True

	if leaf.get("rule_type") == "Staff" and config.get("staff_role") == "Instructor":
		kept = {key: value for key, value in config.items() if key != "staff_role"}
		leaf["config"] = {
			**kept,
			"staff_kind": "Assigned on",
			"assigned_as": "Instructor",
			"assigned_scope": _assigned_scope(kept),
		}
		return True

	return False


def _assigned_scope(config: dict) -> str:
	"""Which scope the stored multiselects add up to.

	Read from what is stored rather than from the rule's own wording, because the
	old rule read "no scope at all" as every instructor on the site. An emptied
	scope must come out as the scope it was, not as Any, which would widen the
	condition instead of narrowing it.
	"""
	courses = bool(_as_list(config.get("staff_scope_courses")))
	batches = bool(_as_list(config.get("staff_scope_batches")))
	if courses and batches:
		return "Both"
	if courses:
		return "Courses"
	if batches:
		return "Batches"
	return "Any"


def _parse_config(config) -> "dict | None":
	"""A leaf's config as a dict, or None when it cannot be read."""
	if config is None:
		return {}
	if isinstance(config, str):
		if not config.strip():
			return {}
		try:
			config = json.loads(config)
		except (ValueError, TypeError):
			return None
	return config if isinstance(config, dict) else None


def _parse(stored) -> "dict | None":
	if isinstance(stored, str):
		try:
			stored = json.loads(stored) if stored.strip() else None
		except (ValueError, TypeError):
			return None
	return stored if _is_group(stored) else None
