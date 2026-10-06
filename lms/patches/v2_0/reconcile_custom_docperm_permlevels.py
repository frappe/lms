# Copyright (c) 2026, FOSS United and Contributors
# For license information, please see license.txt

"""Copy the named doctypes' shipped permlevel > 0 DocPerm rows into their Custom DocPerm
sets wherever they are missing there, so a doctype an admin has customised keeps the
field-level access LMS ships instead of losing it to the wholesale replacement
`frappe.model.meta.Meta.set_custom_permissions` performs (see lms/lms/docperm_shadow.py).
"""

import frappe
from frappe.permissions import rights

from lms.lms.docperm_shadow import get_shadowed_permlevel_rows


def reconcile(doctypes: list[str]) -> None:
	"""Reconcile only `doctypes`. Each permlevel release names the doctypes it
	introduces, so a run can never recreate a row an admin had the chance to revoke:
	a doctype whose permlevel rows shipped in an earlier release is not in any later
	release's list, and the admin's deletion of its rows stands."""
	shadowed = get_shadowed_permlevel_rows()
	for doctype in doctypes:
		inserted = False
		for role, permlevel in shadowed.get(doctype, []):
			if add_missing_custom_docperm(doctype, role, permlevel):
				inserted = True
		if inserted:
			frappe.clear_cache(doctype=doctype)


def add_missing_custom_docperm(doctype: str, role: str, permlevel: int) -> bool:
	"""Insert the Custom DocPerm row that carries (role, permlevel) forward for
	`doctype`, copying every ptype from the shipped DocPerm row. No-op if a Custom
	DocPerm row for that (role, permlevel) already exists."""
	# Read-then-insert is safe here: a patch runs once per site, single-threaded, inside
	# `bench migrate` under frappe.flags.in_patch, and no request path writes Custom DocPerm
	# rows for this (parent, role, permlevel) concurrently. Same pattern as the in-app
	# precedent lms/patches/v2_0/restore_system_manager_perms.py.
	if frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": permlevel}):
		return False

	shipped = frappe.db.get_value(
		"DocPerm",
		{"parent": doctype, "parenttype": "DocType", "role": role, "permlevel": permlevel},
		list(rights),
		as_dict=True,
	)
	if not shipped:
		return False

	custom_perm = frappe.new_doc("Custom DocPerm")
	custom_perm.parent = doctype
	custom_perm.parenttype = "DocType"
	custom_perm.parentfield = "permissions"
	custom_perm.role = role
	custom_perm.permlevel = permlevel
	for ptype in rights:
		custom_perm.set(ptype, shipped.get(ptype))
	# nosemgrep: lms-unjustified-ignore-permissions - migrate-time patch runs as Administrator, no session user to check against
	custom_perm.insert(ignore_permissions=True)
	return True
