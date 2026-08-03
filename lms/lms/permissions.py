# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

"""Shared access-control helpers for LMS lesson media.

Centralizes the cross-doctype permission logic that the Course Lesson controller,
the serve_resource endpoint, the SCORM renderer, and the File has_permission hook
all rely on — mirroring the dedicated permissions module pattern used by frappe
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

	quiz_row = frappe.db.get_value("LMS Quiz", quiz, ["course", "owner"], as_dict=True)
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
		# lesson that references it via the manually-set quiz_id field.
		courses = set()
		if quiz_row.course:
			courses.add(quiz_row.course)
		courses.update(frappe.get_all("Course Lesson", filters={"quiz_id": quiz}, pluck="course"))
		for course in courses:
			if course and (can_modify_course(course) or get_membership(course, user)):
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
