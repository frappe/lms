# M2 · DOJ-based chapter unlock helpers
# All logic is chapter-scoped: one release rule per chapter per course.
# Lessons inherit their chapter's unlock date.

import frappe


def get_intern_doj(user):
	"""Return the Employee.date_of_joining for *user*, or None if not found."""
	return frappe.db.get_value("Employee", {"user_id": user}, "date_of_joining")


def _get_chapter_release_rule(chapter_name, course):
	"""
	Return release_after_days for *chapter_name* inside *course*, or None.
	Looks up the LMS Chapter Release Rule child table on the LMS Course doc.
	"""
	return frappe.db.get_value(
		"LMS Chapter Release Rule",
		{"parent": course, "parenttype": "LMS Course", "chapter": chapter_name},
		"release_after_days",
	)


def is_lesson_unlocked(lesson_name, user, course=None):
	"""
	Returns True when the lesson's chapter has passed its DOJ-based unlock date.

	- If the user has no Employee record (no DOJ): always unlocked.
	- If the chapter has no release rule in this course: always unlocked.
	"""
	doj = get_intern_doj(user)
	if not doj:
		return True

	chapter = frappe.db.get_value("Course Lesson", lesson_name, "chapter")
	if not chapter:
		return True

	if not course:
		course = frappe.db.get_value("Course Lesson", lesson_name, "course")
	if not course:
		return True

	release_after_days = _get_chapter_release_rule(chapter, course)
	if release_after_days is None:
		return True

	unlock_date = frappe.utils.add_days(doj, int(release_after_days))
	return frappe.utils.getdate() >= frappe.utils.getdate(unlock_date)


def get_lesson_unlock_date(lesson_name, user, course=None):
	"""
	Returns a human-readable unlock date string (e.g. '9 March 2026') for display,
	or None if the lesson has no DOJ-based release rule.
	"""
	doj = get_intern_doj(user)
	if not doj:
		return None

	chapter = frappe.db.get_value("Course Lesson", lesson_name, "chapter")
	if not chapter:
		return None

	if not course:
		course = frappe.db.get_value("Course Lesson", lesson_name, "course")
	if not course:
		return None

	release_after_days = _get_chapter_release_rule(chapter, course)
	if release_after_days is None:
		return None

	unlock_date = frappe.utils.add_days(doj, int(release_after_days))
	return frappe.utils.formatdate(unlock_date, "d MMMM yyyy")
