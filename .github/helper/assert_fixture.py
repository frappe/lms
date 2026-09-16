"""Assert the seeded fixture survived a migration.

`bench migrate` exits 0 for a patch that silently drops or orphans rows, so exit
status alone proves only that nothing raised. This runs after every hop and
compares against the counts the seed recorded, plus the links that must still
resolve.

A deliberate schema change that moves data is expected to fail here first. That
is the point: the fix is a patch that carries the data over, after which the
seed and its recorded counts are updated together.
"""

import json
import os

import frappe

COUNTS_PATH = os.environ.get("FIXTURE_COUNTS", "/tmp/lms-fixture-counts.json")
HOP = os.environ.get("FIXTURE_HOP", "unknown")


def compare_counts(failures):
	with open(COUNTS_PATH) as f:
		expected = json.load(f)

	for doctype, count in expected.items():
		if not frappe.db.exists("DocType", doctype):
			failures.append(f"{doctype} no longer exists; {count} seeded rows are unaccounted for")
			continue

		found = frappe.db.count(doctype)
		if found != count:
			failures.append(f"{doctype}: expected {count} rows, found {found}")


def compare_links(failures):
	"""Every lesson must still reach a real course through a real chapter."""
	for name, chapter in frappe.get_all("Course Lesson", fields=["name", "chapter"], as_list=True):
		if not chapter:
			failures.append(f"Course Lesson {name} lost its chapter")
			continue

		course = frappe.db.get_value("Course Chapter", chapter, "course")
		if not course:
			failures.append(f"Course Lesson {name} points at chapter {chapter}, which has no course")
		elif not frappe.db.exists("LMS Course", course):
			failures.append(f"Course Lesson {name} resolves to course {course}, which no longer exists")

	for name, course in frappe.get_all("LMS Enrollment", fields=["name", "course"], as_list=True):
		if not frappe.db.exists("LMS Course", course):
			failures.append(f"LMS Enrollment {name} points at missing course {course}")


def main():
	failures = []
	compare_counts(failures)
	compare_links(failures)

	if failures:
		print(f"FIXTURE FAILED after hop '{HOP}':")
		for failure in failures:
			print(f"  - {failure}")
		raise SystemExit(1)

	print(f"FIXTURE intact after hop '{HOP}'")


main()
