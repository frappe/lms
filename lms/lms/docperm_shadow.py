# Copyright (c) 2026, FOSS United and Contributors
# For license information, please see license.txt

"""Report the LMS permlevel permissions a site's Custom DocPerm rows have made inert.

`frappe.model.meta.Meta.set_custom_permissions` replaces a doctype's permissions with its
Custom DocPerm rows whenever any exist, so a single row written by Role Permissions Manager
discards every permission row LMS ships for that doctype -- including the permlevel > 0 rows
that keep a field out of reach. The shipped rows stay in `tabDocPerm` and simply stop
applying, so nothing raises and nothing is logged. This has to be looked for.
"""

import click
import frappe
from frappe.modules.utils import get_module_list
from frappe.permissions import rights

ALERT_TITLE = "Custom DocPerm rows are shadowing the permlevel permissions LMS ships"

# Doctypes LMS shadows on purpose, on every site: install.py (User, Event),
# lms/patches/v1_0/custom_perm_for_discussions.py and api.py::give_discussions_permission
# (Discussion Topic, Discussion Reply). The list is the one
# lms/patches/v2_0/restore_system_manager_perms.py already carries the standard rows across
# for. They are frappe's doctypes, so the module scope below excludes them too; this is here
# so widening that scope cannot quietly turn LMS's own shadow into an alert.
LMS_MANAGED_CUSTOM_DOCPERM_DOCTYPES = ("User", "Event", "Discussion Topic", "Discussion Reply")


def get_shadowed_permlevel_rows() -> dict[str, list[tuple[str, int]]]:
	"""Return shipped (role, permlevel) grants missing from or narrowed by a custom set."""
	candidates = _get_lms_doctypes()
	if not candidates:
		return {}

	custom_rows = frappe.get_all(
		"Custom DocPerm",
		filters={"parent": ("in", candidates)},
		fields=["parent", "role", "permlevel", "if_owner", *rights],
		limit_page_length=0,
	)
	if not custom_rows:
		return {}
	custom_permissions = {}
	for row in custom_rows:
		custom_permissions.setdefault((row.parent, row.role, row.permlevel), []).append(row)

	inert_rows = frappe.get_all(
		"DocPerm",
		filters={
			"parent": ("in", {row.parent for row in custom_rows}),
			"parenttype": "DocType",
			"permlevel": (">", 0),
		},
		fields=["parent", "role", "permlevel", "if_owner", *rights],
		order_by="parent asc, permlevel asc, role asc",
		limit_page_length=0,
	)

	shadowed: dict[str, list[tuple[str, int]]] = {}
	for row in inert_rows:
		custom = custom_permissions.get((row.parent, row.role, row.permlevel), [])
		if _custom_rows_cover(row, custom):
			continue
		pair = (row.role, row.permlevel)
		if pair not in shadowed.setdefault(row.parent, []):
			shadowed[row.parent].append(pair)
	return shadowed


def warn_about_shadowed_permlevels() -> None:
	"""after_migrate: name the LMS permlevel rows this site is no longer applying."""
	shadowed = get_shadowed_permlevel_rows()
	if not shadowed:
		return

	frappe.log_error(title=ALERT_TITLE, message=_describe_shadow(shadowed))
	click.secho(
		f"{ALERT_TITLE}: {', '.join(shadowed)}. See Error Log for the rows and the fix.",
		fg="yellow",
	)


def _custom_rows_cover(shipped, custom_rows: list) -> bool:
	"""Whether the Custom DocPerm rows replacing a shipped row still carry every grant it
	made. Owner-only access cannot stand in for an unrestricted shipped grant."""
	return all(
		any(perm.get(ptype) and (shipped.if_owner or not perm.if_owner) for perm in custom_rows)
		for ptype in rights
		if shipped.get(ptype)
	)


def _get_lms_doctypes() -> set[str]:
	# `istable` doctypes are skipped by set_custom_permissions, so a child table cannot be
	# shadowed. Modules come from lms/modules.txt rather than a LIKE pattern: the app ships
	# both "LMS" and "Job", and a "%LMS%" filter drops every Job doctype without saying so.
	doctypes = frappe.get_all(
		"DocType",
		filters={"module": ("in", get_module_list("lms")), "custom": 0, "istable": 0},
		pluck="name",
	)
	return set(doctypes) - set(LMS_MANAGED_CUSTOM_DOCPERM_DOCTYPES)


def _describe_shadow(shadowed: dict[str, list[tuple[str, int]]]) -> str:
	lines = [
		"These LMS doctypes carry Custom DocPerm rows that omit or narrow some shipped grants.",
		"The role and permlevel pairs below have reduced access. Missing field-level read or",
		"write grants can hide fields or reset submitted values; review the custom permission set.",
		"",
	]
	for doctype, rows in shadowed.items():
		inert = ", ".join(f"{role} (permlevel {permlevel})" for role, permlevel in rows)
		custom_rows = frappe.db.count("Custom DocPerm", {"parent": doctype})
		plural = "" if custom_rows == 1 else "s"
		lines.append(f"  {doctype} - inert under {custom_rows} Custom DocPerm row{plural}: {inert}")
	lines += [
		"",
		"Open Role Permissions Manager for each doctype above and add the listed role and",
		"permlevel rows back, or delete that doctype's Custom DocPerm rows to fall back to what",
		"LMS ships. This runs on every migrate and stops reporting once the rows apply again.",
	]
	return "\n".join(lines)
