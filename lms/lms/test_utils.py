# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
from frappe.utils import getdate, to_timedelta

from lms.lms.doctype.lms_certificate.lms_certificate import is_certified
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import (
	get_average_rating,
	get_batch_details,
	get_chapters,
	get_course_details,
	get_evaluator,
	get_instructors,
	get_lesson_index,
	get_lesson_url,
	get_lessons,
	get_lms_route,
	get_membership,
	get_reviews,
	has_course_instructor_role,
	has_evaluator_role,
	has_moderator_role,
	has_student_role,
	is_instructor,
	slugify,
)


class TestLMSUtils(BaseTestUtils):
	def setUp(self):
		super().setUp()

		self._setup_course_flow()
		self._setup_batch_flow()

	def test_simple_slugs(self):
		self.assertEqual(slugify("hello-world"), "hello-world")
		self.assertEqual(slugify("Hello World"), "hello-world")
		self.assertEqual(slugify("Hello, World!"), "hello-world")

	def test_duplicates_slugs(self):
		self.assertEqual(slugify("Hello World", ["hello-world"]), "hello-world-2")
		self.assertEqual(slugify("Hello World", ["hello-world", "hello-world-2"]), "hello-world-3")

	def test_get_membership(self):
		membership = get_membership(self.course.name, self.student1.email)
		self.assertIsNotNone(membership)
		self.assertEqual(membership.course, self.course.name)
		self.assertEqual(membership.member, self.student1.email)

	def test_get_chapters(self):
		chapters = get_chapters(self.course.name)
		self.assertEqual(len(chapters), len(self.course.chapters))

		for i, chapter in enumerate(chapters, start=1):
			self.assertEqual(chapter.title, f"Chapter {i}")

	def test_get_lessons(self):
		lessons = get_lessons(self.course.name)
		all_lessons = frappe.db.count("Course Lesson", {"course": self.course.name})
		self.assertEqual(len(lessons), all_lessons)

	def test_get_instructors(self):
		instructors = get_instructors("LMS Course", self.course.name)
		self.assertEqual(len(instructors), len(self.course.instructors))
		self.assertEqual(instructors[0].name, "frappe@example.com")

	def test_get_average_rating(self):
		average_rating = get_average_rating(self.course.name)
		self.assertEqual(average_rating, 4.5)

	def test_get_reviews(self):
		reviews = get_reviews(self.course.name)
		self.assertEqual(len(reviews), 2)

	def test_get_lesson_index(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			self.assertEqual(get_lesson_index(lesson.name), lesson.number)

	def test_get_lesson_url(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			expected_url = get_lms_route(f"courses/{self.course.name}/learn/{lesson.number}")
			self.assertEqual(get_lesson_url(self.course.name, lesson.number), expected_url)

	def test_is_instructor(self):
		frappe.session.user = "frappe@example.com"
		self.assertTrue(is_instructor(self.course.name))
		frappe.session.user = "Administrator"
		self.assertFalse(is_instructor(self.course.name))

	def test_has_course_instructor_role(self):
		self.assertIsNotNone(has_course_instructor_role("frappe@example.com"))
		self.assertIsNone(has_course_instructor_role("student1@example.com"))

	def test_has_moderator_role(self):
		self.assertIsNotNone(has_moderator_role("frappe@example.com"))
		self.assertIsNone(has_moderator_role("student2@example.com"))

	def test_has_evaluator_role(self):
		self.assertIsNotNone(has_evaluator_role("frappe@example.com"))
		self.assertIsNone(has_evaluator_role("student2@example.com"))

	def test_has_student_role(self):
		self.assertIsNotNone(has_student_role("student1@example.com"))
		self.assertIsNotNone(has_student_role("student2@example.com"))

	def test_is_certified(self):
		frappe.session.user = self.student1.email
		self.assertIsNotNone(is_certified(self.course.name))
		frappe.session.user = self.student2.email
		self.assertIsNone(is_certified(self.course.name))
		frappe.session.user = "Administrator"

	def test_rating_validation(self):
		student3 = self._create_user("student3@example.com", "Emily", "Cooper", ["LMS Student"])
		with self.assertRaises(frappe.exceptions.ValidationError):
			frappe.session.user = student3.email
			review = frappe.new_doc("LMS Course Review")
			review.course = self.course.name
			review.rating = -0.5
			review.review = "Bad course"
			review.save()
		frappe.session.user = "Administrator"

	def test_get_evaluator(self):
		evaluator_email = get_evaluator(self.course.name, self.batch.name)
		self.assertEqual(evaluator_email, self.evaluator.evaluator)

	def test_get_course_details(self):
		course_details = get_course_details(self.course.name)
		self.assertEqual(course_details.name, self.course.name)
		self.assertEqual(course_details.title, self.course.title)
		self.assertEqual(course_details.category, self.course.category)
		self.assertEqual(course_details.description, self.course.description)
		self.assertEqual(course_details.short_introduction, self.course.short_introduction)
		self.assertEqual(course_details.tags, self.course.tags)
		self.assertEqual(course_details.published, 1)
		self.assertEqual(len(course_details.instructors), len(self.course.instructors))

	def test_get_batch_details(self):
		batch_details = get_batch_details(self.batch.name)
		self.assertEqual(batch_details.name, self.batch.name)
		self.assertEqual(batch_details.title, self.batch.title)
		self.assertEqual(batch_details.start_date, getdate(self.batch.start_date))
		self.assertEqual(batch_details.end_date, getdate(self.batch.end_date))
		self.assertEqual(batch_details.start_time, to_timedelta(self.batch.start_time))
		self.assertEqual(batch_details.end_time, to_timedelta(self.batch.end_time))
		self.assertEqual(batch_details.timezone, self.batch.timezone)
		self.assertEqual(batch_details.published, 1)
		self.assertEqual(batch_details.description, self.batch.description)
		self.assertEqual(batch_details.batch_details, self.batch.batch_details)
		self.assertEqual(len(batch_details.courses), len(self.batch.courses))
		self.assertEqual(batch_details.evaluation_end_date, getdate(self.batch.evaluation_end_date))
		self.assertEqual(len(batch_details.instructors), len(self.batch.instructors))
		self.assertEqual(len(batch_details.students), 2)
