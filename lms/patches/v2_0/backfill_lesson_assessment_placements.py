"""Give lessons authored before `Course Lesson.assessments` existed their placement rows.

The table is derived from lesson content, and until now it was only written on save, so
every lesson that has not been re-saved since the table shipped has none.
"""

import frappe
from frappe import _

from lms.lms.lesson_assessments import lesson_assessment_rows

# No date cutoff is possible: the placement table is new, so there is no release before
# which a lesson is out of scope, and a cutoff would leave older lessons silently
# unplaced. The bound is a cap on how many lessons one migrate will rewrite.
MAX_REWRITES = 5_000

# Lesson content blobs are unbounded, so they are read a page at a time rather than all
# at once. This also caps the batch size of the unbounded operator path below.
PAGE_SIZE = 500


def execute():
	if not frappe.db.exists("DocType", "LMS Lesson Assessment"):
		return

	pending = _lessons_needing_placements(limit=MAX_REWRITES + 1)
	if len(pending) > MAX_REWRITES:
		frappe.throw(
			_(
				"More than {0} lessons still need assessment placement rows. Rewriting "
				"them inside the migrate transaction would exceed its budget. Run "
				"lms.patches.v2_0.backfill_lesson_assessment_placements.backfill_all as "
				"a background job, then re-run bench migrate."
			).format(MAX_REWRITES)
		)

	for name, rows in pending:
		_write_placements(name, rows)


def backfill_all():
	"""The unbounded path, for an operator to enqueue when execute() refuses the
	volume. No intermediate commit: the caller's transaction commits it, atomically."""
	for name, rows in _lessons_needing_placements():
		_write_placements(name, rows)


def _lessons_needing_placements(limit: int | None = None) -> list[tuple[str, list[dict]]]:
	"""(lesson, rows) for every lesson whose stored placements differ from its content."""
	stored = _stored_placements()
	pending = []
	for lesson in _lessons_with_content():
		rows = lesson_assessment_rows(lesson.body, lesson.content, lesson.instructor_content)
		if _key(rows) != stored.get(lesson.name, []):
			pending.append((lesson.name, rows))
		if limit and len(pending) >= limit:
			break
	return pending


def _stored_placements() -> dict[str, list[tuple]]:
	"""Every placement row already on the site, keyed by lesson, in idx order."""
	stored = {}
	rows = frappe.get_all(
		"LMS Lesson Assessment",
		filters={"parenttype": "Course Lesson"},
		fields=["parent", "assessment_type", "assessment_name", "instructor_only"],
		order_by="parent asc, idx asc",
	)
	for row in rows:
		stored.setdefault(row.parent, []).append(
			(row.assessment_type, row.assessment_name, int(row.instructor_only or 0))
		)
	return stored


def _key(rows: list[dict]) -> list[tuple]:
	return [(row["assessment_type"], row["assessment_name"], int(row["instructor_only"])) for row in rows]


def _lessons_with_content():
	"""Lessons a page at a time. One with all three content fields empty embeds nothing."""
	start = 0
	while True:
		page = frappe.get_all(
			"Course Lesson",
			or_filters=[
				["content", "is", "set"],
				["body", "is", "set"],
				["instructor_content", "is", "set"],
			],
			fields=["name", "body", "content", "instructor_content"],
			order_by="creation asc, name asc",
			limit_start=start,
			limit_page_length=PAGE_SIZE,
		)
		if not page:
			return
		yield from page
		start += PAGE_SIZE


def _write_placements(lesson: str, rows: list[dict]):
	frappe.db.delete("LMS Lesson Assessment", {"parent": lesson, "parenttype": "Course Lesson"})
	for idx, row in enumerate(rows, start=1):
		# nosemgrep: lms-unjustified-ignore-permissions - a migration patch runs as Administrator with no user to authorise, and this row is derived from the lesson, not supplied by a caller
		frappe.get_doc(
			{
				"doctype": "LMS Lesson Assessment",
				"parent": lesson,
				"parenttype": "Course Lesson",
				"parentfield": "assessments",
				"idx": idx,
				**row,
			}
		).insert(ignore_permissions=True)
