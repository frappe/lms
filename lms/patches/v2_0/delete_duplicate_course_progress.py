import frappe
from frappe.query_builder.functions import Count

from lms.lms.utils import recalculate_course_progress


def execute():
	"""
	Remove duplicates from course progress caused by race condition
	"""
	CourseProgress = frappe.qb.DocType("LMS Course Progress")
	duplicate_groups = (
		frappe.qb.from_(CourseProgress)
		.select(CourseProgress.member, CourseProgress.lesson)
		.where(CourseProgress.member.isnotnull() & CourseProgress.lesson.isnotnull())
		.groupby(CourseProgress.member, CourseProgress.lesson)
		.having(Count(CourseProgress.name) > 1)
	).run(as_dict=True)

	affected = set()
	for group in duplicate_groups:
		rows = frappe.get_all(
			"LMS Course Progress",
			filters={"member": group.member, "lesson": group.lesson},
			fields=["name", "course", "status", "creation"],
		)
		# keep row with the most completion and earlier creation
		status_rank = {"Complete": 2, "Partially Complete": 1, "Incomplete": 0}
		rows.sort(key=lambda row: row.creation)
		rows.sort(key=lambda row: status_rank.get(row.status, -1), reverse=True)
		for row in rows[1:]:
			frappe.db.delete("LMS Course Progress", {"name": row.name})
			if row.course:
				affected.add((row.course, group.member))

	for course, member in affected:
		try:
			recalculate_course_progress(course, member)
		except Exception:
			frappe.log_error(
				title="dedupe_course_progress: recalculate failed",
				message=f"course={course} member={member}",
			)

	frappe.db.add_unique("LMS Course Progress", ["member", "lesson"])
