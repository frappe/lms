"""Assert the seeded fixture survived a migration.

`bench migrate` exits 0 for a patch that silently drops or orphans rows, so exit
status alone proves only that nothing raised. A deliberate schema change that
moves data is expected to fail here first; the fix is a patch that carries the
data over.

Run with the bench's own python from the sites directory:

    ../env/bin/python .github/helper/assert_fixture.py <site> <hop>
"""

import json
import os
import sys

import frappe


def compare_counts(failures, expected):
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


def compare_batch_enrollment(failures, seeded):
	"""Batch students are migrated out of a child table into their own doctype.

	Until that patch has run the doctype does not exist, so this only asserts once
	it does. Comparing the pairs rather than the count catches a migration that
	keeps the right number of rows while attaching them to the wrong batch.
	"""
	if not frappe.db.exists("DocType", "LMS Batch Enrollment"):
		return

	found = sorted(
		[batch, member]
		for batch, member in frappe.get_all("LMS Batch Enrollment", fields=["batch", "member"], as_list=True)
	)
	missing = [pair for pair in seeded if pair not in found]
	if missing:
		failures.append(f"LMS Batch Enrollment: seeded batch students never arrived: {missing}")

	extra = [pair for pair in found if pair not in seeded]
	if extra:
		failures.append(f"LMS Batch Enrollment: rows nothing seeded: {extra}")

	for batch, member in found:
		if not frappe.db.exists("LMS Batch", batch):
			failures.append(f"LMS Batch Enrollment for {member} points at missing batch {batch}")
		if not frappe.db.exists("User", member):
			failures.append(f"LMS Batch Enrollment on {batch} points at missing member {member}")


def check(summary):
	failures = []
	compare_counts(failures, summary["counts"])
	compare_batch_enrollment(failures, summary["batch_students"])
	compare_links(failures)
	return failures


def main(site, hop):
	frappe.init(site)
	frappe.connect()
	try:
		failures = check(json.loads(os.environ["FIXTURE_COUNTS"]))
	finally:
		frappe.destroy()

	if failures:
		print(f"FIXTURE FAILED after hop '{hop}':")
		for failure in failures:
			print(f"  - {failure}")
		raise SystemExit(1)

	print(f"FIXTURE OK after hop '{hop}'")


if __name__ == "__main__":
	main(sys.argv[1], sys.argv[2])
