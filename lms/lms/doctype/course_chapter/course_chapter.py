# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.utils import get_lesson_count


class CourseChapter(Document):
	def on_update(self):
		self.update_lesson_count()

	def update_lesson_count(self):
		"""Update lesson count in the course"""
		frappe.db.set_value("LMS Course", self.course, "lessons", get_lesson_count(self.course))


def resolve_scorm_access(course: str, lesson: str | None) -> frappe._dict:
	"""``can_access`` and ``locked``: the pair SCORMRenderer._check_permission refuses the
	package bytes on, named once so the player's answer and the byte gate cannot drift."""
	# Local import: permissions reaches utils at module load and utils reaches back at
	# call time, so a top-level import would close that cycle.
	from lms.lms.permissions import can_access_lesson, get_locked_lessons

	if not lesson:
		return frappe._dict(can_access=False, locked=False)
	if not can_access_lesson(lesson):
		# locked cannot be True here: can_access is False only for a non-member, and
		# enforces_lesson_completion is False without a membership. The early return keeps
		# the short-circuit _check_permission had — it runs on every asset of a package.
		return frappe._dict(can_access=False, locked=False)
	return frappe._dict(can_access=True, locked=lesson in get_locked_lessons(course))


def get_scorm_lesson(chapter: str) -> str | None:
	"""The lesson a SCORM chapter's access is decided by. upsert_chapter creates exactly
	one; order_by keeps the answer deterministic if that ever changes."""
	return frappe.db.get_value("Lesson Reference", {"parent": chapter}, "lesson", order_by="idx asc")


@frappe.whitelist()
def get_scorm_playback(chapter: str) -> dict:
	"""What the SCORM player may render for this chapter, resolved server side. launch_file
	is permlevel 1, so the /api/resource read the player used to make no longer carries it;
	locked, can_access and lesson travel along because only the server knows which of the
	page's four states applies."""
	if not isinstance(chapter, str) or not chapter:
		frappe.throw(_("chapter must be a non-empty string"))

	row = frappe.db.get_value(
		"Course Chapter",
		chapter,
		["name", "course", "title", "course_title", "launch_file"],
		as_dict=True,
	)
	# Answered before the permission check so a name that resolves to nothing does not
	# reach frappe.get_doc, and it discloses nothing: every account here holds read.
	if not row:
		frappe.throw(_("Chapter {0} not found").format(chapter), frappe.DoesNotExistError)
	frappe.has_permission("Course Chapter", ptype="read", doc=row.name, throw=True)

	lesson = get_scorm_lesson(row.name)
	return _scorm_playback_payload(row, lesson, resolve_scorm_access(row.course, lesson))


def _scorm_playback_payload(row: frappe._dict, lesson: str | None, access: frappe._dict) -> dict:
	"""The answer, and the one withholding worth recording: only `locked` is logged, since
	it is reachable only for someone already enrolled and so is the one state that says a
	student went around a gate holding shut for them."""
	if access.locked:
		frappe.logger("lms.security").warning(
			"SCORM launch file withheld from a locked chapter: user=%s chapter=%s",
			frappe.session.user,
			row.name,
		)
	playable = access.can_access and not access.locked
	return {
		"chapter": row.name,
		"course": row.course,
		"title": row.title,
		"course_title": row.course_title,
		"lesson": lesson,
		"locked": 1 if access.locked else 0,
		"can_access": 1 if access.can_access else 0,
		"launch_file": row.launch_file if playable else None,
	}
