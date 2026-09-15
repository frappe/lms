import frappe

# The plain (batch, member) index add_batch_enrollment_index added for the Raven
# "Students of Batches" lookup. The unique index covers the same columns in the
# same order, so it serves that lookup too.
REDUNDANT_BATCH_INDEX = "batch_member_index"


def ensure_enrollment_unique_constraints():
	"""Constrain (batch, member) and (course, member) at the DB.

	Defence in depth, not the fix. The fix is the FOR UPDATE lock every
	check-then-insert path takes before its read, because that holds on every site
	whatever its schema. These indexes stop a writer that never reaches those
	paths: a bulk import, a script, direct SQL.

	after_install is the only caller and it runs against tables this install just
	created, so there is nothing to dedupe — an install cannot have duplicates.
	This module used to dedupe first and, when rows still collided, log and return
	*without* adding the index: a caller that reported success having enforced
	nothing, and (as a patch) one frappe recorded complete so nothing ever retried
	it. Both the dedupe and that skip are gone. add_unique is idempotent, and on
	dirty data — which it cannot meet here — it raises instead of pretending.

	Cleaning duplicates on a site that already has them is a separate, bounded,
	opt-in job (specs/specs-ankush/migration-safety.md rules 8-9), not something an
	install hook does behind the operator's back."""
	_constrain("LMS Batch Enrollment", "batch")
	_constrain("LMS Enrollment", "course")


def _constrain(doctype, parent_field):
	if not frappe.db.table_exists(doctype):
		return

	frappe.db.add_unique(doctype, [parent_field, "member"])

	if doctype == "LMS Batch Enrollment":
		_drop_redundant_batch_index()


def _drop_redundant_batch_index():
	if not frappe.db.has_index("tabLMS Batch Enrollment", "unique_batch_member"):
		return
	if not frappe.db.has_index("tabLMS Batch Enrollment", REDUNDANT_BATCH_INDEX):
		return
	frappe.db.sql_ddl("alter table `tabLMS Batch Enrollment` drop index `batch_member_index`")
