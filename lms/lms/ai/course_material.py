"""A course as a skill's material: each lesson read into the skill's knowledge base, kept in step
with the course as its lessons change, and cited by lesson so a citation opens that lesson."""

import hashlib
import json
import re

import frappe
from frappe import _
from frappe.utils import cint, strip_html_tags

from lms.lms.ai import material, transcripts
from lms.lms.utils import get_editorjs_blocks, get_lesson_index, get_lesson_url, get_lessons

LESSON_TITLE = "{course} · {lesson}"


def add_course(goal: str, course: str) -> None:
	"""Link a course to the skill and read its lessons in the background. Draft courses count too:
	an admin can teach from a course before learners see it."""
	doc = frappe.get_doc("LMS Goal", goal)
	if any(row.course == course for row in doc.courses):
		frappe.throw(_("This course is already part of the material."))
	document = frappe.db.get_value("LMS Course", course, "title")
	if not document:
		frappe.throw(_("This course no longer exists."), frappe.DoesNotExistError)
	from lms.lms.ai.goals import documents

	if document in documents(doc):
		frappe.throw(_("The material already has a document called {0}.").format(document))
	doc.append("courses", {"course": course, "document": document, "lessons": "{}"})
	doc.save(ignore_permissions=True)
	material.set_reading(goal, document, 0, 0)
	enqueue_sync(goal, course)


def remove_course(goal: str, document: str) -> bool:
	"""Forget a linked course and every lesson read from it. False when the document is not a course."""
	doc = frappe.get_doc("LMS Goal", goal)
	row = next((row for row in doc.courses if row.document == document), None)
	if not row:
		return False
	if doc.knowledge_base:
		_drop(doc.knowledge_base, list(_read_lessons(row)))
	doc.remove(row)
	doc.save(ignore_permissions=True)
	return True


def enqueue_sync(goal: str, course: str) -> None:
	frappe.enqueue(
		"lms.lms.ai.course_material.sync_course",
		queue="long",
		timeout=4 * 60 * 60,
		enqueue_after_commit=True,
		job_id=f"lms_goal_course:{goal}:{course}",
		deduplicate=True,
		goal=goal,
		course=course,
	)


def sync_course(goal: str, course: str) -> None:
	"""Worker: bring the skill's copy of the course up to date. Only lessons whose text changed are
	read again, and lessons that left the course leave the material."""
	from frappe.flow.knowledge.knowledge import Knowledge

	row = _row(goal, course)
	if not row:
		return
	kb = Knowledge(frappe.db.get_value("LMS Goal", goal, "knowledge_base"))
	try:
		# A lesson saved while this runs is deduplicated against this job, so look again once
		# done and go round until nothing changed under us.
		for _round in range(3):
			if not _sync_pass(goal, row, kb, course_lessons(course, row.document)):
				break
	finally:
		material.clear_reading(goal, [row.document])
		frappe.publish_realtime("lms_goal_material", {"goal": goal}, after_commit=True)


def _sync_pass(goal: str, row, kb, lessons: list[tuple[str, str, str]]) -> bool:
	"""One pass over the course. True when a lesson changed while it ran, so it is worth another."""
	before = _read_lessons(row)
	after = {}
	current = {title for title, _, _ in lessons}
	stopped = False
	for index, (title, lesson, text) in enumerate(lessons, 1):
		material.set_reading(goal, row.document, index, len(lessons))
		fingerprint = hashlib.sha1(text.encode()).hexdigest()
		kept = before.get(title)
		if kept and kept["hash"] == fingerprint and _indexed(kb.name, title):
			after[title] = kept
			continue
		if not material.index_part(kb, title, text=text):
			stopped = True  # rate limited for good: the rest keeps what it had and is read next time
			break
		after[title] = {"lesson": lesson, "hash": fingerprint}
	for title, kept in before.items():
		if title in current and title not in after:
			after[title] = kept  # reached neither: still indexed, still cited
	# Only lessons that left the course leave the material.
	_drop(kb.name, [title for title in before if title not in current])
	row.lessons = json.dumps(after)
	frappe.db.set_value(
		"LMS Goal Course",
		row.name,
		{
			"lessons": row.lessons,
			"videos_unread": sum(unread_videos(lesson.name) for lesson in get_lessons(row.course)),
		},
	)
	if stopped:
		return False
	fresh = course_lessons(row.course, row.document)
	return {t: hashlib.sha1(x.encode()).hexdigest() for t, _, x in fresh} != {
		t: hashlib.sha1(x.encode()).hexdigest() for t, _, x in lessons
	}


def course_lessons(course: str, document: str) -> list[tuple[str, str, str]]:
	"""(citation title, lesson, text) for each lesson with something to read, in course order."""
	lessons = []
	for lesson in get_lessons(course):
		text = lesson_text(lesson.name)
		if text:
			title = LESSON_TITLE.format(course=document, lesson=lesson.title)
			lessons.append((title, lesson.name, text))
	return lessons


def lesson_text(lesson: str) -> str:
	"""A lesson as plain text: its title, the words of its blocks, and what is said in its videos.
	Quizzes and uploaded files carry no words to teach from, so they are left out."""
	title, body, content, youtube, course = frappe.db.get_value(
		"Course Lesson", lesson, ["title", "body", "content", "youtube", "course"]
	)
	parts = [_block_text(block) for block in get_editorjs_blocks(content)]
	if body and not content:
		parts.append(body)
	# The names in a course steer speech recognition: "ERPNext", not "Earp Next".
	hint = f"{frappe.db.get_value('LMS Course', course, 'title') or ''}: {title}"
	for video in transcripts.lesson_videos(content, youtube):
		spoken = transcripts.transcript(video, hint)
		if spoken:
			parts.append(_("What the video says:") + "\n" + spoken)
	words = "\n\n".join(part for part in parts if part and part.strip())
	return f"{title}\n\n{words}".strip() if words.strip() else ""


def unread_videos(lesson: str) -> int:
	"""How many of the lesson's videos could not be read. Counted from what reading found, so it
	costs no new request."""
	content, youtube = frappe.db.get_value("Course Lesson", lesson, ["content", "youtube"])
	keys = [video.key for video in transcripts.lesson_videos(content, youtube)]
	if not keys:
		return 0
	ready = frappe.get_all(
		transcripts.TRANSCRIPT_DOCTYPE, filters={"name": ("in", keys), "status": "Ready"}, pluck="name"
	)
	return len(keys) - len(ready)


def lesson_link(goal: str, citation: str) -> str | None:
	"""Where a citation like "Fire Safety · Fire exits" opens: the lesson it came from."""
	for row in frappe.get_all(
		"LMS Goal Course", filters={"parent": goal, "parenttype": "LMS Goal"}, fields=["course", "lessons"]
	):
		lesson = (json.loads(row.lessons or "{}").get(citation) or {}).get("lesson")
		if lesson:
			return get_lesson_url(row.course, get_lesson_index(lesson))
	return None


def course_documents(goal: str) -> dict[str, dict]:
	"""Each linked course by its document name: the course it stands for and what could not be read."""
	return {
		row.document: {"course": row.course, "videos_unread": cint(row.videos_unread)}
		for row in frappe.get_all(
			"LMS Goal Course",
			filters={"parent": goal, "parenttype": "LMS Goal"},
			fields=["document", "course", "videos_unread"],
			order_by="idx asc",
		)
	}


def lesson_changed(doc, method=None) -> None:
	"""doc_event on Course Lesson: every skill teaching from its course reads the change."""
	course = doc.course or frappe.db.get_value("Course Chapter", doc.chapter, "course")
	if not course or not frappe.db.table_exists("LMS Goal Course"):
		return
	for goal in frappe.get_all(
		"LMS Goal Course", filters={"course": course, "parenttype": "LMS Goal"}, pluck="parent"
	):
		enqueue_sync(goal, course)


def _block_text(block: dict) -> str:
	data = block.get("data") or {}
	kind = block.get("type")
	if kind in ("paragraph", "header", "quote", "markdown"):
		return _plain(data.get("text"))
	if kind == "list":
		return "\n".join(f"- {item}" for item in _list_items(data.get("items")))
	if kind == "table":
		rows = data.get("content") or []
		return "\n".join(" | ".join(_plain(cell) for cell in row) for row in rows if isinstance(row, list))
	if kind == "codeBox":
		return data.get("code") or ""
	if kind == "image":
		return _plain(data.get("caption"))
	return ""


def _list_items(items, depth: int = 0) -> list[str]:
	"""EditorJS lists hold plain strings or {content, items} with nested lists."""
	found = []
	if not isinstance(items, list) or depth > 5:
		return found
	for item in items:
		if isinstance(item, str):
			found.append(_plain(item))
		elif isinstance(item, dict):
			found.append(_plain(item.get("content")))
			found += _list_items(item.get("items"), depth + 1)
	return [item for item in found if item]


def _plain(html) -> str:
	if not isinstance(html, str):
		return ""
	return re.sub(r"[ \t]+", " ", strip_html_tags(html.replace("<br>", "\n"))).strip()


def _row(goal: str, course: str):
	return frappe.db.get_value(
		"LMS Goal Course",
		{"parent": goal, "parenttype": "LMS Goal", "course": course},
		["name", "course", "document", "lessons"],
		as_dict=True,
	)


def _read_lessons(row) -> dict[str, dict]:
	return json.loads(row.lessons or "{}")


def _indexed(kb: str, title: str) -> bool:
	return bool(
		frappe.db.exists(
			material.SOURCE_DOCTYPE, {"knowledge_base": kb, "title": title, "status": "Completed"}
		)
	)


def _drop(kb: str, titles: list[str]) -> None:
	if not titles:
		return
	for name in frappe.get_all(
		material.SOURCE_DOCTYPE, filters={"knowledge_base": kb, "title": ("in", titles)}, pluck="name"
	):
		frappe.delete_doc(material.SOURCE_DOCTYPE, name, force=True, ignore_permissions=True)
