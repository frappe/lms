"""Populate a site with enough data for migration testing to be meaningful.

Runs against the OLDEST version in the ladder, so it may only touch doctypes and
fields that existed at LMS v2.0.0. It is invoked from outside the installed app
(the workflow checks out the repo at PR head and feeds this file to the console),
which is what lets it seed a site running much older code.

Migrations on empty tables always succeed, even when the change is invalid, so
every table this fixture can reach gets at least a few rows.
"""

import json
import os

import frappe

COUNTS_PATH = os.environ.get("FIXTURE_COUNTS", "/tmp/lms-fixture-counts.json")
COURSE_COUNT = 2
CHAPTERS_PER_COURSE = 2
LESSONS_PER_CHAPTER = 3
STUDENT_COUNT = 3


def user(email, first_name, roles):
	if frappe.db.exists("User", email):
		return email

	doc = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first_name,
			"send_welcome_email": 0,
			"enabled": 1,
		}
	).insert(ignore_permissions=True)

	for role in roles:
		if frappe.db.exists("Role", role):
			doc.append("roles", {"role": role})
	doc.save(ignore_permissions=True)

	return email


def course(title, instructor, index):
	doc = frappe.get_doc(
		{
			"doctype": "LMS Course",
			"title": title,
			"short_introduction": f"Short introduction for {title}",
			"description": f"<p>Long description for {title}</p>",
			"image": "/files/fixture-course.png",
			"published": 1,
			"instructors": [{"instructor": instructor}],
		}
	).insert(ignore_permissions=True)

	for chapter_index in range(CHAPTERS_PER_COURSE):
		chapter = frappe.get_doc(
			{
				"doctype": "Course Chapter",
				"title": f"{title} chapter {chapter_index + 1}",
				"course": doc.name,
				"description": "Chapter description",
			}
		).insert(ignore_permissions=True)

		doc.append("chapters", {"chapter": chapter.name})

		for lesson_index in range(LESSONS_PER_CHAPTER):
			lesson = frappe.get_doc(
				{
					"doctype": "Course Lesson",
					"title": f"{chapter.title} lesson {lesson_index + 1}",
					"chapter": chapter.name,
					"course": doc.name,
					"body": "Lesson body with **markdown** and a {{ YouTubeVideo('abc') }} macro.",
				}
			).insert(ignore_permissions=True)

			chapter.append("lessons", {"lesson": lesson.name})

		chapter.save(ignore_permissions=True)

	doc.save(ignore_permissions=True)

	return doc


def quiz(title, course_name):
	questions = []
	for index in range(2):
		question = frappe.get_doc(
			{
				"doctype": "LMS Question",
				"question": f"{title} question {index + 1}?",
				"type": "Choices",
				"option_1": "First option",
				"is_correct_1": 1,
				"option_2": "Second option",
				"is_correct_2": 0,
			}
		).insert(ignore_permissions=True)
		questions.append({"question": question.name, "marks": 1})

	return frappe.get_doc(
		{
			"doctype": "LMS Quiz",
			"title": title,
			"course": course_name,
			"passing_percentage": 50,
			"total_marks": len(questions),
			"questions": questions,
		}
	).insert(ignore_permissions=True)


def batch(title, course_name, instructor, students):
	doc = frappe.get_doc(
		{
			"doctype": "LMS Batch",
			"title": title,
			"description": "Batch description",
			"batch_details": "<p>Batch details</p>",
			"start_date": "2025-01-06",
			"end_date": "2025-03-06",
			"start_time": "10:00:00",
			"end_time": "12:00:00",
			"timezone": "Asia/Kolkata",
			"published": 1,
			"instructors": [{"instructor": instructor}],
			"courses": [{"course": course_name}],
			"students": [{"student": student} for student in students],
		}
	).insert(ignore_permissions=True)

	frappe.get_doc(
		{
			"doctype": "LMS Live Class",
			"batch_name": doc.name,
			"title": f"{title} live class",
			"date": "2025-01-13",
			"time": "10:00:00",
			"duration": 60,
			"description": "Live class description",
		}
	).insert(ignore_permissions=True)

	return doc


def seed():
	instructor = user("fixture-instructor@example.com", "Fixture Instructor", ["Course Creator"])
	students = [
		user(f"fixture-student-{index}@example.com", f"Fixture Student {index}", ["LMS Student"])
		for index in range(STUDENT_COUNT)
	]

	courses = [course(f"Fixture course {index + 1}", instructor, index) for index in range(COURSE_COUNT)]

	for index, doc in enumerate(courses):
		quiz(f"Fixture quiz {index + 1}", doc.name)

		for student in students:
			frappe.get_doc(
				{
					"doctype": "LMS Enrollment",
					"course": doc.name,
					"member": student,
				}
			).insert(ignore_permissions=True)

		lessons = frappe.get_all("Course Lesson", filters={"course": doc.name}, pluck="name")
		for student in students:
			for lesson in lessons[:2]:
				frappe.get_doc(
					{
						"doctype": "LMS Course Progress",
						"lesson": lesson,
						"course": doc.name,
						"member": student,
						"status": "Complete",
					}
				).insert(ignore_permissions=True)

	batch("Fixture batch", courses[0].name, instructor, students)

	frappe.get_doc(
		{
			"doctype": "LMS Certificate",
			"member": students[0],
			"course": courses[0].name,
			"issue_date": "2025-03-07",
		}
	).insert(ignore_permissions=True)

	frappe.db.commit()


def summarise():
	"""Write the row counts every later hop must still satisfy.

	Written to a file rather than hardcoded in the assertions so that changing the
	fixture cannot silently leave the assertions checking the old shape.
	"""
	counted = {}
	for doctype in (
		"LMS Course",
		"Course Chapter",
		"Course Lesson",
		"LMS Enrollment",
		"LMS Course Progress",
		"LMS Quiz",
		"LMS Question",
		"LMS Batch",
		"LMS Live Class",
		"LMS Certificate",
	):
		counted[doctype] = frappe.db.count(doctype)

	for doctype, count in counted.items():
		print(f"FIXTURE {doctype} = {count}")
		if not count:
			raise SystemExit(f"fixture seeded no rows for {doctype}; migrations over it would be vacuous")

	with open(COUNTS_PATH, "w") as f:
		json.dump(counted, f, indent=1)

	return counted


seed()
summarise()
print("FIXTURE seeded")
