from contextlib import contextmanager

import frappe
from frappe import _
from frappe.query_builder.functions import Coalesce

from lms.lms.permissions import can_author_batch, can_author_course

# Marks the author's own enrollment, so course counts and dashboards that count
# Students leave it out.
STAFF_MEMBER_TYPE = "Staff"

# `?studentView=1` and `?studentView=not-enrolled` in the page URL.
MODES = ("enrolled", "not-enrolled")


SUBMISSIONS = {
	"LMS Quiz": ("LMS Quiz Submission", "quiz"),
	"LMS Assignment": ("LMS Assignment Submission", "assignment"),
	"LMS Programming Exercise": ("LMS Programming Exercise Submission", "exercise"),
}


def learner_condition(enrollment):
	"""Leaves out staff preview rows of an enrollment table. Batch rows from before
	member_type existed have it blank and are learners."""
	return Coalesce(enrollment.member_type, "") != STAFF_MEMBER_TYPE


def batch_learners(batch: str):
	"""Filters for a batch's learner enrollments."""
	enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	return (enrollment.batch == batch) & learner_condition(enrollment)


@frappe.whitelist(methods=["POST"])
def enroll_self(doctype: str, name: str) -> None:
	"""Enroll the caller in a course or batch they author, so student view records
	their own progress like a learner's."""
	check_can_preview(doctype, name)
	if doctype == "LMS Course":
		enroll_in_course(name)
	else:
		enroll_in_batch(name)


@frappe.whitelist(methods=["POST"])
def reset_own_progress(doctype: str, name: str) -> None:
	"""Delete the caller's progress and submissions in a course, or in every course
	of a batch. Leaves the enrollment itself in place."""
	check_can_preview(doctype, name)
	if doctype == "LMS Course":
		reset_course_progress(name)
		return

	for course in get_batch_courses(name):
		reset_course_progress(course)
	delete_submissions(get_batch_assessments(name))


@contextmanager
def answer_as_student(doctype: str, name: str, mode: str | None):
	"""Inside, reads of this course or batch (and a batch's courses) are answered as for
	a plain LMS Student: no author bypass, and in "not-enrolled" mode no enrollment or
	progress. It only ever removes access. Ignored unless the caller authors `name`."""
	if mode not in MODES or frappe.flags.student_view or not can_preview(doctype, name):
		yield
		return

	targets = {(doctype, name)}
	if doctype == "LMS Batch":
		targets |= {("LMS Course", course) for course in get_batch_courses(name)}
	frappe.flags.student_view = frappe._dict(
		user=frappe.session.user, targets=targets, enrolled=mode == "enrolled"
	)
	try:
		yield
	finally:
		frappe.flags.student_view = None


def is_viewing_as_student(doctype: str, name: str) -> bool:
	view = frappe.flags.student_view
	return bool(view) and view.user == frappe.session.user and (doctype, name) in view.targets


def hides_enrollment(doctype: str, name: str) -> bool:
	"""A not-enrolled student view: the caller's own enrollment and progress do not exist."""
	return is_viewing_as_student(doctype, name) and not frappe.flags.student_view.enrolled


def can_preview(doctype: str, name: str) -> bool:
	if doctype == "LMS Course":
		return can_author_course(name)
	if doctype == "LMS Batch":
		return can_author_batch(name)
	return False


def check_can_preview(doctype: str, name: str) -> None:
	if doctype not in ("LMS Course", "LMS Batch"):
		frappe.throw(_("Student view is only available for courses and batches."))

	if not can_preview(doctype, name):
		frappe.throw(
			_("Only instructors of this {0} can use student view.").format(_(doctype)), frappe.PermissionError
		)


def enroll_in_course(course: str) -> None:
	if frappe.db.exists("LMS Enrollment", {"course": course, "member": frappe.session.user}):
		return
	enrollment = frappe.new_doc("LMS Enrollment")
	enrollment.update({"course": course, "member": frappe.session.user, "member_type": STAFF_MEMBER_TYPE})
	enrollment.insert()


def enroll_in_batch(batch: str) -> None:
	"""A batch enrollment, which brings the batch's course enrollments with it."""
	if frappe.db.exists("LMS Batch Enrollment", {"batch": batch, "member": frappe.session.user}):
		return
	enrollment = frappe.new_doc("LMS Batch Enrollment")
	enrollment.update({"batch": batch, "member": frappe.session.user, "member_type": STAFF_MEMBER_TYPE})
	enrollment.flags.student_view = True
	enrollment.insert()


def reset_course_progress(course: str) -> None:
	member = frappe.session.user
	delete_rows("LMS Course Progress", {"course": course, "member": member})
	delete_rows("LMS Video Watch Duration", {"course": course, "member": member})
	delete_rows("LMS Quiz Submission", {"course": course, "member": member})
	delete_rows("LMS Assignment Submission", {"course": course, "member": member})
	delete_submissions(get_course_assessments(course))

	enrollment = frappe.db.exists("LMS Enrollment", {"course": course, "member": member})
	if enrollment:
		from lms.lms.doctype.lms_enrollment.lms_enrollment import update_enrollment

		update_enrollment(enrollment, {"progress": 0, "current_lesson": None})


def delete_submissions(assessments: list[dict]) -> None:
	"""The caller's submissions to these assessments."""
	for assessment in assessments:
		submission = SUBMISSIONS.get(assessment.assessment_type)
		if submission:
			doctype, field = submission
			delete_rows(doctype, {field: assessment.assessment_name, "member": frappe.session.user})


def delete_rows(doctype: str, filters: dict) -> None:
	"""Delete the caller's own rows. Callers always filter on member = session user,
	and staff cannot delete some of these doctypes through DocPerm."""
	if filters.get("member") != frappe.session.user:
		frappe.throw(_("Student view only resets your own progress."), frappe.PermissionError)
	for row in frappe.get_all(doctype, filters=filters, pluck="name"):
		# nosemgrep: lms-unjustified-ignore-permissions - the caller's own rows, in a course or batch they author
		frappe.delete_doc(doctype, row, ignore_permissions=True)


def get_course_assessments(course: str) -> list[dict]:
	"""Assessments the course's lessons place, including the legacy `quiz_id` field."""
	lessons = frappe.get_all("Course Lesson", filters={"course": course}, fields=["name", "quiz_id"])
	if not lessons:
		return []
	assessments = frappe.get_all(
		"LMS Lesson Assessment",
		filters={"parenttype": "Course Lesson", "parent": ["in", [lesson.name for lesson in lessons]]},
		fields=["assessment_type", "assessment_name"],
		distinct=True,
	)
	legacy_quizzes = [
		frappe._dict(assessment_type="LMS Quiz", assessment_name=lesson.quiz_id)
		for lesson in lessons
		if lesson.quiz_id
	]
	return assessments + legacy_quizzes


def get_batch_assessments(batch: str) -> list[dict]:
	return frappe.get_all(
		"LMS Assessment",
		filters={"parenttype": "LMS Batch", "parent": batch},
		fields=["assessment_type", "assessment_name"],
	)


def get_batch_courses(batch: str) -> list[str]:
	return frappe.get_all(
		"Batch Course", filters={"parenttype": "LMS Batch", "parent": batch}, pluck="course"
	)
