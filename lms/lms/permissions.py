# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

"""Shared access-control helpers for LMS lesson media.

Centralizes the cross-doctype permission logic that the Course Lesson controller,
the serve_resource endpoint, the SCORM renderer, and the File has_permission hook
all rely on, mirroring the dedicated permissions module pattern used by frappe
core (frappe/permissions.py), CRM (crm.permissions.*), and Raven (raven.permissions).
"""

import frappe
from frappe import _

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


def courses_authored_by(user: str, courses) -> set[str]:
	"""The subset of `courses` that `user` may author (a moderator authors every one).

	can_modify_course only answers for frappe.session.user; this judges a third party --
	a file's owner -- from the tables, for a whole set in one query."""
	courses = {course for course in courses or [] if course}
	if not courses or not user:
		return set()

	if user == "Administrator" or has_moderator_role(user):
		return courses

	return set(
		frappe.db.get_all(
			"Course Instructor",
			filters={"instructor": user, "parent": ("in", list(courses)), "parenttype": "LMS Course"},
			pluck="parent",
		)
	)


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


# --- Authored content -------------------------------------------------------
#
# LMS Quiz, LMS Programming Exercise, LMS Assignment and LMS Question are one
# shared library that no single course owns, so write narrows to the people named
# in `authors` instead of to a course. Read stays wide: one library, both
# authoring roles, and the student half of the read is a separate rule.

SITE_ADMIN_ROLE = "System Manager"

# `share`, `export` and `report` are deliberately absent: this field records who
# may change the content, not who may pass it on. `create` is here because a child
# row's insert is checked against its PARENT -- has_child_permission ends at
# has_permission(parent, "create", doc=<the parent>) -- so without it any holder of
# the role appends a question, or themselves, to another author's row. `None` is
# absent because get_doc_permissions passes it for "no ptype asked", and refusing
# that returns an empty permission map for a user who genuinely holds read.
NARROWED_PTYPES = ("write", "delete", "create")


def is_site_administrator(user: str | None = None) -> bool:
	"""Whether `user` administers this site rather than authoring one row on it.

	A has_permission hook can only subtract, so a role holding a DocPerm row and
	absent from the predicate is denied silently. This app has locked its site
	administrators out once already -- patches/v2_0/restore_system_manager_perms.py.
	"""
	user = user or frappe.session.user
	return user == "Administrator" or SITE_ADMIN_ROLE in frappe.get_roles(user)


def stored_authors(doctype: str, name: str) -> list[str]:
	"""The `authors` rows as the database holds them, not as a save proposes them.

	Gating on the submitted list would let anyone who can reach the form write
	themselves into the list that decides whether they may write. A row whose
	`author` is empty is dropped: it is still truthy, so it would skip the `owner`
	fallback and lock the creator out of their own row.
	"""
	rows = frappe.get_all(
		"LMS Content Author",
		filters={"parent": name, "parenttype": doctype, "parentfield": "authors"},
		pluck="author",
	)
	return [author for author in rows if author]


def is_content_author(doctype: str, name: str, user: str | None = None) -> bool:
	"""Whether `user` is one of the people responsible for this row.

	The fallback to `owner` is what makes shipping no backfill patch safe: every row
	written before the field existed carries an empty `authors`. It is a fallback
	and not an addition -- once somebody is named, the row has been handed over.
	"""
	user = user or frappe.session.user
	authors = stored_authors(doctype, name)
	if authors:
		return user in authors
	return frappe.db.get_value(doctype, name, "owner") == user


def has_authored_content_permission(doc, ptype: str | None = None, user: str | None = None) -> bool:
	"""has_permission for every doctype carrying `authors`, registered in hooks.py.

	A document with no name is a row being created, which is not scoped: insert
	calls check_permission("create") before set_new_name.
	"""
	if ptype not in NARROWED_PTYPES:
		return True
	user = user or frappe.session.user
	if is_site_administrator(user) or has_moderator_role(user):
		return True
	if doc is None or doc.get("__islocal") or not doc.get("name"):
		return True
	return is_content_author(doc.doctype, doc.name, user)


def refuse_moving_child_rows_out_of_content_the_user_cannot_write(doc, method=None):
	"""doc_events `validate` for the authored content family AND for its child tables.

	One rule -- a row whose stored parent is not the one it is being saved under
	answers to the parent it is leaving -- at the two entry points that reach a child
	row, because neither sees the other's traffic. has_child_permission is only ever
	shown the parent named on the row in hand, so a row saved on its own is checked
	against the destination alone; and a child never fires doc_events when its parent
	saves it, while Document.update_child_table db_updates every submitted row by name
	with no ownership check, so the parent has to ask on the row's behalf.
	"""
	if doc.meta.istable:
		refuse_rows_taken_from_a_parent_the_user_cannot_write(
			doc.doctype, [doc.name], doc.parent, doc.parenttype
		)
		return
	for field in doc.meta.get_table_fields():
		submitted = [row.name for row in doc.get(field.fieldname) or [] if not row.is_new()]
		refuse_rows_taken_from_a_parent_the_user_cannot_write(field.options, submitted, doc.name, doc.doctype)


def refuse_rows_taken_from_a_parent_the_user_cannot_write(
	child_doctype: str, row_names: list[str], parent: str, parenttype: str
):
	"""One SELECT per child table, and one permission check per parent being left."""
	named = [name for name in row_names if name]
	if not named:
		return
	stored_rows = frappe.get_all(
		child_doctype, filters={"name": ("in", named)}, fields=["parent", "parenttype"]
	)
	checked = {}
	for stored in stored_rows:
		source = (stored.parenttype, stored.parent)
		if source == (parenttype, parent):
			continue
		if source not in checked:
			checked[source] = can_write_the_stored_parent(*source)
		if checked[source]:
			continue
		frappe.throw(
			_("You do not have permission to move this row out of {0} {1}").format(
				_(stored.parenttype), stored.parent
			),
			frappe.PermissionError,
		)


def can_write_the_stored_parent(parenttype: str, parent: str) -> bool:
	"""A stored parent that no longer exists is not one anybody may write through.

	has_permission resolves a docname with get_lazy_doc, which throws
	DoesNotExistError for a deleted parent -- so without this the caller gets a 404
	naming somebody else's docname instead of the refusal.
	"""
	if not (parenttype and parent):
		return False
	if not frappe.db.exists(parenttype, parent):
		return False
	return frappe.has_permission(parenttype, "write", doc=parent)
