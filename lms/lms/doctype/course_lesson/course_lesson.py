# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.realtime import get_website_room
from frappe.utils.telemetry import capture

from lms.lms.utils import get_course_progress, is_demo_course, recalculate_course_progress, sanitize_editorjs

from ...md import find_macros


class CourseLesson(Document):
	def after_insert(self):
		self.validate_progress_recalculation()

	def after_delete(self):
		self.validate_progress_recalculation()

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
