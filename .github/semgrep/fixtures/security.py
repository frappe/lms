"""Known positives for security.yml. Every function here MUST be flagged,
apart from the suppressed one, which proves the escape hatch works.

The filename has to match the rule file's stem for `semgrep --test`.
Not imported by the app; excluded from coverage."""

import shutil

import frappe


# ruleid: lms-mutating-whitelist-needs-post
@frappe.whitelist()
def mutating_on_get(name: str):
	frappe.delete_doc("LMS Course", name)


# ruleid: lms-mutating-whitelist-needs-post
@frappe.whitelist()
def rmtree_on_get(path: str):
	shutil.rmtree(path)


@frappe.whitelist()
def bypass_without_reason(course: str):
	# ruleid: lms-unjustified-ignore-permissions
	return frappe.get_all("LMS Course", filters={"name": course}, ignore_permissions=True)


@frappe.whitelist()
def bypass_via_flags(course: str):
	doc = frappe.get_doc("LMS Course", course)
	# ruleid: lms-unjustified-ignore-permissions
	doc.flags.ignore_permissions = True
	return doc


def bypass_with_reason(course: str):
	# ok: lms-unjustified-ignore-permissions
	# nosemgrep: lms-unjustified-ignore-permissions - background job, no user session
	return frappe.get_all("LMS Course", filters={"name": course}, ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def race(member: str, batch: str):
	# ruleid: lms-exists-then-insert
	if not frappe.db.exists("LMS Batch Enrollment", {"member": member, "batch": batch}):
		frappe.get_doc({"doctype": "LMS Batch Enrollment", "member": member, "batch": batch}).insert()
