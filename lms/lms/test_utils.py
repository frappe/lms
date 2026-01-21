# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe

from lms.lms.api import get_certified_participants
from lms.lms.doctype.lms_certificate.lms_certificate import is_certified
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import (
	get_average_rating,
	get_chapters,
	get_evaluator,
	get_instructors,
	get_lesson_index,
	get_lesson_url,
	get_lessons,
	get_membership,
	get_reviews,
	get_tags,
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

		self.student1 = self._create_user("student1@example.com", "Ashley", "Smith", ["LMS Student"])
		self.student2 = self._create_user("student2@example.com", "John", "Doe", ["LMS Student"])
		self.admin = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		self.course = self._create_course()
		self._setup_chapters_and_lessons()

		self._create_enrollment(self.student1.email, self.course.name)
		self._create_enrollment(self.student2.email, self.course.name)

		self._add_rating(self.course.name, self.student1.email, 0.8, "Good course")
		self._add_rating(self.course.name, self.student2.email, 1, "Excellent course")

		self._create_certificate(self.course.name, self.student1.email)

		self.evaluator = self._create_evaluator()
		self.batch = self._create_batch(self.course.name)

	def _setup_chapters_and_lessons(self):
		chapters = []
		for i in range(1, 4):
			chapter = self._create_chapter(f"Chapter {i}", self.course.name)
			chapters.append(chapter)

		self.course.reload()
		for chapter in chapters:
			if not any(c.chapter == chapter.name for c in self.course.chapters):
				self.course.append("chapters", {"chapter": chapter.name})
		self.course.save()

		for chapter_ref in self.course.chapters:
			chapter_doc = frappe.get_doc("Course Chapter", chapter_ref.chapter)
			for j in range(1, 3):
				lesson_title = f"Lesson {j} of {chapter_ref.chapter}"
				lesson = self._create_lesson(lesson_title, chapter_ref.chapter, self.course.name)

				if not any(l.lesson == lesson.name for l in chapter_doc.lessons):
					chapter_doc.append("lessons", {"lesson": lesson.name})
			chapter_doc.save()

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

	def test_get_tags(self):
		tags = get_tags(self.course.name)
		expected_tags = ["Frappe", "Learning", "Utility"]
		self.assertEqual(set(tags), set(expected_tags))

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
			expected_url = f"/lms/courses/{self.course.name}/learn/{lesson.number}"
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

	def test_certified_participants_with_category(self):
		filters = {"category": "Utility Course"}
		certified_participants = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants), 1)
		self.assertEqual(certified_participants[0].member, self.student1.email)

		filters = {"category": "Nonexistent Category"}
		certified_participants_no_match = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_no_match), 0)

	def test_certified_participants_with_open_to_opportunities(self):
		filters = {"open_to_opportunities": 1}
		certified_participants_open_to_oppo = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_open_to_oppo), 0)

		frappe.db.set_value("User", self.student1.email, "open_to", "Opportunities")
		certified_participants_open_to_oppo = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_open_to_oppo), 1)
		frappe.db.set_value("User", self.student1.email, "open_to", "")

	def test_certified_participants_with_open_to_hiring(self):
		filters = {"hiring": 1}
		certified_participants_hiring = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_hiring), 0)

		frappe.db.set_value("User", self.student1.email, "open_to", "Hiring")
		certified_participants_hiring = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_hiring), 1)
		frappe.db.set_value("User", self.student1.email, "open_to", "")

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
