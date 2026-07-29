import frappe
from frappe.query_builder.functions import Count
from frappe.utils import ceil, cint, flt

BATCH_SIZE = 5000


def execute():
	"""Recompute LMS Enrollment.progress from the recorded lesson completions.

	Deliberately does not call get_course_progress() per enrollment: that is two
	queries per row and one uncommitted write per row, which trips
	MAX_WRITES_PER_TRANSACTION and rolls the whole migration back on any site with
	more enrollments than the cap.
	"""
	backfill_enrollment_progress()
	backfill_program_progress()


def backfill_enrollment_progress():
	precision = cint(frappe.db.get_default("float_precision")) or 3
	lesson_counts = get_lesson_count_by_course()

	# Course by course, so neither the completion counts nor the pending writes
	# grow with the size of the whole site.
	for course in get_enrolled_courses():
		backfill_course(course, lesson_counts.get(course) or 0, precision)


def backfill_program_progress():
	"""Roll the corrected enrollments up into LMS Program Member.progress.

	Normally LMSEnrollment.on_update does this, but no write in this patch fires
	doc events, so the average a program member carries would stay stale until
	their next lesson completion happens to write an enrollment.
	"""
	for program, courses in get_program_courses().items():
		enrolled = {course: get_progress_by_member(course) for course in courses}
		stale = {}

		for row in get_program_members(program):
			total = sum(enrolled[course].get(row.member) or 0 for course in courses)
			average = ceil(total / len(courses))
			if cint(row.progress) == average:
				continue

			stale.setdefault(average, []).append(row.name)

		for average, names in stale.items():
			write_progress("LMS Program Member", names, average)


def backfill_course(course: str, lesson_count: int, precision: int):
	completions = get_completion_count_by_member(course)
	stale = {}

	for enrollment in get_enrollments(course):
		if lesson_count:
			completed = completions.get(enrollment.member) or 0
			progress = flt(completed / lesson_count * 100, precision)
		else:
			progress = 0

		if flt(enrollment.progress, precision) == progress:
			continue

		stale.setdefault(progress, []).append(enrollment.name)

	for progress, names in stale.items():
		write_progress("LMS Enrollment", names, progress)


def write_progress(doctype: str, names: list[str], progress: float):
	table = frappe.qb.DocType(doctype)

	for start in range(0, len(names), BATCH_SIZE):
		(
			frappe.qb.update(table)
			.set(table.progress, progress)
			.where(table.name.isin(names[start : start + BATCH_SIZE]))
		).run()
		# Patches run outside the request transaction, so each batch is committed to
		# keep the write count under MAX_WRITES_PER_TRANSACTION. Re-running the patch
		# after a partial run is a no-op for whatever already landed.
		frappe.db.commit()


def get_lesson_count_by_course() -> dict[str, int]:
	chapter_reference = frappe.qb.DocType("Chapter Reference")
	lesson_reference = frappe.qb.DocType("Lesson Reference")

	rows = (
		frappe.qb.from_(chapter_reference)
		.inner_join(lesson_reference)
		.on(lesson_reference.parent == chapter_reference.chapter)
		.select(
			chapter_reference.parent.as_("course"),
			Count(lesson_reference.name).distinct().as_("lessons"),
		)
		.groupby(chapter_reference.parent)
	).run(as_dict=True)

	return {row.course: row.lessons for row in rows}


def get_completion_count_by_member(course: str) -> dict[str, int]:
	progress = frappe.qb.DocType("LMS Course Progress")

	rows = (
		frappe.qb.from_(progress)
		.select(progress.member, Count(progress.name).as_("completed"))
		.where((progress.course == course) & (progress.status == "Complete"))
		.groupby(progress.member)
	).run(as_dict=True)

	return {row.member: row.completed for row in rows}


def get_enrolled_courses() -> list[str]:
	enrollment = frappe.qb.DocType("LMS Enrollment")
	courses = (frappe.qb.from_(enrollment).select(enrollment.course).distinct()).run(pluck=True)
	return [course for course in courses if course]


def get_program_courses() -> dict[str, list[str]]:
	"""Courses per program, keyed only for programs that have any.

	update_program_progress() averages over the program's courses, so a program
	with none has no average to write and must not reach the division.
	"""
	courses = {}

	for row in frappe.get_all("LMS Program Course", fields=["parent", "course"]):
		if row.course:
			courses.setdefault(row.parent, []).append(row.course)

	return courses


def get_program_members(program: str):
	return frappe.get_all(
		"LMS Program Member", filters={"parent": program}, fields=["name", "member", "progress"]
	)


def get_progress_by_member(course: str) -> dict[str, float]:
	enrollments = frappe.get_all("LMS Enrollment", filters={"course": course}, fields=["member", "progress"])
	return {row.member: row.progress for row in enrollments}


def get_enrollments(course: str):
	"""Page through one course's enrollments by name, so no page is ever re-read."""
	last = ""

	while True:
		enrollments = frappe.get_all(
			"LMS Enrollment",
			filters={"course": course, "name": (">", last)},
			fields=["name", "member", "progress"],
			order_by="name asc",
			limit=BATCH_SIZE,
		)
		if not enrollments:
			return

		yield from enrollments
		last = enrollments[-1].name
