import frappe

from lms.lms.utils import (
	_get_previous_lesson_name,
	_is_course_privileged,
	get_progress,
)


@frappe.whitelist()
def get_lesson_with_guard(lesson_name, course):
	"""
	Returns lesson data only if the previous lesson is complete.
	Raises PermissionError otherwise.
	Moderators and course instructors bypass the check.
	"""
	user = frappe.session.user

	if _is_course_privileged(user, course):
		return frappe.get_doc("Course Lesson", lesson_name).as_dict()

	prev_lesson = _get_previous_lesson_name(lesson_name, course)
	if prev_lesson and not get_progress(course, prev_lesson):
		prev_title = frappe.db.get_value("Course Lesson", prev_lesson, "title")
		frappe.throw(
			f"You must complete '{prev_title}' before accessing this lesson.",
			frappe.PermissionError,
		)

	return frappe.get_doc("Course Lesson", lesson_name).as_dict()


@frappe.whitelist()
def is_previous_lesson_complete(lesson_name, course):
	"""
	Returns True if the previous lesson is complete (or if there is no previous lesson).
	Used by the frontend to decide whether to enable the Next button.
	"""
	user = frappe.session.user

	if _is_course_privileged(user, course):
		return True

	prev_lesson = _get_previous_lesson_name(lesson_name, course)
	if not prev_lesson:
		return True

	return bool(get_progress(course, prev_lesson))
