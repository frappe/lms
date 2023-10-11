# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import json
import random
import frappe
from frappe.model.document import Document
from frappe.utils import cint
from frappe.utils.telemetry import capture
from lms.lms.utils import get_chapters, can_create_courses
from ...utils import generate_slug, validate_image
from frappe import _


class LMSCourse(Document):
	def validate(self):
		self.validate_instructors()
		self.validate_video_link()
		self.validate_status()
		self.image = validate_image(self.image)

	def validate_instructors(self):
		if self.is_new() and not self.instructors:
			frappe.get_doc(
				{
					"doctype": "Course Instructor",
					"instructor": self.owner,
					"parent": self.name,
					"parentfield": "instructors",
					"parenttype": "LMS Course",
				}
			).save(ignore_permissions=True)

	def validate_video_link(self):
		if self.video_link and "/" in self.video_link:
			self.video_link = self.video_link.split("/")[-1]

	def validate_status(self):
		if self.published:
			self.status = "Approved"

	def on_update(self):
		if not self.upcoming and self.has_value_changed("upcoming"):
			self.send_email_to_interested_users()

	def after_insert(self):
		capture("course_created", "lms")

	def send_email_to_interested_users(self):
		interested_users = frappe.get_all(
			"LMS Course Interest", {"course": self.name}, ["name", "user"]
		)
		subject = self.title + " is available!"
		args = {
			"title": self.title,
			"course_link": f"/courses/{self.name}",
			"app_name": frappe.db.get_single_value("System Settings", "app_name"),
			"site_url": frappe.utils.get_url(),
		}

		for user in interested_users:
			args["first_name"] = frappe.db.get_value("User", user.user, "first_name")
			email_args = frappe._dict(
				recipients=user.user,
				subject=subject,
				header=[subject, "green"],
				template="lms_course_interest",
				args=args,
				now=True,
			)
			frappe.enqueue(
				method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args
			)
			frappe.db.set_value("LMS Course Interest", user.name, "email_sent", True)

	def autoname(self):
		if not self.name:
			title = self.title
			if self.title == "New Course":
				title = self.title + str(random.randint(0, 99))
			self.name = generate_slug(title, "LMS Course")

	def __repr__(self):
		return f"<Course#{self.name}>"

	def has_mentor(self, email):
		"""Checks if this course has a mentor with given email."""
		if not email or email == "Guest":
			return False

		mapping = frappe.get_all(
			"LMS Course Mentor Mapping", {"course": self.name, "mentor": email}
		)
		return mapping != []

	def add_mentor(self, email):
		"""Adds a new mentor to the course."""
		if not email:
			raise ValueError("Invalid email")
		if email == "Guest":
			raise ValueError("Guest user can not be added as a mentor")

		# given user is already a mentor
		if self.has_mentor(email):
			return

		doc = frappe.get_doc(
			{"doctype": "LMS Course Mentor Mapping", "course": self.name, "mentor": email}
		)
		doc.insert()

	def get_student_batch(self, email):
		"""Returns the batch the given student is part of.

		Returns None if the student is not part of any batch.
		"""
		if not email:
			return

		batch_name = frappe.get_value(
			doctype="LMS Enrollment",
			filters={"course": self.name, "member_type": "Student", "member": email},
			fieldname="batch_old",
		)
		return batch_name and frappe.get_doc("LMS Batch Old", batch_name)

	def get_batches(self, mentor=None):
		batches = frappe.get_all("LMS Batch Old", {"course": self.name})
		if mentor:
			# TODO: optimize this
			memberships = frappe.db.get_all("LMS Enrollment", {"member": mentor}, ["batch_old"])
			batch_names = {m.batch_old for m in memberships}
			return [b for b in batches if b.name in batch_names]

	def get_cohorts(self):
		return frappe.get_all(
			"Cohort",
			{"course": self.name},
			["name", "slug", "title", "begin_date", "end_date"],
			order_by="creation",
		)

	def get_cohort(self, cohort_slug):
		name = frappe.get_value("Cohort", {"course": self.name, "slug": cohort_slug})
		return name and frappe.get_doc("Cohort", name)

	def reindex_exercises(self):
		for i, c in enumerate(get_chapters(self.name), start=1):
			self._reindex_exercises_in_chapter(c, i)

	def _reindex_exercises_in_chapter(self, c, index):
		i = 1
		for lesson in self.get_lessons(c):
			for exercise in lesson.get_exercises():
				exercise.index_ = i
				exercise.index_label = f"{index}.{i}"
				exercise.save()
				i += 1

	def get_all_memberships(self, member):
		all_memberships = frappe.get_all(
			"LMS Enrollment", {"member": member, "course": self.name}, ["batch_old"]
		)
		for membership in all_memberships:
			membership.batch_title = frappe.db.get_value(
				"LMS Batch Old", membership.batch_old, "title"
			)
		return all_memberships


@frappe.whitelist()
def reindex_exercises(doc):
	course_data = json.loads(doc)
	course = frappe.get_doc("LMS Course", course_data["name"])
	course.reindex_exercises()
	frappe.msgprint("All exercises in this course have been re-indexed.")


@frappe.whitelist(allow_guest=True)
def search_course(text):
	courses = frappe.get_all(
		"LMS Course",
		filters={"published": True},
		or_filters={
			"title": ["like", f"%{text}%"],
			"tags": ["like", f"%{text}%"],
			"short_introduction": ["like", f"%{text}%"],
			"description": ["like", f"%{text}%"],
		},
		fields=["name", "title"],
	)
	return courses


@frappe.whitelist()
def submit_for_review(course):
	chapters = frappe.get_all("Chapter Reference", {"parent": course})
	if not len(chapters):
		return "No Chp"
	frappe.db.set_value("LMS Course", course, "status", "Under Review")
	return "OK"


@frappe.whitelist()
def save_course(
	tags,
	title,
	short_introduction,
	video_link,
	description,
	course,
	published,
	upcoming,
	image=None,
	paid_course=False,
	course_price=None,
	currency=None,
):
	if not can_create_courses(course):
		return

	if course:
		doc = frappe.get_doc("LMS Course", course)
	else:
		doc = frappe.get_doc({"doctype": "LMS Course"})

	doc.update(
		{
			"title": title,
			"short_introduction": short_introduction,
			"video_link": video_link,
			"image": image,
			"description": description,
			"tags": tags,
			"published": cint(published),
			"upcoming": cint(upcoming),
			"paid_course": cint(paid_course),
			"course_price": course_price,
			"currency": currency,
		}
	)
	doc.save(ignore_permissions=True)
	return doc.name


@frappe.whitelist()
def save_chapter(course, title, chapter_description, idx, chapter):
	if chapter:
		doc = frappe.get_doc("Course Chapter", chapter)
	else:
		doc = frappe.get_doc({"doctype": "Course Chapter"})

	doc.update({"course": course, "title": title, "description": chapter_description})
	doc.save(ignore_permissions=True)

	if chapter:
		chapter_reference = frappe.get_doc("Chapter Reference", {"chapter": chapter})
	else:
		chapter_reference = frappe.get_doc(
			{
				"doctype": "Chapter Reference",
				"parent": course,
				"parenttype": "LMS Course",
				"parentfield": "chapters",
				"idx": idx,
			}
		)

	chapter_reference.update({"chapter": doc.name})
	chapter_reference.save(ignore_permissions=True)

	return doc.name


@frappe.whitelist()
def save_lesson(
	title,
	body,
	chapter,
	preview,
	idx,
	lesson,
	instructor_notes=None,
	youtube=None,
	quiz_id=None,
	question=None,
	file_type=None,
):
	if lesson:
		doc = frappe.get_doc("Course Lesson", lesson)
	else:
		doc = frappe.get_doc({"doctype": "Course Lesson"})

	doc.update(
		{
			"chapter": chapter,
			"title": title,
			"body": body,
			"instructor_notes": instructor_notes,
			"include_in_preview": preview,
			"youtube": youtube,
			"quiz_id": quiz_id,
			"question": question,
			"file_type": file_type,
		}
	)
	doc.save(ignore_permissions=True)

	if lesson:
		lesson_reference = frappe.get_doc("Lesson Reference", {"lesson": lesson})
	else:
		lesson_reference = frappe.get_doc(
			{
				"doctype": "Lesson Reference",
				"parent": chapter,
				"parenttype": "Course Chapter",
				"parentfield": "lessons",
				"idx": idx,
			}
		)

	lesson_reference.update({"lesson": doc.name})
	lesson_reference.save(ignore_permissions=True)

	return doc.name


@frappe.whitelist()
def reorder_lesson(old_chapter, old_lesson_array, new_chapter, new_lesson_array):
	if old_chapter == new_chapter:
		sort_lessons(new_chapter, new_lesson_array)
	else:
		sort_lessons(old_chapter, old_lesson_array)
		sort_lessons(new_chapter, new_lesson_array)


def sort_lessons(chapter, lesson_array):
	lesson_array = json.loads(lesson_array)
	for les in lesson_array:
		ref = frappe.get_all("Lesson Reference", {"lesson": les}, ["name", "idx"])
		if ref:
			frappe.db.set_value(
				"Lesson Reference",
				ref[0].name,
				{
					"parent": chapter,
					"idx": lesson_array.index(les) + 1,
				},
			)


@frappe.whitelist()
def reorder_chapter(chapter_array):
	chapter_array = json.loads(chapter_array)

	for chap in chapter_array:
		ref = frappe.get_all("Chapter Reference", {"chapter": chap}, ["name", "idx"])
		if ref:
			frappe.db.set_value(
				"Chapter Reference",
				ref[0].name,
				{
					"idx": chapter_array.index(chap) + 1,
				},
			)
