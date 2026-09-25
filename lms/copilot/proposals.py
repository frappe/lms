"""Write tools never write. They create a Copilot Proposal that a teacher approves.

Lifecycle::

    Pending --approve--> Approved --execute+verify--> Applied
       |                    \\--error, rolled back---> Failed
       |--reject---> Rejected
       \\--expired or source changed--> Expired

On approval the reviewer's own permission is checked again, the source record
is compared with the version the agent read, and only then does the write run.
"""

import re
import time

import frappe
from frappe import _
from frappe.utils import add_days, get_datetime, now_datetime

from lms.copilot import access
from lms.copilot.audit import log_tool
from lms.copilot.content import (
	append_block,
	content_hash,
	lesson_text,
	markdown_block,
	parse_editor,
	replace_block,
	text_diff,
)
from lms.copilot.quiz import create_quiz_in_lesson, normalise_quiz, quiz_preview_lines
from lms.copilot.validation import (
	boolean,
	confidence,
	existing,
	fail,
	integer,
	load_json,
	optional_text,
	parse_list,
	parse_object,
	required_text,
)

OPEN = "Pending"
MAX_MARKDOWN = 20000
MAX_REMINDER_LEARNERS = 200
MAX_RUBRIC_CRITERIA = 20
MAX_RUBRIC_LEVEL = 10


class ProposalType:
	"""One kind of write. Subclasses define how to validate, preview, run and verify it."""

	label = ""
	tool = ""
	audiences = frozenset()
	source_doctype = None
	# Keys a reviewer may not change while editing: they decide what is touched.
	locked_keys = ()

	def prepare(self, params):
		"""Validate params from the agent; return fields for the proposal."""
		raise NotImplementedError

	def normalise(self, params, proposal):
		"""Validate params again, including a reviewer's edits, before execution."""
		params = parse_object(params, _("Parameters"))
		original = load_json(proposal.params, {})
		params.update({key: original.get(key) for key in self.locked_keys})
		return self.prepare(params)["params"]

	def assert_reviewer(self, proposal):
		access.assert_teacher(proposal.course)

	def execute(self, proposal, params):
		raise NotImplementedError

	def verify(self, proposal, result):
		return True

	def source_state(self, name):
		if not self.source_doctype or not name:
			return None, None
		content = frappe.db.get_value(self.source_doctype, name, "content")
		version = frappe.db.get_value(self.source_doctype, name, "modified")
		return str(version), content_hash(content)


def _lesson_for_teacher(lesson):
	lesson = existing("Course Lesson", lesson, _("Lesson"))
	doc = frappe.get_doc("Course Lesson", lesson)
	if not access.is_engine():
		access.assert_teacher(doc.course)
	return doc


class LessonQuiz(ProposalType):
	label = "Lesson Quiz"
	tool = "propose_lesson_quiz"
	audiences = frozenset({access.TEACHER, access.ENGINE})
	source_doctype = "Course Lesson"
	locked_keys = ("lesson",)

	def prepare(self, params):
		params = parse_object(params, _("Parameters"))
		lesson = _lesson_for_teacher(params.get("lesson"))
		quiz = normalise_quiz(params.get("quiz"))
		return {
			"course": lesson.course,
			"reference_doctype": "Course Lesson",
			"reference_name": lesson.name,
			"title": _("Add quiz “{0}” to {1}").format(quiz["title"], lesson.title),
			"params": {"lesson": lesson.name, "quiz": quiz},
			"preview": {
				"kind": "diff",
				"lines": [{"op": "add", "text": line} for line in quiz_preview_lines(quiz)],
			},
		}

	def execute(self, proposal, params):
		return create_quiz_in_lesson(params["lesson"], params["quiz"])

	def verify(self, proposal, result):
		content = frappe.db.get_value("Course Lesson", result["lesson"], "content")
		blocks = parse_editor(content)["blocks"]
		return any(block.get("data", {}).get("quiz") == result["quiz"] for block in blocks) and bool(
			frappe.db.exists("LMS Quiz", result["quiz"])
		)


class LessonChange(ProposalType):
	label = "Lesson Change"
	tool = "propose_lesson_change"
	audiences = frozenset({access.TEACHER, access.ENGINE})
	source_doctype = "Course Lesson"
	locked_keys = ("lesson",)
	modes = ("append", "replace_block")

	def _apply(self, lesson, params):
		if params["mode"] == "append":
			return append_block(lesson.content, markdown_block(params["markdown"]), params.get("after_block"))
		return replace_block(lesson.content, params["block_id"], params["markdown"])

	def prepare(self, params):
		params = parse_object(params, _("Parameters"))
		lesson = _lesson_for_teacher(params.get("lesson"))
		mode = params.get("mode") or "append"
		if mode not in self.modes:
			fail(_("Mode must be one of: {0}.").format(", ".join(self.modes)))
		clean = {
			"lesson": lesson.name,
			"mode": mode,
			"markdown": required_text(params.get("markdown"), _("Lesson text"), MAX_MARKDOWN),
			"reason": optional_text(params.get("reason"), _("Reason"), 1000),
		}
		if mode == "append":
			clean["after_block"] = optional_text(params.get("after_block"), _("Block"), 40)
		else:
			clean["block_id"] = required_text(params.get("block_id"), _("Block"), 40)

		after = frappe.get_doc("Course Lesson", lesson.name)
		after.content = self._apply(lesson, clean)
		return {
			"course": lesson.course,
			"reference_doctype": "Course Lesson",
			"reference_name": lesson.name,
			"title": _("Edit lesson {0}").format(lesson.title),
			"summary": clean["reason"],
			"params": clean,
			"preview": {"kind": "diff", "lines": text_diff(lesson_text(lesson), lesson_text(after))},
		}

	def execute(self, proposal, params):
		lesson = frappe.get_doc("Course Lesson", params["lesson"])
		lesson.content = self._apply(lesson, params)
		lesson.save(ignore_permissions=True)
		return {"lesson": lesson.name, "course": lesson.course, "version": content_hash(lesson.content)}

	def verify(self, proposal, result):
		lesson = frappe.get_doc("Course Lesson", result["lesson"])
		markdown = (load_json(proposal.final_params, {}) or {}).get("markdown", "")
		blocks = parse_editor(lesson.content)["blocks"]
		return any(block.get("data", {}).get("text") == markdown for block in blocks)


def _notify(member, subject, message, course, from_user):
	frappe.get_doc(
		{
			"doctype": "Notification Log",
			"for_user": member,
			"from_user": from_user,
			"type": "Alert",
			"subject": subject,
			"email_content": message,
			"document_type": "LMS Course",
			"document_name": course,
		}
	).insert(ignore_permissions=True)


class LearnerReminder(ProposalType):
	label = "Learner Reminder"
	tool = "propose_learner_reminder"
	audiences = frozenset({access.TEACHER, access.ENGINE})
	locked_keys = ("course",)

	def prepare(self, params):
		params = parse_object(params, _("Parameters"))
		course = existing("LMS Course", params.get("course"), _("Course"))
		if not access.is_engine():
			access.assert_teacher(course)
		refs = parse_list(params.get("learners"), _("Learners"), minimum=1, maximum=MAX_REMINDER_LEARNERS)
		refs = [required_text(ref, _("Learner"), 20) for ref in refs]
		access.resolve_learner_refs(course, refs)
		message = required_text(params.get("message"), _("Message"), 2000)
		title = frappe.db.get_value("LMS Course", course, "title")
		return {
			"course": course,
			"reference_doctype": "LMS Course",
			"reference_name": course,
			"title": _("Remind {0} learner(s) in {1}").format(len(refs), title),
			"summary": optional_text(params.get("reason"), _("Reason"), 1000),
			"params": {"course": course, "learners": refs, "message": message},
			"preview": {"kind": "message", "recipients": refs, "message": message},
		}

	def execute(self, proposal, params):
		members = access.resolve_learner_refs(params["course"], params["learners"])
		subject = _("A reminder from your teacher")
		for member in members:
			_notify(member, subject, params["message"], params["course"], frappe.session.user)
		return {"course": params["course"], "count": len(members)}

	def verify(self, proposal, result):
		return result["count"] == len(load_json(proposal.final_params, {}).get("learners", []))


class Escalation(ProposalType):
	"""A learner question the assistant must not answer. Approving means replying."""

	label = "Escalation"
	tool = "escalate_to_teacher"
	audiences = frozenset({access.LEARNER})

	def prepare(self, params):
		params = parse_object(params, _("Parameters"))
		course = existing("LMS Course", params.get("course"), _("Course"))
		access.assert_course_reader(course)
		lesson = params.get("lesson")
		if lesson:
			lesson = existing("Course Lesson", lesson, _("Lesson"))
		question = required_text(params.get("question"), _("Question"), 2000)
		return {
			"course": course,
			"reference_doctype": "Course Lesson" if lesson else "LMS Course",
			"reference_name": lesson or course,
			"title": question[:120],
			"summary": optional_text(params.get("summary"), _("Summary"), 2000),
			"params": {"course": course, "lesson": lesson, "question": question},
			"preview": {"kind": "question", "question": question},
		}

	def normalise(self, params, proposal):
		params = parse_object(params, _("Parameters"))
		original = load_json(proposal.params, {})
		return {**original, "reply": required_text(params.get("reply"), _("Reply"), 4000)}

	def assert_reviewer(self, proposal):
		access.assert_reviewer(proposal.course)

	def execute(self, proposal, params):
		_notify(
			proposal.requested_by,
			_("Your teacher answered: {0}").format(params["question"][:80]),
			params["reply"],
			params["course"],
			frappe.session.user,
		)
		return {"notified": proposal.requested_by, "course": params["course"]}


def _criterion(item, index, course):
	if not isinstance(item, dict):
		fail(_("Criterion {0} must be an object.").format(index))
	label = _("Criterion {0}").format(index)
	max_level = integer(item.get("max_level", 3), _("{0} max level").format(label), 1, MAX_RUBRIC_LEVEL)
	points = item.get("points")
	if points not in (None, ""):
		try:
			points = float(points)
		except (TypeError, ValueError):
			fail(_("{0} points must be a number.").format(label))
		if isinstance(item.get("points"), bool) or not 0 <= points <= 1000:
			fail(_("{0} points must be between 0 and 1000.").format(label))
	lesson = optional_text(item.get("taught_in_lesson"), _("{0} lesson").format(label), 140)
	if lesson:
		lesson = existing("Course Lesson", lesson, _("{0} lesson").format(label))
		if frappe.db.get_value("Course Lesson", lesson, "course") != course:
			fail(_("{0} points to a lesson from another course.").format(label))
	return {
		"criterion": required_text(item.get("criterion"), label, 140),
		"description": optional_text(item.get("description"), _("{0} description").format(label), 2000),
		"max_level": max_level,
		"points": points if points not in (None, "") else None,
		"levels": optional_text(item.get("levels"), _("{0} levels").format(label), 2000),
		"taught_in_lesson": lesson,
		"pass_example": optional_text(item.get("pass_example"), _("{0} passing example").format(label), 4000),
		"fail_example": optional_text(item.get("fail_example"), _("{0} failing example").format(label), 4000),
	}


def _rubric_lines(title, criteria):
	lines = [f"# {title}"] if title else []
	for row in criteria:
		points = f", {row['points']:g} pts" if row.get("points") else ""
		lines.append(f"## {row['criterion']} (1–{row['max_level']}{points})")
		for key, prefix in (
			("description", ""),
			("levels", ""),
			("taught_in_lesson", "Lesson: "),
			("pass_example", "Pass: "),
			("fail_example", "Fail: "),
		):
			if row.get(key):
				lines.extend(f"{prefix}{line}" for line in str(row[key]).splitlines())
	return "\n".join(lines)


def _current_rubric(assignment):
	name = frappe.db.get_value("Copilot Rubric", {"assignment": assignment}, "name", order_by="modified desc")
	return frappe.get_doc("Copilot Rubric", name) if name else None


def _rubric_rows(rubric):
	fields = (
		"criterion",
		"description",
		"max_level",
		"points",
		"levels",
		"taught_in_lesson",
		"pass_example",
		"fail_example",
	)
	return [{key: row.get(key) for key in fields} for row in rubric.criteria]


class Rubric(ProposalType):
	"""Create or replace the rubric an assignment is graded with."""

	label = "Rubric"
	tool = "propose_rubric"
	audiences = frozenset({access.TEACHER, access.ENGINE})
	source_doctype = "LMS Assignment"
	locked_keys = ("assignment",)

	def prepare(self, params):
		params = parse_object(params, _("Parameters"))
		assignment = existing("LMS Assignment", params.get("assignment"), _("Assignment"))
		doc = frappe.get_doc("LMS Assignment", assignment)
		course = doc.get("course")
		if not course:
			fail(_("This assignment is not linked to a course."))
		if not access.is_engine():
			access.assert_teacher(course)
		items = parse_list(params.get("criteria"), _("Criteria"), minimum=1, maximum=MAX_RUBRIC_CRITERIA)
		criteria = [_criterion(item, index, course) for index, item in enumerate(items, 1)]
		names = [row["criterion"] for row in criteria]
		if len(set(names)) != len(names):
			fail(_("Each criterion needs a different name."))
		title = optional_text(params.get("title"), _("Title"), 140) or doc.title
		visible = params.get("visible_to_learner")
		clean = {
			"assignment": assignment,
			"title": title,
			"criteria": criteria,
			"visible_to_learner": 1 if visible in (None, "") else boolean(visible, _("Visible to learners")),
			"notes": optional_text(params.get("notes"), _("Notes"), 4000),
			"reason": optional_text(params.get("reason"), _("Reason"), 1000),
		}
		current = _current_rubric(assignment)
		before = _rubric_lines(current.title, _rubric_rows(current)) if current else ""
		return {
			"course": course,
			"reference_doctype": "LMS Assignment",
			"reference_name": assignment,
			"title": (_("Replace rubric of {0}") if current else _("Add rubric to {0}")).format(doc.title),
			"summary": clean["reason"],
			"params": clean,
			"preview": {"kind": "diff", "lines": text_diff(before, _rubric_lines(title, criteria))},
		}

	def source_state(self, name):
		"""The rubric the agent saw: stale if it is created, edited or removed before approval."""
		if not name:
			return None, None
		current = _current_rubric(name)
		if not current:
			return None, content_hash("no rubric")
		state = frappe.as_json({"name": current.name, "title": current.title, "rows": _rubric_rows(current)})
		return str(current.modified), content_hash(state)

	def execute(self, proposal, params):
		rubric = _current_rubric(params["assignment"])
		values = {
			"title": params["title"],
			"visible_to_learner": params["visible_to_learner"],
			"criteria": params["criteria"],
		}
		if params.get("notes"):
			values["notes"] = params["notes"]
		if rubric:
			rubric.update(values)
			rubric.save(ignore_permissions=True)
		else:
			rubric = frappe.get_doc(
				{"doctype": "Copilot Rubric", "assignment": params["assignment"], **values}
			).insert(ignore_permissions=True)
		return {"rubric": rubric.name, "assignment": params["assignment"], "criteria": len(rubric.criteria)}

	def verify(self, proposal, result):
		expected = [row["criterion"] for row in load_json(proposal.final_params, {}).get("criteria", [])]
		rubric = _current_rubric(result["assignment"])
		return (
			bool(rubric)
			and rubric.name == result["rubric"]
			and [row.criterion for row in rubric.criteria] == expected
		)


MAX_DRAFT_CHAPTERS = 15
MAX_DRAFT_LESSONS = 60
MAX_LESSON_SOURCES = 8
MAX_DRAFT_ASSIGNMENTS = 10
MISSING_CHOICES = ("keep", "drop")
LESSON_NUMBER = re.compile(r"^\s*(?:L\s*)?(\d+)\.(\d+)\s*$")
LESSON_KEY = re.compile(r"^L\d+$")


def _page_label(entry, pages):
	file_name, unit, _pages = entry
	unit = {"page": _("p."), "slide": _("slide"), "section": _("section")}.get(unit, "")
	return f"{file_name} {unit} {', '.join(str(page) for page in pages)}"


def _draft_sources(items, index):
	"""Keep citations of pages that exist in the import; anything else is dropped, not trusted."""
	refs = []
	for item in items if isinstance(items, list) else []:
		if not isinstance(item, dict):
			continue
		source = str(item.get("source") or "").strip()
		if source not in index:
			continue
		pages = item.get("pages") if isinstance(item.get("pages"), list) else [item.get("page")]
		for page in pages:
			if isinstance(page, bool):
				continue
			try:
				page = int(page)
			except (TypeError, ValueError):
				continue
			ref = {"source": source, "page": page}
			if page in index[source][2] and ref not in refs:
				refs.append(ref)
	return refs[:MAX_LESSON_SOURCES]


def _source_labels(refs, index):
	by_source = {}
	for ref in refs:
		by_source.setdefault(ref["source"], []).append(ref["page"])
	return [_page_label(index[source], sorted(pages)) for source, pages in by_source.items()]


def _lesson_key(value, keys):
	"""A lesson named by key (L3) or outline number (2.1)."""
	value = str(value or "").strip()
	if value in keys.values():
		return value
	match = LESSON_NUMBER.match(value)
	return keys.get((int(match.group(1)), int(match.group(2)))) if match else None


class CourseDraft(ProposalType):
	"""A whole course drafted from the teacher's documents. Nothing exists until approval."""

	label = "Course Draft"
	tool = "propose_course_draft"
	audiences = frozenset({access.TEACHER, access.ENGINE})
	locked_keys = ("course_import",)

	def _import(self, name):
		from lms.copilot import course_import

		doc = course_import.get_import(name)
		if doc.course:
			fail(_("A course was already created from this import."))
		return doc, course_import.page_index(doc)

	def _outline(self, params, index):
		chapters_in = parse_list(params.get("chapters"), _("Chapters"), minimum=1, maximum=MAX_DRAFT_CHAPTERS)
		used = {
			str(lesson.get("key"))
			for chapter in chapters_in
			if isinstance(chapter, dict)
			for lesson in (chapter.get("lessons") if isinstance(chapter.get("lessons"), list) else [])
			if isinstance(lesson, dict) and LESSON_KEY.match(str(lesson.get("key") or ""))
		}
		next_key = max([int(key[1:]) for key in used] or [0])
		chapters, keys, seen, total = [], {}, set(), 0
		for chapter_number, chapter in enumerate(chapters_in, 1):
			if not isinstance(chapter, dict):
				fail(_("Chapter {0} must be an object.").format(chapter_number))
			lessons_in = parse_list(
				chapter.get("lessons"), _("Lessons of chapter {0}").format(chapter_number), minimum=1
			)
			lessons = []
			for lesson_number, lesson in enumerate(lessons_in, 1):
				total += 1
				if total > MAX_DRAFT_LESSONS:
					fail(_("A course draft can have at most {0} lessons.").format(MAX_DRAFT_LESSONS))
				label = _("Lesson {0}.{1}").format(chapter_number, lesson_number)
				if not isinstance(lesson, dict):
					fail(_("{0} must be an object.").format(label))
				key = str(lesson.get("key") or "")
				if not LESSON_KEY.match(key) or key in seen:
					next_key += 1
					key = f"L{next_key}"
				seen.add(key)
				keys[(chapter_number, lesson_number)] = key
				sources = _draft_sources(lesson.get("sources"), index)
				lessons.append(
					{
						"key": key,
						"title": required_text(lesson.get("title"), label, 140),
						"markdown": required_text(lesson.get("markdown"), _("{0} content").format(label), MAX_MARKDOWN),
						"sources": sources,
						"missing_material": not sources,
					}
				)
			chapters.append(
				{
					"title": required_text(chapter.get("title"), _("Chapter {0}").format(chapter_number), 140),
					"lessons": lessons,
				}
			)
		return chapters, keys

	def _assignments(self, params, keys, index):
		items = parse_list(params.get("assignments") or [], _("Assignments"), maximum=MAX_DRAFT_ASSIGNMENTS)
		assignments = []
		for number, item in enumerate(items, 1):
			label = _("Assignment {0}").format(number)
			if not isinstance(item, dict):
				fail(_("{0} must be an object.").format(label))
			lesson = _lesson_key(item.get("lesson") or item.get("after_lesson"), keys)
			if not lesson:
				fail(_("{0} must name the lesson it follows, for example 2.1.").format(label))
			rubric = item.get("rubric")
			rubric = rubric if isinstance(rubric, dict) else {"criteria": rubric}
			criteria_in = parse_list(
				rubric.get("criteria"), _("{0} rubric").format(label), minimum=1, maximum=MAX_RUBRIC_CRITERIA
			)
			criteria = []
			for index_, criterion in enumerate(criteria_in, 1):
				if not isinstance(criterion, dict):
					fail(_("Criterion {0} must be an object.").format(index_))
				row = _criterion({**criterion, "taught_in_lesson": None}, index_, None)
				row["taught_in_lesson"] = _lesson_key(criterion.get("taught_in_lesson"), keys)
				criteria.append(row)
			names = [row["criterion"] for row in criteria]
			if len(set(names)) != len(names):
				fail(_("{0}: each criterion needs a different name.").format(label))
			assignments.append(
				{
					"title": required_text(item.get("title"), label, 140),
					"question": required_text(item.get("question"), _("{0} brief").format(label), 10000),
					"lesson": lesson,
					"sources": _draft_sources(item.get("sources"), index),
					"rubric": {
						"title": optional_text(rubric.get("title"), _("Rubric title"), 140)
						or required_text(item.get("title"), label, 140),
						"criteria": criteria,
						"notes": optional_text(rubric.get("notes"), _("Rubric notes"), 4000),
					},
				}
			)
		return assignments

	def _preview(self, clean, index):
		numbers = {}
		chapters = []
		for chapter_number, chapter in enumerate(clean["chapters"], 1):
			lessons = []
			for lesson_number, lesson in enumerate(chapter["lessons"], 1):
				numbers[lesson["key"]] = f"{chapter_number}.{lesson_number}"
				lessons.append(
					{
						"key": lesson["key"],
						"number": numbers[lesson["key"]],
						"title": lesson["title"],
						"markdown": lesson["markdown"],
						"sources": _source_labels(lesson["sources"], index),
						"missing_material": lesson["missing_material"],
					}
				)
			chapters.append({"number": chapter_number, "title": chapter["title"], "lessons": lessons})
		return {
			"kind": "course",
			"title": clean["title"],
			"introduction": clean["short_introduction"],
			"description": clean["description"],
			"chapters": chapters,
			"assignments": [
				{
					"title": item["title"],
					"question": item["question"],
					"after_lesson": numbers.get(item["lesson"]),
					"sources": _source_labels(item["sources"], index),
					"criteria": [
						{
							"criterion": row["criterion"],
							"max_level": row["max_level"],
							"description": row["description"],
							"taught_in_lesson": numbers.get(row["taught_in_lesson"]),
						}
						for row in item["rubric"]["criteria"]
					],
				}
				for item in clean["assignments"]
			],
			"missing": sum(lesson["missing_material"] for chapter in clean["chapters"] for lesson in chapter["lessons"]),
			"files": [entry[0] for entry in index.values()],
		}

	def prepare(self, params):
		params = parse_object(params, _("Parameters"))
		doc, index = self._import(params.get("course_import"))
		if not index:
			fail(_("The import has no extracted text to build a course from."))
		chapters, keys = self._outline(params, index)
		clean = {
			"course_import": doc.name,
			"title": optional_text(params.get("title"), _("Course title"), 140) or doc.title,
			"short_introduction": required_text(params.get("short_introduction"), _("Short introduction"), 500),
			"description": optional_text(params.get("description"), _("Description"), 8000) or "",
			"chapters": chapters,
			"assignments": self._assignments(params, keys, index),
			"reason": optional_text(params.get("reason"), _("Reason"), 1000),
		}
		lessons = [lesson for chapter in chapters for lesson in chapter["lessons"]]
		missing = sum(lesson["missing_material"] for lesson in lessons)
		summary = _("{0} chapter(s), {1} lesson(s), {2} assignment(s) with rubric from {3} file(s).").format(
			len(chapters), len(lessons), len(clean["assignments"]), len(index)
		)
		if missing:
			summary += " " + _("{0} lesson(s) have no source material.").format(missing)
		if clean["reason"]:
			summary += " " + clean["reason"]
		return {
			"course": None,
			"reference_doctype": "Copilot Course Import",
			"reference_name": doc.name,
			"title": _("Create course “{0}” from {1} file(s)").format(clean["title"], len(index)),
			"summary": summary,
			"params": clean,
			"preview": self._preview(clean, index),
		}

	def normalise(self, params, proposal):
		params = parse_object(params, _("Parameters"))
		original = load_json(proposal.params, {})
		choice = params.get("missing_lessons")
		merged = {**original, **{key: value for key, value in params.items() if key != "missing_lessons"}}
		merged["course_import"] = original.get("course_import")
		clean = self.prepare(merged)["params"]
		missing = [lesson for chapter in clean["chapters"] for lesson in chapter["lessons"] if lesson["missing_material"]]
		if missing and choice not in MISSING_CHOICES:
			fail(
				_(
					"{0} lesson(s) have no source material. Keep them marked for you to complete, or drop them."
				).format(len(missing))
			)
		if missing and choice == "drop":
			clean = self._drop_missing(clean)
		clean["missing_lessons"] = choice if missing else None
		return clean

	def _drop_missing(self, clean):
		order = [lesson["key"] for chapter in clean["chapters"] for lesson in chapter["lessons"]]
		chapters = []
		for chapter in clean["chapters"]:
			lessons = [lesson for lesson in chapter["lessons"] if not lesson["missing_material"]]
			if lessons:
				chapters.append({**chapter, "lessons": lessons})
		if not chapters:
			fail(_("Every lesson lacks source material, so nothing would be left to create."))
		kept = [lesson["key"] for chapter in chapters for lesson in chapter["lessons"]]

		def nearest(key):
			if not key or key in kept:
				return key
			before = [item for item in order[: order.index(key)] if item in kept]
			return before[-1] if before else kept[0]

		for item in clean["assignments"]:
			item["lesson"] = nearest(item["lesson"])
			for row in item["rubric"]["criteria"]:
				row["taught_in_lesson"] = nearest(row["taught_in_lesson"]) if row["taught_in_lesson"] else None
		return {**clean, "chapters": chapters}

	def assert_reviewer(self, proposal):
		if access.TEACHER not in access.audiences():
			frappe.throw(_("Only teachers can approve a course draft."), frappe.PermissionError)
		from lms.copilot import course_import

		course_import.get_import(load_json(proposal.params, {}).get("course_import"))

	def execute(self, proposal, params):
		from frappe.utils import md_to_html

		from lms.copilot import course_import

		reviewer = frappe.session.user
		course = frappe.get_doc(
			{
				"doctype": "LMS Course",
				"title": params["title"],
				"short_introduction": params["short_introduction"],
				"description": md_to_html(params["description"] or params["short_introduction"]),
				"published": 0,
				"instructors": [{"instructor": reviewer}],
			}
		).insert(ignore_permissions=True)

		assignments = {}
		for item in params["assignments"]:
			doc = frappe.get_doc(
				{
					"doctype": "LMS Assignment",
					"title": item["title"],
					"question": md_to_html(item["question"]),
					"type": "URL",
					"course": course.name,
					"grade_assignment": 1,
				}
			).insert(ignore_permissions=True)
			assignments.setdefault(item["lesson"], []).append(doc.name)
			item["assignment"] = doc.name

		_doc, index = self._import(params["course_import"])
		lessons, outline = {}, []
		for chapter in params["chapters"]:
			chapter_doc = frappe.get_doc(
				{"doctype": "Course Chapter", "course": course.name, "title": chapter["title"]}
			).insert(ignore_permissions=True)
			names = []
			for lesson in chapter["lessons"]:
				blocks = []
				notes = []
				if lesson["missing_material"]:
					blocks.append(markdown_block(_MISSING_NOTE()))
					notes.append(_("Missing material: this lesson was not drafted from your documents."))
				blocks.append(markdown_block(lesson["markdown"]))
				for assignment in assignments.get(lesson["key"], []):
					blocks.append(
						{"id": frappe.generate_hash(length=10), "type": "assignment", "data": {"assignment": assignment}}
					)
				sources = _source_labels(lesson["sources"], index)
				if sources:
					notes.append(_("Sources: {0}").format("; ".join(sources)))
				doc = frappe.get_doc(
					{
						"doctype": "Course Lesson",
						"course": course.name,
						"chapter": chapter_doc.name,
						"title": lesson["title"],
						"content": frappe.as_json({"blocks": blocks, "version": "2.29.0"}),
						"instructor_notes": "\n\n".join(notes) or None,
					}
				).insert(ignore_permissions=True)
				lessons[lesson["key"]] = doc.name
				names.append(doc.name)
			outline.append((chapter_doc.name, names))

		# LMS hooks touch the chapter and course while lessons are inserted: link the outline last.
		for chapter_name, names in outline:
			chapter_doc = frappe.get_doc("Course Chapter", chapter_name)
			for name in names:
				chapter_doc.append("lessons", {"lesson": name})
			chapter_doc.save(ignore_permissions=True)
		course = frappe.get_doc("LMS Course", course.name)
		for chapter_name, _names in outline:
			course.append("chapters", {"chapter": chapter_name})
		course.save(ignore_permissions=True)

		rubrics = []
		for item in params["assignments"]:
			rubric = item["rubric"]
			criteria = [{**row, "taught_in_lesson": lessons.get(row["taught_in_lesson"])} for row in rubric["criteria"]]
			doc = frappe.get_doc(
				{
					"doctype": "Copilot Rubric",
					"assignment": item["assignment"],
					"title": rubric["title"],
					"visible_to_learner": 1,
					"notes": rubric.get("notes"),
					"criteria": criteria,
				}
			).insert(ignore_permissions=True)
			rubrics.append(doc.name)

		course_import.mark_course_created(params["course_import"], course.name)
		return {
			"course": course.name,
			"chapters": len(outline),
			"lessons": len(lessons),
			"assignments": [item["assignment"] for item in params["assignments"]],
			"rubrics": rubrics,
		}

	def verify(self, proposal, result):
		course = frappe.get_doc("LMS Course", result["course"])
		linked = sum(
			frappe.db.count("Lesson Reference", {"parent": row.chapter, "parenttype": "Course Chapter"})
			for row in course.chapters
		)
		return (
			len(course.chapters) == result["chapters"]
			and linked == result["lessons"]
			and all(frappe.db.exists("Copilot Rubric", name) for name in result["rubrics"])
		)


def _MISSING_NOTE():
	return _(
		"> ⚠️ **Missing material.** The assistant wrote this lesson without a matching passage in "
		"your documents. Check it and add your own material before publishing."
	)


PROPOSAL_TYPES = {
	handler.label: handler
	for handler in (LessonQuiz(), LessonChange(), LearnerReminder(), Escalation(), Rubric(), CourseDraft())
}
TOOL_TYPES = {handler.tool: handler for handler in PROPOSAL_TYPES.values()}


def _ttl_days():
	days = frappe.db.get_single_value("Copilot Settings", "proposal_ttl_days")
	return days if days and days > 0 else 7


def _requested_via():
	if access.is_engine():
		return "AI Engine"
	if access.TEACHER in access.audiences():
		return "Teacher"
	return "Learner"


def _existing_or_none(doctype, name):
	return name if name and frappe.db.exists(doctype, name) else None


def create_proposal(tool, params, conversation=None, insight=None):
	"""Validate a write request and store it as a pending proposal."""
	handler = TOOL_TYPES[tool]
	params = parse_object(params, _("Parameters"))
	prepared = handler.prepare(params)
	version, source_hash = handler.source_state(prepared.get("reference_name"))
	if handler.source_doctype and prepared.get("reference_doctype") != handler.source_doctype:
		version, source_hash = None, None
	doc = frappe.get_doc(
		{
			"doctype": "Copilot Proposal",
			"proposal_type": handler.label,
			"tool": tool,
			"status": OPEN,
			"title": prepared.get("title"),
			"summary": prepared.get("summary"),
			"course": prepared.get("course"),
			"reference_doctype": prepared.get("reference_doctype"),
			"reference_name": prepared.get("reference_name"),
			"params": frappe.as_json(prepared["params"]),
			"preview": frappe.as_json(prepared.get("preview") or {}),
			"source_version": version,
			"source_hash": source_hash,
			"confidence": confidence(params.get("confidence"), _("Confidence")),
			"requested_by": frappe.session.user,
			"requested_via": _requested_via(),
			"conversation": _existing_or_none("Copilot Conversation", conversation),
			"insight": _existing_or_none("Copilot Weekly Insight", insight),
			"expires_on": add_days(now_datetime(), _ttl_days()),
		}
	)
	doc.insert(ignore_permissions=True)
	return {
		"proposal": doc.name,
		"status": doc.status,
		"title": doc.title,
		"message": _("Drafted for teacher approval. Nothing has been changed yet."),
	}


def _get_open(name):
	name = existing("Copilot Proposal", name, _("Proposal"))
	frappe.db.get_value("Copilot Proposal", name, "name", for_update=True)
	return frappe.get_doc("Copilot Proposal", name)


def is_stale(doc):
	handler = PROPOSAL_TYPES[doc.proposal_type]
	if not doc.source_hash:
		return False
	_version, current_hash = handler.source_state(doc.reference_name)
	return current_hash != doc.source_hash


def is_expired(doc):
	return bool(doc.expires_on) and get_datetime(doc.expires_on) < now_datetime()


def _close(doc, status, **values):
	doc.status = status
	doc.update(values)
	doc.save(ignore_permissions=True)


def expire_if_needed(doc):
	if doc.status != OPEN:
		return False
	if is_expired(doc):
		_close(doc, "Expired", error=_("The proposal passed its review deadline."))
		return True
	if is_stale(doc):
		_close(doc, "Expired", error=_("The lesson changed after the assistant read it."))
		return True
	return False


def approve(name, params=None, note=None):
	"""Approve and apply a proposal as the signed-in reviewer."""
	started = time.monotonic()
	doc = _get_open(name)
	handler = PROPOSAL_TYPES[doc.proposal_type]
	handler.assert_reviewer(doc)
	if doc.status != OPEN:
		frappe.throw(_("This proposal is already {0}.").format(_(doc.status)), frappe.ValidationError)
	if expire_if_needed(doc):
		return {"proposal": doc.name, "status": doc.status, "error": doc.error}

	edited = params not in (None, "", {})
	final_params = handler.normalise(params if edited else load_json(doc.params, {}), doc)
	doc.update(
		{
			"status": "Approved",
			"final_params": frappe.as_json(final_params),
			"reviewed_by": frappe.session.user,
			"reviewed_on": now_datetime(),
			"review_note": note,
		}
	)
	doc.save(ignore_permissions=True)

	savepoint = f"copilot_{frappe.generate_hash(length=8)}"
	frappe.db.savepoint(savepoint)
	try:
		result = handler.execute(doc, final_params)
		if not handler.verify(doc, result):
			fail(_("The change could not be verified after it was applied."))
	except Exception as error:
		frappe.db.rollback(save_point=savepoint)
		doc.reload()
		_close(doc, "Failed", error=str(error)[:1000])
		log_tool(
			f"apply:{doc.tool}",
			"Error",
			arguments={"proposal": doc.name, "edited": edited},
			error=error,
			duration_ms=(time.monotonic() - started) * 1000,
			is_write=True,
			proposal=doc.name,
		)
		return {"proposal": doc.name, "status": doc.status, "error": doc.error}

	_close(doc, "Applied", result=frappe.as_json(result))
	log_tool(
		f"apply:{doc.tool}",
		"Success",
		arguments={"proposal": doc.name, "edited": edited},
		result=result,
		duration_ms=(time.monotonic() - started) * 1000,
		is_write=True,
		proposal=doc.name,
	)
	return {"proposal": doc.name, "status": doc.status, "result": result}


def reject(name, note=None):
	doc = _get_open(name)
	PROPOSAL_TYPES[doc.proposal_type].assert_reviewer(doc)
	if doc.status != OPEN:
		frappe.throw(_("This proposal is already {0}.").format(_(doc.status)), frappe.ValidationError)
	_close(
		doc,
		"Rejected",
		reviewed_by=frappe.session.user,
		reviewed_on=now_datetime(),
		review_note=optional_text(note, _("Note"), 2000),
	)
	return {"proposal": doc.name, "status": doc.status}


def get_detail(name):
	name = existing("Copilot Proposal", name, _("Proposal"))
	doc = frappe.get_doc("Copilot Proposal", name)
	PROPOSAL_TYPES[doc.proposal_type].assert_reviewer(doc)
	expire_if_needed(doc)
	return {
		"name": doc.name,
		"type": doc.proposal_type,
		"tool": doc.tool,
		"status": doc.status,
		"title": doc.title,
		"summary": doc.summary,
		"course": doc.course,
		"course_title": frappe.db.get_value("LMS Course", doc.course, "title") if doc.course else None,
		"reference_doctype": doc.reference_doctype,
		"reference_name": doc.reference_name,
		"params": load_json(doc.params, {}),
		"final_params": load_json(doc.final_params),
		"preview": load_json(doc.preview, {}),
		"confidence": doc.confidence,
		"requested_by": doc.requested_by,
		"requested_by_name": frappe.db.get_value("User", doc.requested_by, "full_name"),
		"requested_via": doc.requested_via,
		"created": doc.creation,
		"expires_on": doc.expires_on,
		"reviewed_by": doc.reviewed_by,
		"reviewed_on": doc.reviewed_on,
		"result": load_json(doc.result),
		"error": doc.error,
	}


def expire_open_proposals():
	"""Daily: close proposals whose deadline passed or whose source changed."""
	for name in frappe.get_all("Copilot Proposal", filters={"status": OPEN}, pluck="name"):
		expire_if_needed(frappe.get_doc("Copilot Proposal", name))
