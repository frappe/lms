# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import json
from urllib.parse import unquote

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.realtime import get_website_room
from frappe.utils.response import send_private_file
from frappe.utils.telemetry import capture

from lms.lms.permissions import INSTRUCTOR_FIELDS, can_access_lesson
from lms.lms.utils import (
	get_course_progress,
	is_demo_course,
	recalculate_course_progress,
	sanitize_editorjs,
)

from ...md import find_macros


class CourseLesson(Document):
	def after_insert(self):
		self.validate_progress_recalculation()

	def on_trash(self):
		self.delete_linked_notes()

	def after_delete(self):
		self.validate_progress_recalculation()

	def delete_linked_notes(self):
		notes = frappe.get_all("LMS Lesson Note", filters={"lesson": self.name}, pluck="name")
		for note in notes:
			frappe.delete_doc("LMS Lesson Note", note, ignore_permissions=True)

	def validate(self):
		self.content = sanitize_editorjs(self.content)
		self.instructor_content = sanitize_editorjs(self.instructor_content)

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
		content = json.loads(self.content)
		for block in content.get("blocks"):
			if block.get("type") == "quiz":
				quiz = block.get("data").get("quiz")
				if not frappe.db.exists("LMS Quiz", quiz):
					frappe.throw(_("Invalid Quiz ID in content"))
				frappe.db.set_value(
					"LMS Quiz",
					quiz,
					{
						"course": self.course,
						"lesson": self.name,
					},
				)


def has_permission(doc, ptype="read", user=None):
	user = user or frappe.session.user
	if ptype not in ("read", "select", "print"):
		# Authoring (create/write/delete): mirror sibling LMS hooks — Moderators
		# and Course Creators manage lessons; otherwise fall back to per-course
		# instructor/moderator via the rule.
		roles = frappe.get_roles(user)
		if "Moderator" in roles or "Course Creator" in roles:
			return True
		return can_access_lesson(doc.name, instructor_only=True, user=user)
	# Read/select/print: the security gate — enrollment / preview / instructor only.
	# Deliberately NOT widened to all Course Creators, to preserve the media-access
	# boundary (matches the original get_lesson gate).
	return can_access_lesson(doc.name, user=user)


# Lesson content fields a student may reach vs. instructor-only fields (gated harder).
STUDENT_CONTENT_FIELDS = ("content", "body")


def _like_escape(value: str) -> str:
	"""Escape LIKE wildcards so a file_url containing % or _ matches literally."""
	return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _resolve_lesson_references(file_url: str) -> list[tuple[str, bool]]:
	"""Every (lesson, instructor_only) pair that references file_url.

	Two sources, unioned:
	- File attachments (fast path) — gives the exact attached_to_field.
	- A search of the lesson content fields (the source of truth: uploaded files
	  are frequently private-but-unattached, and pre-existing/seeded files always are).
	An empty/unknown attachment field is treated as instructor-only (fail-closed).
	"""
	refs: list[tuple[str, bool]] = []

	for r in frappe.db.get_all(
		"File",
		filters={"file_url": file_url, "is_private": 1, "attached_to_doctype": "Course Lesson"},
		fields=["attached_to_name", "attached_to_field"],
	):
		if r.attached_to_name:
			refs.append(
				(r.attached_to_name, r.attached_to_field in INSTRUCTOR_FIELDS or not r.attached_to_field)
			)

	pattern = f"%{_like_escape(file_url)}%"
	fields = [(f, False) for f in STUDENT_CONTENT_FIELDS] + [(f, True) for f in INSTRUCTOR_FIELDS]
	for field, instructor_only in fields:
		for row in frappe.db.get_all("Course Lesson", filters={field: ["like", pattern]}, fields=["name"]):
			refs.append((row.name, instructor_only))

	return refs


@frappe.whitelist(allow_guest=True)
def serve_resource(file_url: str):
	"""Access-gated streaming of private lesson media for all users.

	Native /private/files/ needs a Course Lesson read role-perm that LMS students and
	guests don't hold, and it hard-refuses Guest — so ALL private lesson media is served
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

	file_row = frappe.db.get_value("File", {"file_url": file_url, "is_private": 1}, "file_name", as_dict=True)
	if not file_row:
		_deny(file_url, "no matching private file")
		raise frappe.PermissionError

	references = _resolve_lesson_references(file_url)
	if not references:
		_deny(file_url, "file not referenced by any lesson")
		raise frappe.PermissionError

	# Serve if the caller may reach the bytes through ANY referencing lesson.
	if not any(
		can_access_lesson(lesson, instructor_only=instructor_only) for lesson, instructor_only in references
	):
		_deny(file_url, "can_access_lesson denied for all references")
		raise frappe.PermissionError

	# send_private_file expects a path relative to the site's private/ dir.
	relative_path = file_url.split("/private", 1)[1] if "/private" in file_url else file_url
	return send_private_file(relative_path, filename=file_row.file_name)


def _deny(file_url, reason):
	frappe.logger("lms.security").warning(
		"Lesson resource access denied: user=%s file_url=%s reason=%s",
		frappe.session.user,
		file_url,
		reason,
	)


def apply_enforcement_flags(quiz_done: bool, assignment_done: bool, settings: dict) -> tuple[bool, bool]:
	"""Return (quiz_completed, assignment_completed) accounting for enforcement toggles.

	If an enforcement flag is missing from `settings`, treat it as enabled (1) so the
	legacy always-on gating remains the safe default.
	"""
	enforce_quiz = settings.get("enforce_quiz_completion", 1)
	enforce_assignment = settings.get("enforce_assignment_completion", 1)
	return (
		True if not enforce_quiz else quiz_done,
		True if not enforce_assignment else assignment_done,
	)


@frappe.whitelist()
def save_progress(lesson: str, course: str, scorm_details: dict = None):
	"""
	Note: Pass the argument scorm_details as a dict if it is SCORM related save_progress
	"""
	membership = frappe.db.exists("LMS Enrollment", {"course": course, "member": frappe.session.user})
	if not membership:
		return 0

	frappe.db.set_value("LMS Enrollment", membership, "current_lesson", lesson, update_modified=False)
	progress_already_exists = frappe.db.exists(
		"LMS Course Progress", {"lesson": lesson, "member": frappe.session.user}
	)
	lesson_already_completed = frappe.db.exists(
		"LMS Course Progress",
		{"lesson": lesson, "member": frappe.session.user, "status": "Complete"},
	)

	try:
		settings = (
			frappe.get_cached_value(
				"LMS Settings",
				None,
				["enforce_quiz_completion", "enforce_assignment_completion"],
				as_dict=True,
			)
			or {}
		)
	except Exception:
		# Pre-migrate sites won't have these columns yet. Fall back to {} so
		# apply_enforcement_flags treats both as enforced (legacy behavior).
		settings = {}
	quiz_completed, assignment_completed = apply_enforcement_flags(
		quiz_done=get_quiz_progress(lesson),
		assignment_done=get_assignment_progress(lesson),
		settings=settings,
	)

	if scorm_details:
		scorm_details = frappe._dict(**scorm_details)

	if not progress_already_exists and quiz_completed and assignment_completed and not scorm_details:
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
	if (not progress_already_exists and quiz_completed and assignment_completed and not scorm_details) or (
		scorm_details and scorm_details.is_complete and not lesson_already_completed
	):
		next_lesson = get_next_lesson(course, lesson)
		if next_lesson:
			frappe.db.set_value(
				"LMS Enrollment",
				membership,
				"current_lesson",
				next_lesson,
				update_modified=False,
			)
	progress = get_course_progress(course)
	if not is_demo_course(course):
		capture("course_progress", "lms")

	# Two near-simultaneous save_progress requests (video-ended fires
	# markProgress + trackVideoWatchDuration which also writes progress)
	# used to race here — both .save()s called check_if_latest() and the
	# second one threw TimestampMismatchError, swallowing whichever update
	# arrived second. Update via db_set + an explicit on_change so the
	# badge trigger still fires without entering the version guard.
	enrollment = frappe.get_doc("LMS Enrollment", membership)
	enrollment.db_set("progress", progress, update_modified=False)
	enrollment.run_method("on_change")

	frappe.publish_realtime(
		event="update_lesson_progress",
		room=get_website_room(),
		message={"course": course, "lesson": lesson, "progress": progress},
		after_commit=True,
	)

	return progress


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


def get_quiz_progress(lesson):
	lesson_details = frappe.db.get_value("Course Lesson", lesson, ["body", "content"], as_dict=1)
	quizzes = []

	if lesson_details.content:
		content = json.loads(lesson_details.content)

		for block in content.get("blocks"):
			if block.get("type") == "quiz":
				quizzes.append(block.get("data").get("quiz"))
			if block.get("type") == "upload":
				quizzes_in_video = block.get("data").get("quizzes")
				if quizzes_in_video and len(quizzes_in_video) > 0:
					for row in quizzes_in_video:
						quizzes.append(row.get("quiz"))

	elif lesson_details.body:
		macros = find_macros(lesson_details.body)
		quizzes = [value for name, value in macros if name == "Quiz"]

	for quiz in quizzes:
		passing_percentage = frappe.db.get_value("LMS Quiz", quiz, "passing_percentage")
		if not frappe.db.exists(
			"LMS Quiz Submission",
			{
				"quiz": quiz,
				"member": frappe.session.user,
				"percentage": [">=", passing_percentage],
			},
		):
			return False
	return True


def get_assignment_progress(lesson):
	lesson_details = frappe.db.get_value("Course Lesson", lesson, ["body", "content"], as_dict=1)
	assignments = []

	if lesson_details.content:
		content = json.loads(lesson_details.content)

		for block in content.get("blocks"):
			if block.get("type") == "assignment":
				assignments.append(block.get("data").get("assignment"))

	elif lesson_details.body:
		macros = find_macros(lesson_details.body)
		assignments = [value for name, value in macros if name == "Assignment"]

	for assignment in assignments:
		if not frappe.db.exists(
			"LMS Assignment Submission",
			{"assignment": assignment, "member": frappe.session.user},
		):
			return False
	return True
