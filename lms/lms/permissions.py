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
from frappe.query_builder import Bracket
from pypika import Case
from pypika import functions as fn
from pypika.terms import LiteralValue

from lms.lms.utils import (
	can_modify_batch,
	can_modify_course,
	get_membership,
	guest_access_allowed,
	has_moderator_role,
	moderators_among,
)

# File fields that hold instructor-only lesson media (never served to students).
INSTRUCTOR_FIELDS = {"instructor_content", "instructor_notes"}

# The ptypes the LMS Course read rule answers. Every other ptype is authoring: write,
# delete and create, and also share, report, export and email, each of which either
# moves authority or hands out a whole row.
COURSE_READ_PTYPES = ("read", "select", "print")

# Rows that belong to one learner and to the authors of one course. The value is the
# field naming the learner. LMS Course Review has no member field; its controller keys
# enrollment and uniqueness on `owner`, so the rule does too.
COURSE_RECORD_MEMBER_FIELDS = {
	"LMS Course Progress": "member",
	"LMS Video Watch Duration": "member",
	"LMS Course Review": "owner",
}


def can_author_course(course: str, *, user: str | None = None) -> bool:
	"""``can_modify_course`` for an explicit user: a site administrator, a Moderator, or a
	Course Instructor row."""
	if not isinstance(course, str) or not course:
		return False
	if is_site_administrator(user):
		return True

	original_user = frappe.session.user
	try:
		# can_modify_course reads session.user and takes no user argument.
		frappe.session.user = user or original_user
		return bool(can_modify_course(course))
	finally:
		frappe.session.user = original_user


def can_access_course(course: str, *, user: str | None = None) -> bool:
	"""Who may read a course: it is published, they are enrolled, or they author it."""
	if not isinstance(course, str) or not course:
		return False

	published = frappe.db.get_value("LMS Course", course, "published")
	if published is None:
		# A course that is not there is not readable, rather than not decided.
		return False
	if published:
		return True
	if can_author_course(course, user=user):
		return True
	return bool(get_membership(course, user or frappe.session.user))


def course_has_permission(doc, ptype="read", user=None) -> bool:
	"""Single-document counterpart of :func:`course_query_conditions`."""
	user = user or frappe.session.user

	if doc.is_new():
		# frappe checks "create" at model/document.py:731, before set_new_name() at
		# :735 -- there is no name and no Course Instructor row yet (that is written
		# later, in validate()). Creation stays governed by the DocPerm grant.
		return True

	if ptype in COURSE_READ_PTYPES:
		return can_access_course(doc.name, user=user)

	if can_author_course(doc.name, user=user):
		return True

	frappe.logger("lms.security").warning(
		"Course authoring denied: user=%s course=%s ptype=%s", user, doc.name, ptype
	)
	return False


def course_query_conditions(user=None) -> str:
	"""List-read counterpart of :func:`course_has_permission`'s read branch, as SQL."""
	condition = _course_read_condition(user)
	return _render(condition) if condition else ""


def _course_read_condition(user=None):
	user = user or frappe.session.user
	if is_site_administrator(user) or "Moderator" in frappe.get_roles(user):
		return None

	course = frappe.qb.DocType("LMS Course")
	instructor = frappe.qb.DocType("Course Instructor")
	enrollment = frappe.qb.DocType("LMS Enrollment")
	member = LiteralValue(frappe.db.escape(user))
	taught = (
		frappe.qb.from_(instructor)
		.select(instructor.parent)
		.where((instructor.instructor == member) & (instructor.parenttype == "LMS Course"))
	)
	enrolled = frappe.qb.from_(enrollment).select(enrollment.course).where(enrollment.member == member)
	return Bracket((course.published == 1) | course.name.isin(taught) | course.name.isin(enrolled))


def _render(condition) -> str:
	return condition.get_sql(with_namespace=True, quote_char="`" if frappe.db.db_type == "mariadb" else '"')


def chapter_has_permission(doc, ptype="read", user=None) -> bool:
	"""Single-document counterpart of :func:`chapter_query_conditions`: the
	``LMS Course`` rule applied to ``doc.course``. Author is checked first so a
	Moderator keeps access to a chapter whose course is gone."""
	course = doc.get("course")
	if not course:
		# A new row defers to validate()'s mandatory check; a saved one is denied
		# unless the list layer doesn't narrow this user either.
		return doc.is_new() or not chapter_query_conditions(user)

	# Authorise against the stored course too, or a submitted `course` moves the row.
	stored = None if doc.is_new() else frappe.db.get_value("Course Chapter", doc.name, "course")
	courses = (course, stored) if stored and stored != course else (course,)
	if all(can_author_course(c, user=user) for c in courses):
		return True

	if ptype in COURSE_READ_PTYPES:
		return can_access_course(stored or course, user=user)

	frappe.logger("lms.security").warning(
		"Chapter authoring denied: user=%s chapter=%s course=%s ptype=%s",
		user or frappe.session.user,
		doc.name,
		course,
		ptype,
	)
	return False


def chapter_query_conditions(user=None) -> str:
	"""List-read counterpart of :func:`chapter_has_permission`'s read branch, as SQL.
	A chapter whose course row is gone matches nothing."""
	condition = _course_read_condition(user)
	if not condition:
		return ""

	chapter = frappe.qb.DocType("Course Chapter")
	course = frappe.qb.DocType("LMS Course")
	readable = frappe.qb.from_(course).select(course.name).where(condition)
	return _render(chapter.course.isin(readable))


def can_author_batch(batch: str | None, *, user: str | None = None) -> bool:
	"""A site administrator, a Moderator, or a user the stored batch tags as an
	instructor or as the evaluator of one of its courses."""
	user = user or frappe.session.user
	if is_site_administrator(user) or has_moderator_role(user):
		return True
	# A deleted batch leaves its Course Instructor / Batch Course rows behind.
	if not isinstance(batch, str) or not batch or not frappe.db.exists("LMS Batch", batch):
		return False

	tagged = {"parent": batch, "parenttype": "LMS Batch"}
	return bool(
		frappe.db.exists("Course Instructor", {**tagged, "instructor": user})
		or frappe.db.exists("Batch Course", {**tagged, "evaluator": user})
	)


def course_record_has_permission(doc, ptype="read", user=None) -> bool:
	"""Single-document counterpart of :func:`course_record_query_conditions`: a
	course progress, watch duration or review row belongs to its learner and to
	the authors of its course."""
	user = user or frappe.session.user
	if _course_read_condition(user) is None:
		# Administrator or Moderator: the query side does not narrow them either.
		return True

	member_field = COURSE_RECORD_MEMBER_FIELDS.get(doc.doctype)
	# A saved row is judged by its STORED values, or relabelling `member`/`course`
	# in the same request would move it into the caller's reach.
	stored = (
		None
		if doc.is_new()
		else frappe.db.get_value(doc.doctype, doc.name, [member_field or "name", "course"], as_dict=True)
	)
	source = stored or doc
	if member_field and source.get(member_field) == user and doc.get(member_field) == user:
		# The learner's own row. DocPerm still decides whether they may write it.
		return True

	course = source.get("course") if stored else _course_of_new_record(doc)
	if not course and doc.is_new():
		# Let _validate_mandatory refuse it with a friendlier message.
		return True

	moved_to = doc.get("course") if stored and doc.get("course") != course else None
	if course and all(can_author_course(c, user=user) for c in (course, moved_to) if c):
		return True

	frappe.logger("lms.security").warning(
		"Course record denied: user=%s doctype=%s name=%s course=%s ptype=%s",
		user,
		doc.doctype,
		doc.name,
		course,
		ptype,
	)
	return False


def _course_of_new_record(doc) -> str | None:
	if course := doc.get("course"):
		return course
	if lesson := doc.get("lesson"):
		return frappe.db.get_value("Course Lesson", lesson, "course")
	return None


def course_record_query_conditions(user=None, doctype=None) -> str:
	"""List-read counterpart of :func:`course_record_has_permission`, as SQL."""
	member_field = COURSE_RECORD_MEMBER_FIELDS.get(doctype)
	if not member_field:
		# "" is the list engine's spelling of "no restriction", so a doctype this
		# function does not gate has to refuse explicitly rather than by accident.
		return "1 = 0"

	user = user or frappe.session.user
	if _course_read_condition(user) is None:
		return ""

	record = frappe.qb.DocType(doctype)
	instructor = frappe.qb.DocType("Course Instructor")
	member = LiteralValue(frappe.db.escape(user))
	taught = (
		frappe.qb.from_(instructor)
		.select(instructor.parent)
		.where((instructor.instructor == member) & (instructor.parenttype == "LMS Course"))
	)
	condition = Bracket((getattr(record, member_field) == member) | record.course.isin(taught))
	return _render(condition)


def _unrestricted_coupon_access(user: str) -> bool:
	return is_site_administrator(user) or "Moderator" in frappe.get_roles(user)


def coupon_has_permission(doc, ptype="read", user=None) -> bool:
	"""A coupon belongs to whoever authors every course/batch its items name."""
	user = user or frappe.session.user
	if _unrestricted_coupon_access(user):
		return True

	incoming = doc.get("applicable_items") or []
	if doc.is_new():
		# reference_name is reqd; a half-filled row defers to _validate_mandatory.
		incoming = [item for item in incoming if item.get("reference_name")]

	targets = {(item.get("reference_doctype"), item.get("reference_name")) for item in incoming}
	targets |= _stored_coupon_targets(doc)
	if not targets:
		# A saved coupon naming nothing is unresolvable; a new one defers to validate().
		return doc.is_new()

	denied = targets - _authored_coupon_targets(targets, user)
	if denied:
		frappe.logger("lms.security").warning(
			"Coupon denied: user=%s coupon=%s targets=%s ptype=%s", user, doc.name, list(denied), ptype
		)
		return False

	return True


def _stored_coupon_targets(doc) -> set:
	"""The coupon's rows as the database holds them, not the caller's in-memory ones --
	or a write could repoint someone else's coupon at the caller's own course."""
	if doc.is_new():
		return set()

	rows = frappe.get_all(
		"LMS Coupon Item",
		filters={"parent": doc.name, "parenttype": "LMS Coupon"},
		fields=["reference_doctype", "reference_name"],
	)
	return {(row.reference_doctype, row.reference_name) for row in rows}


COUPON_TARGET_DOCTYPES = ("LMS Course", "LMS Batch")


def _taught(doctype: str, user: str):
	"""Names of existing `doctype` rows `user` instructs. Joining the parent drops
	Course Instructor rows a deleted course/batch left behind."""
	instructor = frappe.qb.DocType("Course Instructor")
	parent = frappe.qb.DocType(doctype)
	return (
		frappe.qb.from_(instructor)
		.join(parent)
		.on(parent.name == instructor.parent)
		.select(instructor.parent)
		.where(
			(instructor.instructor == LiteralValue(frappe.db.escape(user)))
			& (instructor.parenttype == doctype)
		)
	)


def _authored_coupon_targets(targets: set, user: str) -> set:
	authored = set()
	for doctype in COUPON_TARGET_DOCTYPES:
		names = [name for target_doctype, name in targets if target_doctype == doctype and name]
		if names:
			instructor = frappe.qb.DocType("Course Instructor")
			rows = _taught(doctype, user).where(instructor.parent.isin(names)).run(pluck=True)
			authored.update((doctype, name) for name in rows)
	return authored


def coupon_query_conditions(user=None) -> str:
	"""List-read counterpart of :func:`coupon_has_permission`, as SQL. A coupon with
	no items forms no group and is not listed -- the same fail-closed answer as above."""
	user = user or frappe.session.user
	if _unrestricted_coupon_access(user):
		return ""

	item = frappe.qb.DocType("LMS Coupon Item")
	is_authored = (
		Case()
		.when(
			(item.reference_doctype == "LMS Course") & item.reference_name.isin(_taught("LMS Course", user)),
			1,
		)
		.when(
			(item.reference_doctype == "LMS Batch") & item.reference_name.isin(_taught("LMS Batch", user)), 1
		)
		.else_(0)
	)
	authored_coupons = (
		frappe.qb.from_(item)
		.where(item.parenttype == "LMS Coupon")
		.groupby(item.parent)
		.having(fn.Count(item.name) == fn.Sum(is_authored))
		.select(item.parent)
	)
	coupon = frappe.qb.DocType("LMS Coupon")
	return _render(coupon.name.isin(authored_coupons))


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


def courses_authored_by_each(users, courses) -> dict[str, set[str]]:
	"""courses_authored_by for several users at once: a fixed two queries, not one per user.

	serve_resource judges one owner per File row sharing a url, so calling the
	single-user helper per owner puts a query in that loop."""
	courses = {course for course in courses or [] if course}
	users = {user for user in users or [] if user}
	if not courses or not users:
		return {}

	# A moderator authors every course; so does Administrator (courses_authored_by).
	authors_everything = moderators_among(users) | (users & {"Administrator"})
	authored = {user: set(courses) for user in authors_everything}

	rest = users - authors_everything
	if not rest:
		return authored

	for row in frappe.db.get_all(
		"Course Instructor",
		filters={
			"instructor": ("in", list(rest)),
			"parent": ("in", list(courses)),
			"parenttype": "LMS Course",
		},
		fields=["instructor", "parent"],
	):
		authored.setdefault(row.instructor, set()).add(row.parent)

	return authored


def resolve_lesson_course(lesson: str) -> str | None:
	"""The course a stored lesson is filed under, resolved through its chapter.

	Never `Course Lesson.course`: it is a read-only `fetch_from: chapter.course` mirror,
	and fetch_from is copy-on-save, so re-pointing a chapter at another course leaves
	every lesson under it naming the course it has already left. The chapter is the
	field that moves, so the chapter is the field to read.

	Returns None when the lesson is gone, has no chapter, or names no existing chapter.
	Anything built on this reads that as "no course", which denies everyone but a
	Moderator. The type guard is not decoration: get_value's second argument is
	`filters`, so a mapping would be matched against the whole table and resolve an
	arbitrary lesson.
	"""
	if not isinstance(lesson, str) or not lesson:
		return None

	chapter = frappe.db.get_value("Course Lesson", lesson, "chapter")
	if not chapter:
		return None
	return frappe.db.get_value("Course Chapter", chapter, "course") or None


def can_access_quiz(quiz: str, *, user: str | None = None) -> bool:
	"""Who may read a quiz's questions and answers, for the two whitelisted endpoints.
	Delegates to can_access_assessment so the endpoint and the has_permission hook
	share one reading; kept as a name since lms_quiz.py and utils.py still call it."""
	return can_access_assessment("LMS Quiz", quiz, user=user)


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


# Doctypes an assessment placement can name; anything else is refused outright.
ASSESSMENT_DOCTYPES = ("LMS Quiz", "LMS Assignment", "LMS Programming Exercise")

# Doctypes carrying a pre-placement-table course stamp. LMS Programming Exercise
# has no course field at all.
LEGACY_STAMP_DOCTYPES = ("LMS Quiz", "LMS Assignment")

# The empty-set spelling of "no assessment is administrable", for a subquery with
# no table to select from.
NO_ASSESSMENT_NAMES = "select null from dual where 1 = 0"


def can_access_assessment(doctype: str, name: str, *, user: str | None = None) -> bool:
	"""Who may read an assessment: its author, a course that places it, or a batch
	that runs it. Enrolled members are further gated by the sequential lesson lock,
	which :func:`_assessment_query_conditions` cannot express."""
	return _assessment_answer(doctype, name, user, include_members=True)


def can_administer_assessment(doctype: str, name: str, *, user: str | None = None) -> bool:
	"""``can_access_assessment`` with both enrolled-member branches removed.
	Submissions compose on this one: every enrolled member is a member, so the wider
	reading would hand a student every other student's work."""
	return _assessment_answer(doctype, name, user, include_members=False)


# The ptypes that read an assessment rather than author it, matching Course Lesson's
# own hook. Everything else — write, delete, share, export, report, email — takes the
# instructor reading, so an enrolled member reaches the content and nothing more.
ASSESSMENT_READ_PTYPES = ("read", "select", "print")


def assessment_has_permission(doc, ptype="read", user=None):
	"""Document half of the assessment pair, registered for all three doctypes.

	The doctype is read off the document rather than taken per registration: a quiz,
	an assignment and a programming exercise are one sentence here, and three wrappers
	would be three places for it to drift.

	A brand-new document returns no opinion: its scope lives entirely in rows that
	name it — LMS Lesson Assessment placements and a batch's LMS Assessment rows —
	and a document with no name yet has nothing for them to point at, so the
	DocPerm grant governs. `ptype == "create"` alone is not that signal: inserting
	a child row (a question, a test case, an `authors` entry) onto an *existing*
	assessment reaches this same hook with ptype="create" and the existing parent
	attached, and must be checked as administering that parent, not waved through.
	"""
	if doc.doctype not in ASSESSMENT_DOCTYPES:
		return True
	if doc.is_new():
		return True

	user = user or frappe.session.user
	if ptype in ASSESSMENT_READ_PTYPES:
		return can_access_assessment(doc.doctype, doc.name, user=user)
	return can_administer_assessment(doc.doctype, doc.name, user=user)


def _assessment_answer(doctype: str, name: str, user: str | None, *, include_members: bool) -> bool:
	"""Site admin, moderator or content author, then a course that places it, then
	a batch that runs it."""
	if doctype not in ASSESSMENT_DOCTYPES or not isinstance(name, str) or not name:
		return False
	if not frappe.db.exists(doctype, name):
		return False

	original_user = frappe.session.user
	user = user or original_user
	try:
		# The can_modify_* / get_membership helpers read session.user.
		frappe.session.user = user
		if is_site_administrator(user) or has_moderator_role(user) or is_content_author(doctype, name, user):
			return True
		return _reaches_through_a_course(
			doctype, name, user, include_members=include_members
		) or _reaches_through_a_batch(doctype, name, user, include_members=include_members)
	finally:
		frappe.session.user = original_user


def _reaches_through_a_course(doctype: str, name: str, user: str, *, include_members: bool) -> bool:
	"""Whether any course this assessment is placed in grants `user`: one query for
	every candidate course's Course Instructor row, not one per course."""
	placements = _course_placements(doctype, name)
	courses = set(placements) | _author_only_courses(doctype, name)
	if not courses:
		return False

	instructor = frappe.qb.DocType("Course Instructor")
	if _taught("LMS Course", user).where(instructor.parent.isin(courses)).run(pluck=True):
		return True
	if not include_members:
		return False

	enrolled = _enrolled_in(set(placements), user)
	return any(
		_member_reaches_a_placement(course, lessons)
		for course, lessons in placements.items()
		if course in enrolled
	)


def _enrolled_in(courses: set, user: str) -> set:
	"""Which of `courses` `user` is enrolled in -- one query for every candidate
	course, not one per course."""
	if not courses:
		return set()
	return set(
		frappe.get_all(
			"LMS Enrollment",
			filters={"member": user, "course": ("in", list(courses))},
			pluck="course",
		)
	)


def _member_reaches_a_placement(course: str, lessons: set) -> bool:
	"""An already-enrolled member reaches it through a lesson the sequential gate
	leaves open."""
	locked = get_locked_lessons(course)
	# A placement with no owning lesson cannot be checked against the lock set at all:
	# `None not in locked` is true of every course, which would grant a still-locked
	# assessment to any enrolled member.
	return not locked or any(lesson and lesson not in locked for lesson in lessons)


def _reaches_through_a_batch(doctype: str, name: str, user: str, *, include_members: bool) -> bool:
	"""Whether any batch running this assessment grants `user`: instructor, tagged
	evaluator, or (when include_members) an enrolled student."""
	batches = _running_batches(doctype, name)
	if not batches:
		return False

	instructor = frappe.qb.DocType("Course Instructor")
	if _taught("LMS Batch", user).where(instructor.parent.isin(batches)).run(pluck=True):
		return True
	if frappe.get_all(
		"Batch Course",
		filters={"evaluator": user, "parenttype": "LMS Batch", "parent": ("in", batches)},
		limit=1,
	):
		return True
	if not include_members:
		return False
	return bool(
		frappe.get_all("LMS Batch Enrollment", filters={"batch": ("in", batches), "member": user}, limit=1)
	)


def _running_batches(doctype: str, name: str) -> list:
	"""Batches whose assessment list references this assessment, joined against
	LMS Batch so a deleted batch's stray row is dropped."""
	assessment = frappe.qb.DocType("LMS Assessment")
	batch = frappe.qb.DocType("LMS Batch")
	return (
		frappe.qb.from_(assessment)
		.join(batch)
		.on(batch.name == assessment.parent)
		.select(assessment.parent)
		.where((assessment.assessment_type == doctype) & (assessment.assessment_name == name))
	).run(pluck=True)


def _resolve_lesson_courses(lessons: list) -> dict:
	"""``{lesson: course}`` for every lesson in `lessons`, resolved through its
	chapter like :func:`resolve_lesson_course` -- one query for the whole set."""
	if not lessons:
		return {}
	lesson = frappe.qb.DocType("Course Lesson")
	chapter = frappe.qb.DocType("Course Chapter")
	rows = (
		frappe.qb.from_(lesson)
		.join(chapter)
		.on(chapter.name == lesson.chapter)
		.select(lesson.name, chapter.course)
		.where(lesson.name.isin(lessons))
	).run(as_dict=True)
	return {row.name: row.course for row in rows if row.course}


def _course_placements(doctype: str, name: str) -> dict:
	"""``{course: {lesson, ...}}`` for every course a student-visible lesson places
	it in, plus (for a quiz) the lessons naming it by the hand-set `quiz_id`."""
	lessons = _placement_lessons(doctype, name, instructor_only=0)
	if doctype == "LMS Quiz":
		lessons = lessons + frappe.get_all("Course Lesson", filters={"quiz_id": name}, pluck="name")

	placements = {}
	for lesson, course in _resolve_lesson_courses(lessons).items():
		placements.setdefault(course, set()).add(lesson)
	return placements


def _author_only_courses(doctype: str, name: str) -> set:
	"""Courses that reach this assessment only through authorship: an
	instructor_only placement, or the pre-placement-table course stamp."""
	lessons = _placement_lessons(doctype, name, instructor_only=1)
	courses = set(_resolve_lesson_courses(lessons).values())
	_add_legacy_stamp_course(doctype, name, courses)
	return courses


def _placement_lessons(doctype: str, name: str, *, instructor_only: int) -> list:
	"""The lessons placing this assessment, from the table a lesson save rebuilds."""
	return frappe.get_all(
		"LMS Lesson Assessment",
		filters={
			"assessment_type": doctype,
			"assessment_name": name,
			"parenttype": "Course Lesson",
			"instructor_only": instructor_only,
		},
		pluck="parent",
	)


def _add_legacy_stamp_course(doctype: str, name: str, courses: set):
	"""Fold in the pre-placement-table course stamp, which only ever grants an
	author. The stamp's own lesson wins over the stamped course whenever it
	resolves; the stamped course is the fallback."""
	if doctype not in LEGACY_STAMP_DOCTYPES:
		return
	# LMS Assignment has a course and no lesson: its course is author-picked, so
	# there was never a lesson stamp to resolve through.
	fields = ["course", "lesson"] if doctype == "LMS Quiz" else ["course"]
	stamp = frappe.db.get_value(doctype, name, fields, as_dict=True)
	resolved = resolve_lesson_course(stamp.lesson) if stamp.get("lesson") else None
	course = resolved or stamp.course
	if course:
		courses.add(course)


def quiz_query_conditions(user: str | None = None) -> str:
	return _assessment_query_conditions("LMS Quiz", user)


def assignment_query_conditions(user: str | None = None) -> str:
	return _assessment_query_conditions("LMS Assignment", user)


def programming_exercise_query_conditions(user: str | None = None) -> str:
	return _assessment_query_conditions("LMS Programming Exercise", user)


def _assessment_query_conditions(doctype: str, user: str | None = None) -> str:
	"""``can_access_assessment`` as SQL, for the list read a has_permission hook
	never sees. The sequential lesson lock is deliberately absent: it is not a
	WHERE fragment, so a locked assessment is listed and refused when opened."""
	if doctype not in ASSESSMENT_DOCTYPES:
		# "" is the list engine's spelling of "no restriction", so an ungated
		# doctype has to refuse rather than return the value that opens it.
		return "1 = 0"

	user = user or frappe.session.user
	if _is_unrestricted(user):
		return ""
	assessment = frappe.qb.DocType(doctype)
	condition = _assessment_reach_condition(doctype, assessment, user, include_members=True)
	return _render(condition)


def administrable_assessment_names(doctype: str, user: str | None = None) -> str:
	"""``can_administer_assessment`` as SQL: a bare ``select`` for a submission's
	query condition to nest in an ``in (...)``. No enrolled-member branch, same as
	:func:`can_administer_assessment`."""
	if doctype not in ASSESSMENT_DOCTYPES:
		return NO_ASSESSMENT_NAMES
	return _administrable_assessment_query(doctype, user).get_sql()


def _administrable_assessment_query(doctype: str, user: str | None = None):
	"""qb form of :func:`administrable_assessment_names`, kept as a query object
	so a caller can nest it with ``isin`` instead of re-parsing rendered SQL."""
	assessment = frappe.qb.DocType(doctype)
	user = user or frappe.session.user
	query = frappe.qb.from_(assessment).select(assessment.name)
	if not _is_unrestricted(user):
		condition = _assessment_reach_condition(doctype, assessment, user, include_members=False)
		query = query.where(condition)
	return query


def _is_unrestricted(user: str) -> bool:
	"""Whoever the assessment rule never narrows: a site administrator or a Moderator."""
	return is_site_administrator(user) or bool(has_moderator_role(user))


# doctype -> (the assessment doctype it answers, the field naming it).
SUBMISSION_ASSESSMENT_FIELDS = {
	"LMS Quiz Submission": ("LMS Quiz", "quiz"),
	"LMS Assignment Submission": ("LMS Assignment", "assignment"),
	"LMS Programming Exercise Submission": ("LMS Programming Exercise", "exercise"),
}


def quiz_submission_query_conditions(user: str | None = None) -> str:
	return _assessment_submission_query_conditions("LMS Quiz Submission", user)


def assignment_submission_query_conditions(user: str | None = None) -> str:
	return _assessment_submission_query_conditions("LMS Assignment Submission", user)


def programming_exercise_submission_query_conditions(user: str | None = None) -> str:
	return _assessment_submission_query_conditions("LMS Programming Exercise Submission", user)


def _assessment_submission_query_conditions(doctype: str, user: str | None = None) -> str:
	"""Own submissions, plus every submission of an assessment the caller administers.
	Nests _administrable_assessment_query's builder object directly, so the whole
	condition renders once, at the end."""
	assessment_doctype, field = SUBMISSION_ASSESSMENT_FIELDS[doctype]
	user = user or frappe.session.user
	if _is_unrestricted(user):
		return ""
	submission = frappe.qb.DocType(doctype)
	member = LiteralValue(frappe.db.escape(user))
	administrable = _administrable_assessment_query(assessment_doctype, user)
	condition = Bracket((submission.member == member) | getattr(submission, field).isin(administrable))
	return _render(condition)


def assessment_submission_has_permission(doc, ptype: str | None = None, user: str | None = None) -> bool:
	"""Doc half of the submission pair: a submission belongs to its own member and to
	whoever administers the assessment it answers.

	Matches course_record_has_permission's stored-vs-submitted handling: `member`
	must match in both the stored row and the value being saved, since reading only
	the in-memory one would let a save claim someone else's row by naming them.
	Administering requires both the stored assessment and the submitted one (when
	the save repoints it), since reading only the submitted one would let a caller
	borrow rights over an assessment they administer to reach a row that answers one
	they do not.
	"""
	if doc is None or doc.get("__islocal") or not doc.get("name"):
		return True
	user = user or frappe.session.user
	if _is_unrestricted(user):
		return True
	mapping = SUBMISSION_ASSESSMENT_FIELDS.get(doc.doctype)
	if not mapping:
		return False
	assessment_doctype, field = mapping
	stored = frappe.db.get_value(doc.doctype, doc.name, ["member", field], as_dict=True)
	if not stored:
		return False
	if stored.member == user and doc.get("member") == user:
		return True
	name = stored.get(field)
	moved_to = doc.get(field) if doc.get(field) != name else None
	if name and all(
		can_administer_assessment(assessment_doctype, n, user=user) for n in (name, moved_to) if n
	):
		return True
	return False


def _assessment_reach_condition(doctype: str, assessment, user: str, *, include_members: bool) -> Bracket:
	"""The reach sentence as one bracketed OR. The administer reading shares this
	builder with the access reading, just with the member branches left out, so
	the two cannot drift apart."""
	conditions = [_authored_condition(doctype, assessment, user)]
	conditions.extend(_course_conditions(doctype, assessment, user, include_members=include_members))
	conditions.append(_batch_condition(doctype, assessment, user, include_members=include_members))
	combined = conditions[0]
	for condition in conditions[1:]:
		combined = combined | condition
	return Bracket(combined)


def _authored_condition(doctype: str, assessment, user: str):
	"""SQL mirror of :func:`is_content_author`: a stored `authors` row naming
	`user`, or -- only when the row carries no `authors` rows at all -- its owner."""
	author = frappe.qb.DocType("LMS Content Author")
	named_doctype = LiteralValue(frappe.db.escape(doctype))
	named_field = LiteralValue(frappe.db.escape("authors"))
	member = LiteralValue(frappe.db.escape(user))

	def _authors_for(*extra):
		query = (
			frappe.qb.from_(author)
			.select(author.parent)
			.where((author.parenttype == named_doctype) & (author.parentfield == named_field))
		)
		for condition in extra:
			query = query.where(condition)
		return query

	is_named_author = assessment.name.isin(_authors_for(author.author == member))
	has_no_authors = assessment.name.notin(_authors_for())
	return is_named_author | (has_no_authors & (assessment.owner == member))


def _course_conditions(doctype: str, assessment, user: str, *, include_members: bool) -> list:
	"""Every way a course reaches this assessment. Authoring sees a student
	placement, an instructor_only one and the legacy stamp -- all author-only.
	Enrolment sees only the student-visible placement."""
	# Each subquery gets its own `_taught`/`_enrolled_courses` call rather than one
	# shared object: embedding the same query builder in several isin() clauses of
	# one tree is untested territory this module does not otherwise rely on.
	conditions = [
		_placed_in_a_lesson(doctype, assessment, _taught("LMS Course", user), student_visible_only=False)
	]
	if doctype == "LMS Quiz":
		conditions.append(_placed_by_quiz_id(assessment, _taught("LMS Course", user)))
	legacy = _legacy_stamp_condition(doctype, assessment, _taught("LMS Course", user))
	if legacy is not None:
		conditions.append(legacy)

	if include_members:
		conditions.append(
			_placed_in_a_lesson(doctype, assessment, _enrolled_courses(user), student_visible_only=True)
		)
		if doctype == "LMS Quiz":
			conditions.append(_placed_by_quiz_id(assessment, _enrolled_courses(user)))
	return conditions


def _enrolled_courses(user: str):
	"""The courses `user` is enrolled in, as a subquery."""
	enrollment = frappe.qb.DocType("LMS Enrollment")
	return (
		frappe.qb.from_(enrollment)
		.select(enrollment.course)
		.where(enrollment.member == LiteralValue(frappe.db.escape(user)))
	)


def _placed_in_a_lesson(doctype: str, assessment, courses, *, student_visible_only: bool):
	"""Placement rows whose lesson resolves, through its chapter, into `courses` --
	never through Course Lesson.course, which is a stale copy-on-save mirror."""
	la = frappe.qb.DocType("LMS Lesson Assessment")
	cl = frappe.qb.DocType("Course Lesson")
	cc = frappe.qb.DocType("Course Chapter")
	subquery = (
		frappe.qb.from_(la)
		.join(cl)
		.on(cl.name == la.parent)
		.join(cc)
		.on(cc.name == cl.chapter)
		.select(la.assessment_name)
		.where(
			(la.parenttype == "Course Lesson")
			& (la.assessment_type == LiteralValue(frappe.db.escape(doctype)))
			& cc.course.isin(courses)
		)
	)
	if student_visible_only:
		subquery = subquery.where(la.instructor_only == 0)
	return assessment.name.isin(subquery)


def _placed_by_quiz_id(assessment, courses):
	"""Course Lesson.quiz_id, a hand-set field nothing auto-populates and a placement."""
	cl = frappe.qb.DocType("Course Lesson")
	cc = frappe.qb.DocType("Course Chapter")
	subquery = (
		frappe.qb.from_(cl)
		.join(cc)
		.on(cc.name == cl.chapter)
		.select(cl.quiz_id)
		.where(cc.course.isin(courses))
	)
	return assessment.name.isin(subquery)


def _legacy_stamp_condition(doctype: str, assessment, courses):
	"""The pre-placement-table stamp: the stamp's own lesson wins whenever it
	resolves, and the stamped course is only the fallback. None for a doctype
	with neither column."""
	if doctype not in LEGACY_STAMP_DOCTYPES:
		return None

	if doctype == "LMS Quiz":
		cl = frappe.qb.DocType("Course Lesson")
		cc = frappe.qb.DocType("Course Chapter")
		lesson_course = (
			frappe.qb.from_(cl)
			.join(cc)
			.on(cc.name == cl.chapter)
			.select(cc.course)
			.where(cl.name == assessment.lesson)
		)
		stamped_course = fn.Coalesce(lesson_course, assessment.course)
	else:
		# LMS Assignment has a course and no lesson: its course is author-picked,
		# so there was never a lesson stamp beside it to resolve through.
		stamped_course = assessment.course
	return stamped_course.isin(courses)


def _batch_condition(doctype: str, assessment, user: str, *, include_members: bool):
	"""Batches running this assessment, for their instructors, tagged evaluators
	and (when include_members) enrolled students. Joined against LMS Batch, like
	:func:`_running_batches`, so a deleted batch's stray LMS Assessment row --
	or a Batch Course/LMS Batch Enrollment row left behind with it -- grants
	nothing here either."""
	la = frappe.qb.DocType("LMS Assessment")
	batch = frappe.qb.DocType("LMS Batch")
	reach = la.parent.isin(_taught("LMS Batch", user)) | la.parent.isin(_evaluator_batches(user))
	if include_members:
		enrollment = frappe.qb.DocType("LMS Batch Enrollment")
		member_batches = (
			frappe.qb.from_(enrollment)
			.select(enrollment.batch)
			.where(enrollment.member == LiteralValue(frappe.db.escape(user)))
		)
		reach = reach | la.parent.isin(member_batches)

	subquery = (
		frappe.qb.from_(la)
		.join(batch)
		.on(batch.name == la.parent)
		.select(la.assessment_name)
		.where((la.assessment_type == LiteralValue(frappe.db.escape(doctype))) & reach)
	)
	return assessment.name.isin(subquery)


def _evaluator_batches(user: str):
	"""Batches whose Batch Course tags `user` as evaluator, as a subquery."""
	batch_course = frappe.qb.DocType("Batch Course")
	return (
		frappe.qb.from_(batch_course)
		.select(batch_course.parent)
		.where(
			(batch_course.evaluator == LiteralValue(frappe.db.escape(user)))
			& (batch_course.parenttype == "LMS Batch")
		)
	)
