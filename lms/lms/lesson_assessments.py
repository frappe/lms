# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

"""Reading the assessments a lesson embeds out of the lesson's own content.

The content blob is the source of truth; `Course Lesson.assessments` is the queryable
index derived from it. One reading, shared by the lesson save and the backfill patch, so
the two cannot drift apart.
"""

import frappe

from lms.lms.course_import_export import get_assessment_map
from lms.lms.md import find_macros
from lms.lms.utils import get_editorjs_blocks

# Block type -> the key inside `data` holding the assessment name. The two differ: a
# "program" block names its exercise under `data.exercise`.
ASSESSMENT_BLOCK_KEYS = {"quiz": "quiz", "assignment": "assignment", "program": "exercise"}

# Legacy `body` macros, from before the block editor. get_quiz_progress and
# get_assignment_progress already honour these.
LEGACY_MACRO_DOCTYPES = {"Quiz": "LMS Quiz", "Assignment": "LMS Assignment"}


def extract_lesson_assessments(body: str | None, content: str | None) -> list[dict]:
	"""Every assessment embedded in one lesson field pair, in document order.
	`content` wins over `body`, matching both progress helpers."""
	if content:
		return _assessments_in_blocks(content)
	if body:
		return _assessments_in_macros(body)
	return []


def lesson_assessment_rows(
	body: str | None, content: str | None, instructor_content: str | None
) -> list[dict]:
	"""One placement row per assessment this lesson embeds, ready to append. A
	dangling reference is dropped: `assessment_name` is a Dynamic Link, so a row
	naming a deleted assessment cannot be saved at all."""
	placements = _placements(body, content, instructor_content)
	existing = _existing_names(placements)
	return [
		{"assessment_type": doctype, "assessment_name": name, "instructor_only": instructor_only}
		for (doctype, name), instructor_only in placements.items()
		if name in existing.get(doctype, set())
	]


def _existing_names(placements: dict) -> dict[str, set]:
	"""One query per doctype for every embedded assessment, not one per row."""
	by_doctype: dict[str, set] = {}
	for doctype, name in placements:
		by_doctype.setdefault(doctype, set()).add(name)
	return {
		doctype: set(frappe.get_all(doctype, filters={"name": ("in", list(names))}, pluck="name"))
		for doctype, names in by_doctype.items()
	}


def _placements(body, content, instructor_content) -> dict:
	"""(type, name) -> instructor_only, with the student-visible placement winning.
	setdefault, not assignment: the other way round hides a student's own quiz."""
	placements = {}
	for row in extract_lesson_assessments(body, content):
		placements[(row["assessment_type"], row["assessment_name"])] = 0
	for row in extract_lesson_assessments(None, instructor_content):
		placements.setdefault((row["assessment_type"], row["assessment_name"]), 1)
	return placements


def _assessments_in_blocks(content: str) -> list[dict]:
	assessment_map = get_assessment_map()
	found = []
	for block in get_editorjs_blocks(content):
		block_type = block.get("type")
		data = block.get("data") or {}
		doctype = assessment_map.get(block_type)
		key = ASSESSMENT_BLOCK_KEYS.get(block_type)
		if doctype and key and data.get(key):
			found.append({"assessment_type": doctype, "assessment_name": data[key]})
		if block_type == "upload":
			found.extend(_quizzes_in_upload_block(data))
	return found


def _quizzes_in_upload_block(data: dict) -> list[dict]:
	"""In-video quizzes. get_quiz_progress has always read these; nothing ever placed them."""
	rows = data.get("quizzes")
	if not isinstance(rows, list):
		return []
	return [
		{"assessment_type": "LMS Quiz", "assessment_name": row["quiz"]}
		for row in rows
		if isinstance(row, dict) and row.get("quiz")
	]


def _assessments_in_macros(body: str) -> list[dict]:
	return [
		{"assessment_type": LEGACY_MACRO_DOCTYPES[macro], "assessment_name": value}
		for macro, value in find_macros(body)
		if macro in LEGACY_MACRO_DOCTYPES and value
	]
