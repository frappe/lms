# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe

from lms.lms.api import delete_course


class TestLMSCourse(unittest.TestCase):
	def setUp(self):
		self.cleanup_items = []

	def tearDown(self):
		for item_type, item_name in reversed(self.cleanup_items):
			if frappe.db.exists(item_type, item_name):
				try:
					frappe.delete_doc(item_type, item_name, force=True)
				except Exception as e:
					frappe.log_error(f"Failed to delete {item_type} {item_name}: {e}")

	def test_new_course(self):
		course_name = f"Test Course {frappe.generate_hash()}"

		course = self._create_course(course_name)

		self.assertEqual(course.title, course_name)
		self.assertTrue(frappe.db.exists("LMS Course", course.name))

	def test_delete_course(self):
		course = self._create_course(f"Test Course {frappe.generate_hash()}")
		chapter = self._create_chapter(f"Test Chapter {frappe.generate_hash()}", course.name)
		lesson = self._create_lesson(f"Test Lesson {frappe.generate_hash()}", chapter.name)

		self._create_lesson_reference(chapter.name, lesson.name)
		self._create_chapter_reference(course.name, chapter.name)

		user_email = f"test_{frappe.generate_hash()}@example.com"
		self._create_user("Test Member", user_email)
		enrollment = self._create_enrollment(user_email, course.name)
		self._create_progress(user_email, course.name, lesson.name)

		delete_course(course.name)

		self.assertFalse(frappe.db.exists("LMS Course", course.name))
		self.assertFalse(frappe.db.exists("Course Chapter", chapter.name))
		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertFalse(frappe.db.exists("LMS Enrollment", enrollment.name))
		self.assertFalse(frappe.db.exists("LMS Course Progress", {"course": course.name}))
		self.assertFalse(frappe.db.exists("Chapter Reference", {"parent": course.name}))
		self.assertFalse(frappe.db.exists("Lesson Reference", {"parent": chapter.name}))

	def _ensure_test_user(self):
		self._create_evaluator()
		user = frappe.db.get_value(
			"User",
			{"user_type": "System User"},
		)
		return user

	def _create_course(self, title, additional_filters=None):
		user = self._ensure_test_user()

		filters = {
			"title": title,
			"short_introduction": title,
			"description": title,
			"video_link": "https://youtu.be/pEbIhUySqbk",
			"image": "/assets/lms/images/course-home.png",
			"instructors": [{"instructor": user}],
			"published": 1,
		}

		if additional_filters:
			filters.update(additional_filters)

		course = frappe.new_doc("LMS Course")
		course.update(filters)
		course.save()
		self.cleanup_items.append(("LMS Course", course.name))
		return course

	def _create_chapter(self, title, course):
		chapter = frappe.new_doc("Course Chapter")
		chapter.update(
			{
				"title": title,
				"course": course,
			}
		)
		chapter.save()
		self.cleanup_items.append(("Course Chapter", chapter.name))
		return chapter

	def _create_lesson(self, title, chapter):
		lesson = frappe.new_doc("Course Lesson")
		lesson.update(
			{
				"title": title,
				"chapter": chapter,
			}
		)
		lesson.save()
		self.cleanup_items.append(("Course Lesson", lesson.name))
		return lesson

	def _create_lesson_reference(self, chapter, lesson):
		lesson_ref = frappe.get_doc(
			{
				"doctype": "Lesson Reference",
				"lesson": lesson,
				"parent": chapter,
				"parenttype": "Course Chapter",
				"parentfield": "lessons",
				"idx": 1,
			}
		)
		lesson_ref.insert()
		self.cleanup_items.append(("Lesson Reference", lesson_ref.name))
		return lesson_ref

	def _create_chapter_reference(self, course, chapter):
		chapter_ref = frappe.get_doc(
			{
				"doctype": "Chapter Reference",
				"chapter": chapter,
				"parent": course,
				"parenttype": "LMS Course",
				"parentfield": "chapters",
				"idx": 1,
			}
		)
		chapter_ref.insert()
		self.cleanup_items.append(("Chapter Reference", chapter_ref.name))
		return chapter_ref

	def _create_user(self, name, email):
		user = frappe.db.exists("User", email)
		if user:
			return frappe.get_doc("User", user)

		doc = frappe.new_doc("User")
		doc.update(
			{
				"email": email,
				"first_name": name,
				"send_welcome_email": False,
			}
		)
		doc.save()
		self.cleanup_items.append(("User", doc.name))
		return doc

	def _create_enrollment(self, member, course):
		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.update(
			{
				"member": member,
				"course": course,
			}
		)
		enrollment.insert()
		self.cleanup_items.append(("LMS Enrollment", enrollment.name))
		return enrollment

	def _create_progress(self, member, course, lesson):
		progress = frappe.new_doc("LMS Course Progress")
		progress.update(
			{
				"member": member,
				"course": course,
				"lesson": lesson,
			}
		)
		progress.insert()
		self.cleanup_items.append(("LMS Course Progress", progress.name))
		return progress

	def _create_evaluator(self):
		if not frappe.db.exists("Course Evaluator", "evaluator@example.com"):
			self._create_user("Evaluator", "evaluator@example.com")
			evaluator = frappe.get_doc({"doctype": "Course Evaluator", "evaluator": "evaluator@example.com"})
			evaluator.save(ignore_permissions=True)
			self.cleanup_items.append(("Course Evaluator", evaluator.name))
