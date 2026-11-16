# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

"""Reading the assessments a lesson embeds out of the lesson's own content.

The content blob is the source of truth; `Course Lesson.assessments` is the queryable
index derived from it. One reading, shared by the lesson save and the backfill patch, so
the two cannot drift apart.
"""

import json
import re

import frappe
from frappe import _
from frappe.query_builder.functions import Locate

from lms.lms.course_import_export import get_assessment_map
from lms.lms.md import MACRO_RE, find_macros
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


# How a lesson's JSON may have been written: the save path's compact form, the
# editor's JSON.stringify (compact, unescaped), and Python's default. A rewrite keeps
# whichever one the stored value already uses, so nothing else in it moves.
_JSON_STYLES = (
	{"separators": (",", ":")},
	{"separators": (",", ":"), "ensure_ascii": False},
	{},
)


MACRO_FOR_DOCTYPE = {doctype: macro for macro, doctype in LEGACY_MACRO_DOCTYPES.items()}


class RenamableAssessment:
	"""Rename hooks shared by the three assessment controllers. Mix in ahead of
	`Document`; a controller defining its own rename hooks shadows these."""

	def before_rename(self, old, new, merge=False):
		refuse_assessment_merge(merge)

	def after_rename(self, old, new, merge=False):
		rename_assessment_in_lessons(self.doctype, old, new)


def refuse_assessment_merge(merge: bool) -> None:
	"""A merge would file one assessment's submissions under another's questions."""
	if merge:
		frappe.throw(_("Assessments cannot be merged. Rename to an unused name instead."))


def rename_assessment_in_lessons(doctype: str, old: str, new: str) -> None:
	"""Point every lesson that embeds `old` at `new`. rename_doc moves the placement rows
	but not the content they derive from. set_value, not save: a rename is not an edit,
	and a save would re-run the lesson's validators over content nobody touched."""
	for lesson in _lessons_naming(doctype, old, new):
		updates = _renamed_fields(lesson, doctype, old, new)
		if updates:
			frappe.db.set_value("Course Lesson", lesson.name, updates)


def _lessons_naming(doctype: str, old: str, new: str) -> list:
	"""Every lesson that may name `old`: by placement row, or by a text match for a
	lesson whose rows predate the placement table. Matched exactly later."""
	names = set(_lessons_mentioning(old))
	names.update(
		frappe.get_all(
			"LMS Lesson Assessment",
			filters={"parenttype": "Course Lesson", "assessment_type": doctype, "assessment_name": new},
			pluck="parent",
		)
	)
	if doctype == "LMS Quiz":
		names.update(frappe.get_all("Course Lesson", filters={"quiz_id": old}, pluck="name"))
	if not names:
		return []
	return frappe.get_all(
		"Course Lesson",
		filters={"name": ("in", list(names))},
		fields=["name", "content", "instructor_content", "body", "quiz_id"],
	)


def _lessons_mentioning(text: str) -> list[str]:
	lesson = frappe.qb.DocType("Course Lesson")
	text_match = None
	for field in ("content", "instructor_content", "body"):
		for needle in {text, json.dumps(text)[1:-1]}:
			condition = Locate(needle, lesson[field]) > 0
			text_match = condition if text_match is None else text_match | condition
	return frappe.qb.from_(lesson).select(lesson.name).where(text_match).run(pluck=True)


def _renamed_fields(lesson, doctype: str, old: str, new: str) -> dict:
	updates = {}
	for field in ("content", "instructor_content"):
		renamed = _rename_in_editorjs(lesson[field], doctype, old, new)
		if renamed != lesson[field]:
			updates[field] = renamed
	macro = MACRO_FOR_DOCTYPE.get(doctype)
	if macro and lesson.body:
		renamed = _rename_in_macros(lesson.body, macro, old, new)
		if renamed != lesson.body:
			updates["body"] = renamed
	if doctype == "LMS Quiz" and lesson.quiz_id == old:
		updates["quiz_id"] = new
	return updates


def _rename_in_editorjs(content: str | None, doctype: str, old: str, new: str) -> str | None:
	"""Rewrite the blocks that reference `old` as a `doctype`. Parsed, not string
	replaced: the old name can sit inside a longer name or in the lesson's prose."""
	try:
		data = json.loads(content)
	except (TypeError, ValueError):
		return content
	blocks = data.get("blocks") if isinstance(data, dict) else None
	if not isinstance(blocks, list):
		return content

	changed = False
	for block in blocks:
		if isinstance(block, dict) and isinstance(block.get("data"), dict):
			changed |= _rename_in_block(block.get("type"), block["data"], doctype, old, new)
	return _dumps_like(content, data) if changed else content


def _rename_in_block(block_type, data: dict, doctype: str, old: str, new: str) -> bool:
	key = ASSESSMENT_BLOCK_KEYS.get(block_type)
	if key and get_assessment_map().get(block_type) == doctype and data.get(key) == old:
		data[key] = new
		return True

	changed = False
	if block_type == "upload" and doctype == "LMS Quiz" and isinstance(data.get("quizzes"), list):
		for row in data["quizzes"]:
			if isinstance(row, dict) and row.get("quiz") == old:
				row["quiz"] = new
				changed = True
	return changed


def _dumps_like(original: str, data) -> str:
	parsed = json.loads(original)
	for style in _JSON_STYLES:
		if json.dumps(parsed, **style) == original:
			return json.dumps(data, **style)
	return json.dumps(data, **_JSON_STYLES[0])


def _rename_in_macros(body: str, macro: str, old: str, new: str) -> str:
	"""Rewrite `{{ Quiz("old") }}`-style macros, keeping their quoting and spacing."""

	def rename(match):
		if find_macros(match.group(0)) != [(macro, old)]:
			return match.group(0)
		start, end = match.span(2)
		argument = match.group(2).replace(old, new, 1)
		return body[match.start() : start] + argument + body[end : match.end()]

	return re.sub(MACRO_RE, rename, body)
