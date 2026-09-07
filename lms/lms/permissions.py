# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

"""Shared access-control helpers for LMS lesson media.

Centralizes the cross-doctype permission logic that the Course Lesson controller,
the serve_resource endpoint, the SCORM renderer, and the File has_permission hook
all rely on, mirroring the dedicated permissions module pattern used by frappe
core (frappe/permissions.py), CRM (crm.permissions.*), and Raven (raven.permissions).
"""

import frappe

from lms.lms.utils import (
	can_modify_batch,
	can_modify_course,
	get_membership,
	guest_access_allowed,
	has_moderator_role,
)

# File fields that hold instructor-only lesson media (never served to students).
INSTRUCTOR_FIELDS = {"instructor_content", "instructor_notes"}


def resolve_lesson_access(lesson: str, *, user: str | None = None) -> tuple[bool, bool]:
	"""Return ``(is_instructor, can_access)`` for a lesson, computed in a single pass.

	- ``is_instructor``: can author the lesson's course → all media, incl. instructor files.
	- ``can_access``: ``is_instructor`` OR enrolled member OR (published course AND
	  include_in_preview AND guest access allowed).

	Callers needing only one flag should use :func:`can_access_lesson`; this exists so a
	caller needing both (e.g. get_lesson, which decides instructor-field visibility on top
	of the access gate) resolves the instructor check once instead of twice.
	"""
	if not isinstance(lesson, str) or not lesson:
		return False, False

	lesson_row = frappe.db.get_value("Course Lesson", lesson, ["course", "include_in_preview"], as_dict=True)
	if not lesson_row:
		return False, False

	original_user = frappe.session.user
	user = user or original_user
	try:
		# can_modify_course / get_membership / guest_access_allowed read session.user.
		frappe.session.user = user
		if can_modify_course(lesson_row.course):
			return True, True
		if get_membership(lesson_row.course, user):
			return False, True
		# Preview is for prospective students of a LIVE course. Require the course to be
		# published so draft lessons don't leak via this gate (matches get_course_details,
		# which already hides unpublished courses from non-authors). Instructors/members
		# are handled above, so unpublishing never locks them out.
		if (
			lesson_row.include_in_preview
			and frappe.db.get_value("LMS Course", lesson_row.course, "published")
			and guest_access_allowed()
		):
			return False, True
		return False, False
	finally:
		frappe.session.user = original_user


def can_access_lesson(lesson: str, *, instructor_only: bool = False, user: str | None = None) -> bool:
	"""Single source of truth for who may read a lesson's resources.

	- instructors / moderators (can_modify_course) → all media (incl. instructor files)
	- instructor_only=True → only the above; enrolled students denied
	- else (student media): enrolled member OR (published course AND include_in_preview
	  AND guest access allowed)
	"""
	is_instructor, can_access = resolve_lesson_access(lesson, user=user)
	return is_instructor if instructor_only else can_access


def can_access_quiz(quiz: str, *, user: str | None = None) -> bool:
	"""Single source of truth for who may read a quiz's questions/answers.

	Access is granted to:
	- global moderators and the quiz's own author (so an unlinked/newly-created quiz
	  can still be edited before it is embedded anywhere),
	- course authors / moderators of any course the quiz belongs to, plus enrolled
	  members of that course,
	- batch instructors / enrolled members of any batch whose assessment references it.

	A quiz's owning course/lesson is read from LMS Quiz.course / LMS Quiz.lesson (set
	automatically by Course Lesson.save_lesson_details_in_quiz when the quiz is embedded
	in a lesson). Course Lesson.quiz_id is also honoured for lessons that set it manually.
	"""
	if not isinstance(quiz, str) or not quiz:
		return False

	quiz_row = frappe.db.get_value("LMS Quiz", quiz, ["course", "lesson", "owner"], as_dict=True)
	if not quiz_row:
		return False

	original_user = frappe.session.user
	user = user or original_user
	try:
		# The can_modify_* / get_membership helpers read session.user.
		frappe.session.user = user

		# Global admins and the quiz author may always reach it, even when unlinked.
		if has_moderator_role(user) or quiz_row.owner == user:
			return True

		# Courses the quiz belongs to: the authoritative LMS Quiz.course link plus any
		# lesson that references it via the manually-set quiz_id field. The owning
		# lesson travels with the course so a sequential course can gate the quiz on
		# the same rule as the lesson that embeds it — the quiz id is a bearer handle,
		# so withholding it from the outline would not revoke it from a student who
		# already saw it while the setting was off.
		# Grouped by course, not held as flat (course, lesson) pairs: every check below
		# except the last is course-level, and a quiz embedded in several lessons of one
		# course would otherwise repeat the membership read and the whole lock chain per
		# lesson for a set that cannot differ between them.
		placements = {}
		if quiz_row.course:
			placements.setdefault(quiz_row.course, set()).add(quiz_row.lesson)
		for row in frappe.get_all("Course Lesson", filters={"quiz_id": quiz}, fields=["course", "name"]):
			if row.course:
				placements.setdefault(row.course, set()).add(row.name)
		for course, lessons in placements.items():
			if can_modify_course(course):
				return True
			if not get_membership(course, user):
				continue
			locked = get_locked_lessons(course)
			if not locked:
				return True
			# Under the gate a placement with no owning lesson cannot be checked against
			# the lock set at all: cleanup_lesson_backreferences clears LMS Quiz.lesson
			# and leaves .course standing, and `None not in locked` is true of every
			# course, so such a placement used to grant any enrolled member access to a
			# quiz whose lesson is still locked. It grants nothing now.
			if any(lesson and lesson not in locked for lesson in lessons):
				return True

		assessment_batches = frappe.get_all(
			"LMS Assessment",
			filters={"assessment_type": "LMS Quiz", "assessment_name": quiz},
			pluck="parent",
		)
		for batch in assessment_batches:
			if batch and (
				can_modify_batch(batch)
				or frappe.db.exists("LMS Batch Enrollment", {"batch": batch, "member": user})
			):
				return True

		return False
	finally:
		frappe.session.user = original_user


def enforces_lesson_completion(course: str) -> bool:
	"""Whether the sequential lesson gate applies to the current user on this course.

	Course authors and moderators are exempt (they have no enrollment, so gating would
	park them on the first lesson), and so is anyone who is not enrolled — sequencing
	is meaningless without progress, and their access is already decided by
	include_in_preview.
	"""
	if not isinstance(course, str) or not course:
		return False
	if not frappe.db.get_value("LMS Course", course, "enforce_lesson_completion"):
		return False
	if can_modify_course(course):
		return False
	return bool(get_membership(course))


def _lock_state(course: str) -> tuple[set, list, set]:
	"""``(locked names, every name in course order, completed names)``.

	Reads no enrollment pointer: SCORMRenderer runs the lock check on every asset
	request of a package, and only needs the lock set.
	"""
	if not enforces_lesson_completion(course):
		return set(), [], set()

	# Local import: utils imports from permissions at call time, so importing utils at
	# module load would create a cycle (same reason get_lesson imports this lazily).
	from lms.lms.utils import compute_locked_lessons, get_completed_lessons, get_ordered_lesson_rows

	rows = get_ordered_lesson_rows(course)
	completed = get_completed_lessons(course, rows)
	names = [row.name for row in rows]
	return compute_locked_lessons(names, completed), names, completed


def get_lesson_gate(course: str) -> tuple[set, str | None]:
	"""``(locked lesson names, the lesson to resume at)`` for the current user.

	The resume lesson is derived from the same ordered list that produced the lock set:
	the first incomplete lesson, which the rule leaves open by construction. The
	LMS Enrollment pointer is only a hint and is used only when it is itself unlocked —
	save_progress wrote it under whatever rules applied at the time (the setting may
	have been off, the chapters may have been reordered since), so trusting it blindly
	can redirect a student to a lesson that is locked, which is a dead end.

	Both values are empty/None when the gate does not apply to this user.
	"""
	locked, names, completed = _lock_state(course)
	if not names:
		return locked, None

	resume = None
	for name in names:
		if name not in completed:
			resume = name
			break
	# Every lesson is complete, so nothing is locked and the first lesson is as good a
	# landing spot as any.
	if resume is None:
		resume = names[0]

	pointer = frappe.db.get_value(
		"LMS Enrollment", {"course": course, "member": frappe.session.user}, "current_lesson"
	)
	if pointer and pointer not in locked:
		resume = pointer

	return locked, resume


def get_locked_lessons(course: str) -> set:
	"""Lesson names the current user may not open yet. Empty when the gate does not apply."""
	return _lock_state(course)[0]


def file_has_permission(doc, ptype="read", user=None):
	"""File has_permission hook: deny-only tightening for instructor-only lesson files.

	For private Files attached to a Course Lesson via instructor_content /
	instructor_notes, deny ALL access (read and authoring) to anyone who cannot
	author the course. For every other File, return True (no opinion) so the
	student/native serving path is unaffected.

	Instructor-only access == can author the course == can_access_lesson with
	instructor_only=True, so delegate to it (the single source of truth) rather
	than re-implementing the course lookup / session swap. This is fail-closed: a
	missing/deleted owning lesson makes can_access_lesson return False, denying the
	orphaned instructor file.
	"""
	user = user or frappe.session.user

	if doc.attached_to_doctype != "Course Lesson":
		return True
	if doc.attached_to_field not in INSTRUCTOR_FIELDS:
		return True

	if can_access_lesson(doc.attached_to_name, instructor_only=True, user=user):
		return True

	frappe.logger("lms.security").warning(
		"Lesson resource access denied: user=%s file=%s field=%s lesson=%s",
		user,
		doc.name,
		doc.attached_to_field,
		doc.attached_to_name,
	)
	return False
