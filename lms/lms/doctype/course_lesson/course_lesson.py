# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import inspect
import os
from functools import cache
from typing import NamedTuple
from urllib.parse import unquote

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.query_builder.functions import Count, Locate
from frappe.rate_limiter import rate_limit
from frappe.utils import add_to_date, cint, now_datetime
from frappe.utils.response import send_private_file
from frappe.utils.telemetry import capture

from lms.lms.doctype.lms_enrollment.lms_enrollment import (
	batched_enrollment_updates,
	update_enrollment,
)
from lms.lms.lesson_assessments import lesson_assessment_rows
from lms.lms.permissions import (
	INSTRUCTOR_FIELDS,
	can_access_lesson,
	can_author_assessment,
	courses_authored_by_each,
	get_locked_lessons,
	unplaceable_assessments,
)
from lms.lms.utils import (
	PRIVILEGED_ROLES,
	compute_locked_lessons,
	get_course_progress,
	get_editorjs_blocks,
	get_ordered_lesson_rows,
	guest_access_allowed,
	is_demo_course,
	moderators_among,
	recalculate_course_progress,
	sanitize_editorjs,
)

from ...md import find_macros


class CourseLesson(Document):
	def after_insert(self):
		self.validate_progress_recalculation()

	def on_trash(self):
		cleanup_lesson_backreferences(self.name)

	def after_delete(self):
		self.validate_progress_recalculation()

	def validate(self):
		self.content = sanitize_editorjs(self.content)
		self.instructor_content = sanitize_editorjs(self.instructor_content)
		self.sync_lesson_assessments()

	def sync_lesson_assessments(self):
		"""Rebuild this lesson's placement rows from its own content, never hand-edited.
		Runs in validate, not on_update: child rows are written during save, so an
		on_update append would persist nothing."""
		rows = lesson_assessment_rows(self.body, self.content, self.instructor_content)
		self.validate_added_placements(rows)
		self.set("assessments", [])
		for row in rows:
			self.append("assessments", row)

	def validate_added_placements(self, rows):
		"""A lesson may newly place only assessments its editor can already administer,
		the same rule a batch applies. Placements the lesson already had stay as they are."""
		placements = {(row["assessment_type"], row["assessment_name"]) for row in rows}
		if self.quiz_id and frappe.db.exists("LMS Quiz", self.quiz_id):
			placements.add(("LMS Quiz", self.quiz_id))
		refused = unplaceable_assessments(placements - self.stored_placements())
		if refused:
			frappe.throw(
				_("You are not authorized to add {0} to this lesson.").format(next(iter(refused))[1]),
				frappe.PermissionError,
			)

	def stored_placements(self) -> set:
		if self.is_new():
			return set()
		stored = {
			(row.assessment_type, row.assessment_name)
			for row in frappe.get_all(
				"LMS Lesson Assessment",
				filters={"parent": self.name, "parenttype": "Course Lesson"},
				fields=["assessment_type", "assessment_name"],
			)
		}
		quiz_id = frappe.db.get_value("Course Lesson", self.name, "quiz_id")
		if quiz_id:
			stored.add(("LMS Quiz", quiz_id))
		return stored

	def on_update(self):
		self.validate_quiz_id()

	def validate_progress_recalculation(self):
		if not self.course or not self.chapter:
			return

		enrollments = frappe.db.get_all(
			"LMS Enrollment",
			filters={"course": self.course},
			fields=["name", "member"],
		)
		if not len(enrollments):
			return

		frappe.enqueue(method=self.recalculate_progress, queue="long", is_async=True, enrollments=enrollments)

	def recalculate_progress(self, enrollments):
		for enrollment in enrollments:
			recalculate_course_progress(self.course, enrollment.member)

	def validate_quiz_id(self):
		if self.quiz_id and not frappe.db.exists("LMS Quiz", self.quiz_id):
			frappe.throw(_("Invalid Quiz ID"))

		if self.content:
			self.save_lesson_details_in_quiz(self.content)

		if self.instructor_content:
			self.save_lesson_details_in_quiz(self.instructor_content)

	def save_lesson_details_in_quiz(self, content):
		for block in get_editorjs_blocks(content):
			if block.get("type") == "quiz":
				quiz = (block.get("data") or {}).get("quiz")
				if not frappe.db.exists("LMS Quiz", quiz):
					frappe.throw(_("Invalid Quiz ID in content"))
				if not may_restamp_quiz(quiz, self.name):
					continue
				frappe.db.set_value(
					"LMS Quiz",
					quiz,
					{
						"course": self.course,
						"lesson": self.name,
					},
				)


def may_restamp_quiz(quiz: str, lesson: str) -> bool:
	"""Placing a quiz grants use only, so a lesson moves another author's quiz stamp
	only when that stamp no longer names a lesson placing it."""
	if can_author_assessment("LMS Quiz", quiz):
		return True
	stamped = frappe.db.get_value("LMS Quiz", quiz, "lesson")
	if not stamped or stamped == lesson:
		return True
	if frappe.db.get_value("Course Lesson", stamped, "quiz_id") == quiz:
		return False
	return not frappe.db.exists(
		"LMS Lesson Assessment",
		{
			"parent": stamped,
			"parenttype": "Course Lesson",
			"assessment_type": "LMS Quiz",
			"assessment_name": quiz,
		},
	)


def cleanup_lesson_backreferences(lesson: str):
	"""Clear other docs' references to `lesson` so its deletion isn't blocked by
	LinkExistsError (delete_doc paths: delete_lesson, delete_course, desk) or silently
	orphaned (delete_chapter's raw db.delete). Notes are meaningless without the lesson
	and are deleted; data-bearing docs (quiz + its submissions, enrollment progress,
	graded work) are only unlinked."""
	for note in frappe.get_all("LMS Lesson Note", {"lesson": lesson}, pluck="name"):
		frappe.delete_doc("LMS Lesson Note", note, ignore_permissions=True)

	frappe.db.set_value("LMS Quiz", {"lesson": lesson}, "lesson", None)
	frappe.db.set_value("LMS Enrollment", {"current_lesson": lesson}, "current_lesson", None)
	frappe.db.set_value("LMS Assignment Submission", {"lesson": lesson}, "lesson", None)


def has_permission(doc, ptype="read", user=None):
	user = user or frappe.session.user
	if ptype not in ("read", "select", "print"):
		# Authoring (create/write/delete): mirror sibling LMS hooks. Moderators
		# and Course Creators manage lessons; otherwise fall back to per-course
		# instructor/moderator via the rule.
		roles = frappe.get_roles(user)
		if "Moderator" in roles or "Course Creator" in roles:
			return True
		return can_access_lesson(doc.name, instructor_only=True, user=user)
	# Read/select/print: the security gate. Enrollment / preview / instructor only.
	# Deliberately NOT widened to all Course Creators, to preserve the media-access
	# boundary (matches the original get_lesson gate).
	return can_access_lesson(doc.name, user=user)


def get_permission_query_conditions(user=None):
	"""List-read counterpart of has_permission's read branch.

	Expresses resolve_lesson_access (lms/lms/permissions.py) as SQL: course
	instructor, or enrolled member, or a preview lesson of a published course.
	Deliberately NOT widened to all Course Creators — the read gate is per-course,
	and widening it here would open the media boundary the doc read protects.
	"""
	user = user or frappe.session.user
	if user == "Administrator":
		return ""

	roles = frappe.get_roles(user)
	if "Moderator" in roles:
		return ""

	escaped = frappe.db.escape(user)
	conditions = [
		f"""`tabCourse Lesson`.course in (
			select parent from `tabCourse Instructor`
			where instructor = {escaped} and parenttype = 'LMS Course'
		)""",
		f"""`tabCourse Lesson`.course in (
			select course from `tabLMS Enrollment` where member = {escaped}
		)""",
	]

	if user != "Guest" or guest_access_allowed():
		conditions.append(
			"""(`tabCourse Lesson`.include_in_preview = 1
			and `tabCourse Lesson`.course in (
				select name from `tabLMS Course` where published = 1
			))"""
		)

	joined = " or ".join(conditions)
	return f"({joined})"


# Lesson content fields a student may reach vs. instructor-only fields (gated harder).
STUDENT_CONTENT_FIELDS = ("content", "body")


class _LessonReference(NamedTuple):
	"""One claim that `lesson` uses the bytes, plus the evidence behind the claim.

	`owner`/`canonical`/`untouched` describe the File row the claim came from; a claim
	found by searching lesson content carries the canonical row's owner instead.
	"""

	lesson: str
	instructor_only: bool
	attached: bool  # from a File row rather than a content match
	owner: str | None  # the File row's own owner
	canonical: bool  # that owner uploaded these bytes (the earliest File row for the url)
	untouched: bool  # the File row has not been edited since it was inserted


def _resolve_lesson_references(file_url: str) -> list[_LessonReference]:
	"""Every reference to file_url, tagged with the evidence it carries.

	Two sources, unioned:
	- File attachments (fast path). Gives the exact attached_to_field.
	- A search of the lesson content fields (the source of truth: uploaded files
	  are frequently private-but-unattached, and pre-existing/seeded files always are).
	An empty/unknown attachment field is treated as instructor-only (fail-closed).

	Nothing is judged here, and nothing is dropped: the rows anybody could have written
	are kept and tagged so that the whole set is weighed in one place, by
	_references_vouched_by_owner.
	"""
	file_rows = frappe.db.get_all(
		"File",
		filters={"file_url": file_url, "is_private": 1},
		fields=[
			"file_url",
			"owner",
			"creation",
			"modified",
			"attached_to_doctype",
			"attached_to_name",
			"attached_to_field",
		],
		order_by="creation asc, name asc",
	)
	# The database compares without case (and, per collation, accents); the file on disk
	# does not, so only a row naming exactly this url speaks for these bytes.
	file_rows = [r for r in file_rows if r.file_url == file_url]
	# The earliest row is the upload. Every later row only *names* the same url: frappe
	# hands a duplicate upload the existing file's url, and a File row naming any url at
	# all is cheap for any account to insert.
	canonical_owner = file_rows[0].owner if file_rows else None

	refs = [
		_LessonReference(
			lesson=r.attached_to_name,
			instructor_only=r.attached_to_field in INSTRUCTOR_FIELDS or not r.attached_to_field,
			attached=True,
			owner=r.owner,
			canonical=r.owner == canonical_owner,
			untouched=r.creation == r.modified,
		)
		for r in file_rows
		if r.attached_to_doctype == "Course Lesson" and r.attached_to_name
	]

	# Match the url as a literal substring via LOCATE (the query builder maps it to
	# STRPOS/INSTR per dialect) instead of a LIKE pattern: LIKE needs %/_ escaped, and
	# frappe.db.get_all(..., ["like", ...]) re-escapes the backslashes of an already
	# escaped pattern, so any file_url containing "_" or "%" (e.g.
	# Module_1_Introduction.pdf) silently matched nothing, denying enrolled students and
	# preview guests their own lesson media.
	lesson = frappe.qb.DocType("Course Lesson")
	fields = [(f, False) for f in STUDENT_CONTENT_FIELDS] + [(f, True) for f in INSTRUCTOR_FIELDS]
	for field, instructor_only in fields:
		rows = (
			frappe.qb.from_(lesson)
			.select(lesson.name, lesson[field])
			.where(Locate(file_url, lesson[field]) > 0)
			.run()
		)
		for name, value in rows:
			if file_url in value:
				refs.append(_LessonReference(name, instructor_only, False, canonical_owner, True, True))

	return refs


def _references_vouched_by_owner(references: list[_LessonReference]) -> list[tuple[str, bool]]:
	"""The references entitled to speak for the bytes.

	Everything a reference carries is attacker-writable except the identity of the
	canonical File row -- the earliest one, the upload of record. Any account may insert
	a File row naming another user's file_url, and any lesson's author may paste that url
	into their own lesson body. So a reference vouches only when:

	1. its owner uploaded the bytes and currently authors the lesson's course, or
	2. its owner uploaded the bytes and placed them on that lesson themselves: they own
	   the lesson, or their never-since-edited File row is attached to someone else's.
	   This is what keeps a course's media alive once its uploader stops authoring the
	   course, and covers the co-instructor who uploaded into a colleague's lesson.

	A row that did NOT upload the bytes is weighed only while its owner still holds
	blanket authority over every lesson -- a Moderator, who therefore satisfies (1) for
	every course -- and is refused once that ends. The site keeps no record of who could
	write which lesson when, and "a File row says so" is exactly the claim a forged row
	makes, so a former moderator's second row for someone else's upload loses its vouch:
	the deliberate fail-closed side. Guessing the other way would hand every Course
	Creator any private file whose url they can name.
	"""
	lessons = {ref.lesson for ref in references}
	rows = frappe.db.get_all(
		"Course Lesson",
		filters={"name": ("in", list(lessons))},
		fields=["name", "course", "owner"],
	)
	lesson_course = {row.name: row.course for row in rows}
	lesson_owner = {row.name: row.owner for row in rows}

	# Rows that only name the url. Kept solely for an owner with blanket lesson authority.
	borrowed = {ref.owner for ref in references if ref.attached and not ref.canonical}
	trusted = references
	if borrowed:
		moderators = moderators_among(borrowed)
		trusted = [ref for ref in references if ref.canonical or ref.owner in moderators]

	authored = courses_authored_by_each({ref.owner for ref in trusted}, lesson_course.values())

	vouched = []
	for ref in trusted:
		placed_by_uploader = ref.attached and ref.canonical and lesson_owner.get(ref.lesson) is not None
		if lesson_course.get(ref.lesson) in authored.get(ref.owner, ()):
			vouched.append((ref.lesson, ref.instructor_only))
		elif placed_by_uploader and (lesson_owner[ref.lesson] == ref.owner or ref.untouched):
			vouched.append((ref.lesson, ref.instructor_only))
	return vouched


# One flat ceiling, deliberately. A per-audience limit does not work here:
# rate_limit's bucket is keyed on the endpoint and the IP alone, so Guest and
# signed-in traffic from one address share a single counter and a lower guest
# threshold is simply applied to a count that authenticated users already drove
# up — locking out the anonymous visitors it was supposed to protect.
#
# The number is high because this endpoint is charged per asset, not per action:
# a lesson costs one request per embedded file plus one per video byte-range on
# every seek, and a whole NAT'd or CDN-fronted school shares the IP. Exceeding it
# is invisible — these URLs load as <img>/<video>, so a 429 renders as a broken
# image with no toast. Enumeration is not held off by this number anyway:
# can_access_lesson gates every hit and _deny() logs each refusal. The limit is
# only a backstop against a runaway scanner.
@frappe.whitelist(allow_guest=True)  # nosemgrep: frappe-semgrep-rules.rules.security.guest-whitelisted-method
@rate_limit(limit=20000, seconds=60 * 60)
def serve_resource(file_url: str):
	"""Access-gated streaming of private lesson media for all users.

	Native /private/files/ needs a Course Lesson read role-perm that LMS students and
	guests don't hold, and it hard-refuses Guest, so ALL private lesson media is served
	here instead (get_lesson rewrites embedded URLs to this endpoint for every user).
	The owning lesson is resolved from the lesson content (source of truth) and from any
	File attachment, then gated by the same can_access_lesson rule.
	"""
	if not isinstance(file_url, str):
		frappe.throw(_("file_url must be a string"))

	# URLs are percent-encoded in transit; decode before matching the File row / lesson
	# content (which store the decoded path) and before the traversal check, so encoded
	# spaces (%20) resolve and encoded traversal (%2e%2e) is still caught.
	file_url = unquote(file_url)

	if ".." in file_url:
		frappe.throw(_("Invalid file path"))

	# Just for existence + the filename to serve; ownership is resolved per-reference
	# inside _resolve_lesson_references, not from whichever row this happens to pick.
	file_rows = frappe.db.get_all(
		"File", filters={"file_url": file_url, "is_private": 1}, fields=["file_name", "file_url"]
	)
	file_row = next((row for row in file_rows if row.file_url == file_url), None)
	if not file_row:
		_deny(file_url, "no matching private file")
		raise frappe.PermissionError

	references = _resolve_lesson_references(file_url)
	if not references:
		_deny(file_url, "file not referenced by any lesson")
		raise frappe.PermissionError

	references = _references_vouched_by_owner(references)
	if not references:
		_deny(file_url, "no referencing lesson belongs to a course the file owner authors")
		raise frappe.PermissionError

	# Serve if the caller may reach the bytes through ANY vouched-for referencing lesson.
	if not any(
		can_access_lesson(lesson, instructor_only=instructor_only) for lesson, instructor_only in references
	):
		_deny(file_url, "can_access_lesson denied for all references")
		raise frappe.PermissionError

	# send_private_file expects a path relative to the site's private/ dir.
	relative_path = file_url.split("/private", 1)[1] if "/private" in file_url else file_url
	return _serve_private_file(relative_path, _download_name(file_row.file_name, relative_path))


def _download_name(file_name: str | None, relative_path: str) -> str:
	"""The File's name when it ends in the stored file's own extension, else the stored name.

	send_private_file takes the Content-Type from this name but decides inline or download
	from the stored path. file_name is editable by the File's owner, so a name whose
	extension differs from the stored file could serve its bytes as another type.
	"""
	stored_name = os.path.basename(relative_path)
	if file_name and os.path.splitext(file_name)[1].lower() == os.path.splitext(stored_name)[1].lower():
		return file_name
	return stored_name


@cache
def _accepts_filename(func) -> bool:
	"""Whether `func` takes a `filename` kwarg. Memoized per function object, so the
	signature is introspected once per Frappe build (and again for a test's stub)."""
	return "filename" in inspect.signature(func).parameters


def _serve_private_file(relative_path: str, filename: str):
	"""Version-safe call into Frappe's send_private_file.

	The `filename` kwarg (nicer download name + content-type) was added only in recent
	Frappe; LMS supports frappe>=14 where it may be absent. Passing it there raises
	`TypeError: unexpected keyword argument 'filename'`. Fall back to the path-only form
	(send_private_file derives the name from the path basename, which keeps the .pdf
	extension so inline viewing still works).
	"""
	if _accepts_filename(send_private_file):
		return send_private_file(relative_path, filename=filename)
	return send_private_file(relative_path)


def _deny(file_url, reason):
	frappe.logger("lms.security").warning(
		"Lesson resource access denied: user=%s file_url=%s reason=%s",
		frappe.session.user,
		file_url,
		reason,
	)


# Item -> (the toggle that gates it, the toggle that asks for a pass, what a site without
# the pass toggle requires). Every quiz, open-ended or not, is gated by the one quiz toggle.
COMPLETION_ITEMS = {
	"quiz": ("enforce_quiz_completion", "enforce_quiz_passing", 1),
	"open_ended_quiz": ("enforce_quiz_completion", "enforce_open_ended_quiz_passing", 1),
	"assignment": ("enforce_assignment_completion", "enforce_assignment_passing", 0),
	"programming_exercise": (
		"enforce_programming_exercise_completion",
		"enforce_programming_exercise_passing",
		0,
	),
}
# A pre-migrate site, which has none of the fields, still gates what it always gated.
ENFORCED_BEFORE_MIGRATE = {"enforce_quiz_completion", "enforce_assignment_completion"}
PASSED_STATUS = {"LMS Assignment Submission": "Pass", "LMS Programming Exercise Submission": "Passed"}


def get_completion_rules() -> dict[str, str | None]:
	"""What each completion item must reach, "Attempted" or "Passed", or None where the
	item does not gate completion."""
	fields = list(dict.fromkeys(field for item in COMPLETION_ITEMS.values() for field in item[:2]))
	# A field the meta lacks comes back None; one it has reads 0 even when never stored.
	stored = frappe.get_cached_value("LMS Settings", None, fields, as_dict=True) or {}
	rules = {}
	for item, (toggle, passing_toggle, passing_default) in COMPLETION_ITEMS.items():
		enforced = _stored_or(stored, toggle, int(toggle in ENFORCED_BEFORE_MIGRATE))
		passing = _stored_or(stored, passing_toggle, passing_default)
		rules[item] = ("Passed" if passing else "Attempted") if enforced else None
	return rules


def _stored_or(stored: dict, field: str, default: int) -> int:
	value = stored.get(field)
	return default if value is None else cint(value)


def lesson_requirements_met(lesson: str, member: str, rules: dict) -> bool:
	return (
		get_quiz_progress(lesson, member, rules["quiz"], rules["open_ended_quiz"])
		and get_assignment_progress(lesson, member, rules["assignment"])
		and get_programming_exercise_progress(lesson, member, rules["programming_exercise"])
	)


def submission_meets_rule(doctype: str, filters: dict, rule: str) -> bool:
	if rule == "Passed":
		filters = {**filters, "status": PASSED_STATUS[doctype]}
	return bool(frappe.db.exists(doctype, filters))


@frappe.whitelist()
def save_progress(lesson: str, course: str | None = None, scorm_details: dict = None):
	"""
	Note: Pass the argument scorm_details as a dict if it is SCORM related save_progress
	"""
	if not isinstance(lesson, str) or not isinstance(course, str | None):
		frappe.throw(_("Lesson and course must be strings."))

	# Enrollment and the lock are checked against the course the progress row is filed
	# under, which is the lesson's own. `course` is kept for existing callers.
	lesson_course = get_lesson_course(lesson)
	if not lesson_course:
		frappe.throw(_("Invalid lesson."))
	if course and course != lesson_course:
		frappe.throw(_("This lesson does not belong to the course."))
	course = lesson_course

	# The completion path writes the enrollment twice: LMS Course Progress.on_update
	# recalculates progress, then this advances current_lesson. Batch them so the
	# request emits a single on_update, as the pre-regression .save() did.
	with batched_enrollment_updates():
		return _save_progress(lesson, course, scorm_details)


def _save_progress(lesson: str, course: str, scorm_details: dict = None):
	membership = frappe.db.exists("LMS Enrollment", {"course": course, "member": frappe.session.user})
	if not membership:
		return 0

	# On a sequential course this endpoint writes the gate's own unlock state, so an
	# enrolled student could otherwise complete every lesson name the outline publishes
	# and open the whole course. The lesson a student is legitimately on is the first
	# incomplete one, which is never locked, so the normal path never reaches this.
	if lesson in get_locked_lessons(course):
		frappe.throw(
			_("Complete the previous lesson before marking this one as done."),
			frappe.PermissionError,
		)

	progress_already_exists = frappe.db.exists(
		"LMS Course Progress", {"lesson": lesson, "member": frappe.session.user}
	)
	lesson_already_completed = frappe.db.exists(
		"LMS Course Progress",
		{"lesson": lesson, "member": frappe.session.user, "status": "Complete"},
	)

	requirements_met = lesson_requirements_met(lesson, frappe.session.user, get_completion_rules())

	if scorm_details:
		scorm_details = frappe._dict(**scorm_details)

	if not progress_already_exists and requirements_met and not scorm_details:
		try:
			frappe.get_doc(
				{
					"doctype": "LMS Course Progress",
					"lesson": lesson,
					"status": "Complete",
					"member": frappe.session.user,
				}
			).save(ignore_permissions=True)
		except frappe.UniqueValidationError:
			# concurrent request created the progress doc
			pass
	elif scorm_details and not lesson_already_completed and not progress_already_exists:
		# Create new SCORM progress
		try:
			frappe.get_doc(
				{
					"doctype": "LMS Course Progress",
					"lesson": lesson,
					"status": "Complete" if scorm_details.is_complete else "Partially Complete",
					"member": frappe.session.user,
					"scorm_content": "" if scorm_details.is_complete else scorm_details.scorm_content,
				}
			).save(ignore_permissions=True)
		except frappe.UniqueValidationError:
			pass
	elif scorm_details and not lesson_already_completed and progress_already_exists:
		# Update Existing SCORM Progress
		frappe.db.set_value(
			"LMS Course Progress",
			progress_already_exists,
			{
				"lesson": lesson,
				"status": "Complete" if scorm_details.is_complete else "Partially Complete",
				"member": frappe.session.user,
				"scorm_content": "" if scorm_details.is_complete else scorm_details.scorm_content,
			},
		)
	next_lesson = None
	if (not progress_already_exists and requirements_met and not scorm_details) or (
		scorm_details and scorm_details.is_complete and not lesson_already_completed
	):
		next_lesson = get_next_lesson(course, lesson)

	progress = get_course_progress(course)
	if not is_demo_course(course):
		capture("course_progress", "lms")

	# Completing the lesson advances the pointer; otherwise it parks on the one opened.
	# Both fields go through update_enrollment() in one write. The raw set_values this
	# replaces fired no on_update, which is the webhook regression being fixed.
	update_enrollment(membership, {"current_lesson": next_lesson or lesson, "progress": progress})

	# Addressed to the member who completed the lesson, not the whole website room.
	# Everything in this payload is theirs alone — `progress` is their course progress,
	# which every other viewer of the course was assigning to their own progress bar —
	# and it is the signal their outline reloads on, so a site-wide room made one
	# student's completion refetch the outline in every concurrent viewer's browser.
	frappe.publish_realtime(
		event="update_lesson_progress",
		user=frappe.session.user,
		message={"course": course, "lesson": lesson, "progress": progress},
		after_commit=True,
	)

	return progress


def complete_lessons_after_grading(member: str, assessment_type: str, assessment_name: str):
	"""Complete each lesson a new grade was the last thing holding back, since the learner
	is not on the page to ask. A lesson with an enforced video waits for their next visit:
	only the browser sees the video."""
	# Progress is recorded for the session user unless a privileged role writes it.
	if not PRIVILEGED_ROLES & set(frappe.get_roles()):
		return
	rules = get_completion_rules()
	for lesson in _student_placements(assessment_type, assessment_name):
		if video_holds_completion(lesson):
			continue
		course = get_lesson_course(lesson)
		if course and _can_complete_for(course, lesson, member, rules):
			_record_graded_completion(course, lesson, member)


def _student_placements(assessment_type: str, assessment_name: str) -> list[str]:
	lessons = frappe.get_all(
		"LMS Lesson Assessment",
		filters={
			"parenttype": "Course Lesson",
			"assessment_type": assessment_type,
			"assessment_name": assessment_name,
			"instructor_only": 0,
		},
		pluck="parent",
		distinct=True,
	)
	if assessment_type == "LMS Quiz":
		# The legacy quiz_id field has no placement row; get_lesson_quizzes counts it
		# only on a lesson without block content.
		legacy = frappe.get_all(
			"Course Lesson",
			filters={"quiz_id": assessment_name, "content": ["is", "not set"]},
			pluck="name",
		)
		lessons = list(dict.fromkeys(lessons + legacy))
	return lessons


def _can_complete_for(course: str, lesson: str, member: str, rules: dict) -> bool:
	if not frappe.db.exists("LMS Enrollment", {"course": course, "member": member}):
		return False
	if frappe.db.exists("LMS Course Progress", {"lesson": lesson, "member": member}):
		return False
	return not is_lesson_locked_for(course, lesson, member) and lesson_requirements_met(lesson, member, rules)


def _record_graded_completion(course: str, lesson: str, member: str):
	enrollment = frappe.db.get_value(
		"LMS Enrollment", {"course": course, "member": member}, ["name", "current_lesson"], as_dict=True
	)
	with batched_enrollment_updates():
		try:
			# nosemgrep: lms-unjustified-ignore-permissions - the grader records the learner's own progress; a privileged role is checked above
			frappe.get_doc(
				{"doctype": "LMS Course Progress", "lesson": lesson, "status": "Complete", "member": member}
			).insert(ignore_permissions=True)
		except frappe.UniqueValidationError:
			return
		# Only a learner still parked on this lesson is moved; one who went on stays put.
		if enrollment.current_lesson == lesson:
			update_enrollment(enrollment.name, {"current_lesson": get_next_lesson(course, lesson) or lesson})
	frappe.publish_realtime(
		event="update_lesson_progress",
		user=member,
		message={"course": course, "lesson": lesson, "progress": get_course_progress(course, member)},
		after_commit=True,
	)


def video_holds_completion(lesson: str) -> bool:
	"""Only the browser sees an enforced video end, so a server-side write leaves the
	lesson for the learner's own visit to complete."""
	return bool(
		cint(frappe.get_cached_value("LMS Settings", None, "enforce_video_completion"))
		and lesson_has_video(lesson)
	)


VIDEO_FILE_TYPES = {"mp4", "webm", "ogg", "mov"}
VIDEO_EMBED_SERVICES = {"youtube", "vimeo", "cloudflareStream", "bunnyStream"}


def lesson_has_video(lesson: str) -> bool:
	"""The videos get_lesson_icon recognises, plus the legacy YouTube field."""
	details = frappe.db.get_value("Course Lesson", lesson, ["body", "content", "youtube"], as_dict=True)
	if details.youtube:
		return True
	if details.content:
		return any(_is_video_block(block) for block in get_editorjs_blocks(details.content))
	return any(name in ("YouTubeVideo", "Video") for name, _value in find_macros(details.body or ""))


def _is_video_block(block: dict) -> bool:
	data = block.get("data") or {}
	if block.get("type") == "upload":
		return (data.get("file_type") or "").lower() in VIDEO_FILE_TYPES
	return block.get("type") == "embed" and data.get("service") in VIDEO_EMBED_SERVICES


def is_lesson_locked_for(course: str, lesson: str, member: str) -> bool:
	"""get_locked_lessons for a member other than the session user."""
	if not frappe.db.get_value("LMS Course", course, "enforce_lesson_completion"):
		return False
	completed = set(
		frappe.get_all(
			"LMS Course Progress",
			filters={"course": course, "member": member, "status": "Complete"},
			pluck="lesson",
		)
	)
	names = [row.name for row in get_ordered_lesson_rows(course)]
	return lesson in compute_locked_lessons(names, completed)


def get_lesson_course(lesson: str) -> str | None:
	"""The course LMS Course Progress fetches for this lesson (lesson.chapter.course)."""
	chapter = frappe.db.get_value("Course Lesson", lesson, "chapter")
	return chapter and frappe.db.get_value("Course Chapter", chapter, "course")


def get_next_lesson(course: str, lesson: str):
	lesson_reference = frappe.db.get_value(
		"Lesson Reference", {"lesson": lesson}, ["idx", "parent"], as_dict=1
	)
	if not lesson_reference:
		return None

	total_lessons = frappe.db.count("Lesson Reference", {"parent": lesson_reference.parent})
	if lesson_reference.idx < total_lessons:
		return frappe.db.get_value(
			"Lesson Reference", {"parent": lesson_reference.parent, "idx": lesson_reference.idx + 1}, "lesson"
		)

	total_chapters = frappe.db.count("Chapter Reference", {"parent": course})
	current_chapter_reference = frappe.db.get_value(
		"Chapter Reference", {"parent": course, "chapter": lesson_reference.parent}, ["idx"], as_dict=1
	)

	if current_chapter_reference.idx >= total_chapters:
		return None

	next_chapter = frappe.db.get_value(
		"Chapter Reference", {"parent": course, "idx": current_chapter_reference.idx + 1}, "chapter"
	)
	return frappe.db.get_value("Lesson Reference", {"parent": next_chapter, "idx": 1}, "lesson")


def get_quiz_progress(
	lesson: str,
	member: str | None = None,
	rule: str | None = "Passed",
	open_ended_rule: str | None = "Passed",
) -> bool:
	"""A quiz with an open-ended question is held to `open_ended_rule`, any other to `rule`."""
	if not rule and not open_ended_rule:
		return True
	member = member or frappe.session.user
	for quiz in get_lesson_quizzes(lesson):
		if not get_valid_question_count(quiz):
			continue
		quiz_rule = open_ended_rule if is_open_ended_quiz(quiz) else rule
		if quiz_rule and not quiz_meets_rule(quiz, member, quiz_rule):
			return False
	return True


def get_lesson_quizzes(lesson: str) -> list:
	lesson_details = frappe.db.get_value("Course Lesson", lesson, ["body", "content", "quiz_id"], as_dict=1)
	quizzes = []

	if lesson_details.content:
		for block in get_editorjs_blocks(lesson_details.content):
			data = block.get("data") or {}
			if block.get("type") == "quiz":
				quizzes.append(data.get("quiz"))
			if block.get("type") == "upload":
				quizzes_in_video = data.get("quizzes")
				if isinstance(quizzes_in_video, list):
					for row in quizzes_in_video:
						if isinstance(row, dict):
							quizzes.append(row.get("quiz"))

	elif lesson_details.body:
		macros = find_macros(lesson_details.body)
		quizzes = [value for name, value in macros if name == "Quiz"]
		# The lesson page renders the legacy quiz_id field only beside a markdown body.
		if lesson_details.quiz_id:
			quizzes.append(lesson_details.quiz_id)

	return quizzes


def is_open_ended_quiz(quiz: str) -> bool:
	row = frappe.qb.DocType("LMS Quiz Question")
	question = frappe.qb.DocType("LMS Question")
	return bool(
		(
			frappe.qb.from_(row)
			.join(question)
			.on(question.name == row.question)
			.where((row.parent == quiz) & (row.parenttype == "LMS Quiz") & (question.type == "Open Ended"))
			.select(row.name)
			.limit(1)
		).run()
	)


def quiz_meets_rule(quiz: str, member: str, rule: str) -> bool:
	filters = {"quiz": quiz, "member": member}
	if rule == "Passed":
		passing_percentage = frappe.db.get_value("LMS Quiz", quiz, "passing_percentage")
		filters["percentage"] = [">=", passing_percentage]
	return bool(frappe.db.exists("LMS Quiz Submission", filters))


def get_valid_question_count(quiz: str) -> int:
	"""Rows whose LMS Question still exists; the quiz page drops the rest, so a quiz
	with none cannot be submitted."""
	row = frappe.qb.DocType("LMS Quiz Question")
	question = frappe.qb.DocType("LMS Question")
	return (
		frappe.qb.from_(row)
		.join(question)
		.on(question.name == row.question)
		.where((row.parent == quiz) & (row.parenttype == "LMS Quiz"))
		.select(Count("*"))
	).run()[0][0]


UNTITLED_LESSON_TITLE = "Untitled lesson"
RENAME_BATCH_LIMIT = 500


def _untitled_placeholders():
	"""Placeholder titles in every language a lesson could have been created in."""
	placeholders = {UNTITLED_LESSON_TITLE}
	langs = set(frappe.db.get_all("User", pluck="language", distinct=True))
	langs.add(frappe.db.get_default("lang"))
	for lang in (lang for lang in langs if lang):
		translated = frappe.translate.get_all_translations(lang).get(UNTITLED_LESSON_TITLE)
		if translated:
			placeholders.add(translated)
	return list(placeholders)


def rename_settled_untitled_lessons():
	"""Rename settled 'NNNN Untitled lesson' docnames to their real title (daily).

	TODO(docs): document this maintenance job at docs.frappe.io/learning.
	"""
	placeholders = _untitled_placeholders()
	day_ago = add_to_date(now_datetime(), days=-1)
	lessons = frappe.get_all(
		"Course Lesson",
		or_filters=[["name", "like", f"% {p}"] for p in placeholders],
		filters={"modified": ("<", day_ago)},
		fields=["name", "title"],
		order_by="modified asc",
		limit=RENAME_BATCH_LIMIT,
	)
	for lesson in lessons:
		prefix, _sep, title_part = lesson.name.partition(" ")
		if title_part not in placeholders:
			continue
		new_title = (lesson.title or "").strip()
		if not new_title or new_title in placeholders:
			continue
		new_name = f"{prefix} {new_title}"[:140]
		if new_name == lesson.name:
			continue
		try:
			frappe.rename_doc(
				"Course Lesson",
				lesson.name,
				new_name,
				force=True,
				rebuild_search=False,
				show_alert=False,
			)
			frappe.db.commit()
		except Exception:
			frappe.db.rollback()
			frappe.logger("lms").warning(
				f"Failed to rename settled untitled lesson {lesson.name}", exc_info=True
			)

	if len(lessons) == RENAME_BATCH_LIMIT:
		frappe.logger("lms").info(
			"rename_settled_untitled_lessons hit the per-run cap; remaining lessons handled next run"
		)


def get_programming_exercise_progress(
	lesson: str, member: str | None = None, rule: str | None = "Attempted"
) -> bool:
	"""Only block content renders an exercise; no legacy body macro does."""
	if not rule:
		return True
	member = member or frappe.session.user
	content = frappe.db.get_value("Course Lesson", lesson, "content")
	exercises = {
		(block.get("data") or {}).get("exercise")
		for block in get_editorjs_blocks(content)
		if block.get("type") == "program"
	}
	return all(
		submission_meets_rule(
			"LMS Programming Exercise Submission", {"exercise": exercise, "member": member}, rule
		)
		for exercise in exercises
		if exercise
	)


def get_assignment_progress(lesson: str, member: str | None = None, rule: str | None = "Attempted") -> bool:
	if not rule:
		return True
	member = member or frappe.session.user
	lesson_details = frappe.db.get_value("Course Lesson", lesson, ["body", "content"], as_dict=1)
	assignments = []

	if lesson_details.content:
		for block in get_editorjs_blocks(lesson_details.content):
			if block.get("type") == "assignment":
				assignments.append((block.get("data") or {}).get("assignment"))

	elif lesson_details.body:
		macros = find_macros(lesson_details.body)
		assignments = [value for name, value in macros if name == "Assignment"]

	for assignment in assignments:
		if not submission_meets_rule(
			"LMS Assignment Submission", {"assignment": assignment, "member": member}, rule
		):
			return False
	return True
