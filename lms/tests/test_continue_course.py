# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.utils import add_to_date, now_datetime

from lms.lms.api import get_course_to_continue
from lms.lms.telemetry import DEMO_COURSE_TITLE
from lms.lms.test_helpers import BaseTestUtils


class TestCourseToContinue(BaseTestUtils):
	"""The continue-your-course panel: the draft its instructor edited last, shown only
	while the site has no published course of its own."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.author = cls._create_user("continue-author@example.com", "Continue", "Author", ["Course Creator"])
		cls.other = cls._create_user("continue-other@example.com", "Continue", "Other", ["Course Creator"])

	def setUp(self):
		super().setUp()
		# The site-wide "no published course yet" rule reads every course, so each
		# test starts from an empty table. The base class's savepoint restores it.
		for doctype in ("Course Lesson", "Course Chapter", "LMS Course"):
			frappe.db.delete(doctype)
		frappe.set_user(self.author.email)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _draft(self, title, instructor=None):
		user = frappe.session.user
		frappe.set_user("Administrator")
		course = self._create_course(title=title, instructor=instructor or self.author.email)
		frappe.db.set_value("LMS Course", course.name, {"published": 0, "published_on": None})
		frappe.set_user(user)
		return course.name

	def _chapter_with_lesson(self, course, content=None):
		user = frappe.session.user
		frappe.set_user("Administrator")
		chapter = self._create_chapter(f"{course} chapter", course)
		self._create_chapter_reference(course, chapter.name, idx=1)
		lesson = self._create_lesson(f"{course} lesson", chapter.name, course, content=content)
		self._create_lesson_reference(chapter.name, lesson.name)
		frappe.set_user(user)
		return chapter.name, lesson.name

	def _touch(self, doctype, name, minutes):
		frappe.db.set_value(
			doctype, name, "modified", add_to_date(now_datetime(), minutes=minutes), update_modified=False
		)

	def test_nothing_without_a_draft(self):
		self.assertIsNone(get_course_to_continue())

	def test_the_author_gets_their_draft_and_its_open_steps(self):
		course = self._draft("Continue Draft")
		result = get_course_to_continue()
		self.assertEqual(result["course"], course)
		self.assertEqual(result["title"], "Continue Draft")
		self.assertIsNone(result["lesson"])
		self.assertEqual(
			[(s["name"], s["done"]) for s in result["steps"]],
			[("chapter", False), ("lesson", False), ("publish", False)],
		)

	def test_a_chapter_and_a_lesson_with_content_close_their_steps(self):
		course = self._draft("Continue Draft")
		_, lesson = self._chapter_with_lesson(course)
		result = get_course_to_continue()
		self.assertEqual(result["lesson"], lesson)
		self.assertEqual([s["done"] for s in result["steps"]], [True, True, False])

	def test_an_empty_lesson_leaves_the_lesson_step_open(self):
		course = self._draft("Continue Draft")
		empty = '{"time":1,"blocks":[{"id":"a","type":"markdown","data":{"text":""}}],"version":"2.29.0"}'
		self._chapter_with_lesson(course, content=empty)
		result = get_course_to_continue()
		self.assertEqual([s["done"] for s in result["steps"]], [True, False, False])

	def test_someone_who_does_not_instruct_the_draft_sees_nothing(self):
		self._draft("Continue Draft")
		frappe.set_user(self.other.email)
		self.assertIsNone(get_course_to_continue())

	def test_the_draft_edited_last_wins_even_when_the_edit_was_a_lesson(self):
		older = self._draft("Older Draft")
		newer = self._draft("Newer Draft")
		_, older_lesson = self._chapter_with_lesson(older)
		# The newer course document was saved last, but the older course's lesson
		# was edited after that.
		self._touch("LMS Course", newer, minutes=-10)
		self._touch("LMS Course", older, minutes=-30)
		self._touch("Course Lesson", older_lesson, minutes=-5)
		result = get_course_to_continue()
		self.assertEqual(result["course"], older)
		self.assertEqual(result["lesson"], older_lesson)

	def test_a_published_course_on_the_site_ends_the_panel_for_good(self):
		self._draft("Continue Draft")
		frappe.set_user("Administrator")
		self._create_course(title="Published Course", instructor=self.other.email)
		frappe.set_user(self.author.email)
		self.assertEqual(get_course_to_continue(), {"done": True})

	def test_a_quiz_or_scorm_lesson_counts_as_content(self):
		course = self._draft("Continue Draft")
		_, lesson = self._chapter_with_lesson(course, content="")
		frappe.db.set_value("Course Lesson", lesson, "is_scorm_package", 1)
		self.assertEqual([s["done"] for s in get_course_to_continue()["steps"]], [True, True, False])

	def test_last_edited_counts_a_chapter_edit(self):
		course = self._draft("Continue Draft")
		chapter, lesson = self._chapter_with_lesson(course)
		self._touch("LMS Course", course, minutes=-30)
		self._touch("Course Lesson", lesson, minutes=-20)
		self._touch("Course Chapter", chapter, minutes=-5)
		result = get_course_to_continue()
		self.assertEqual(result["last_edited"], frappe.db.get_value("Course Chapter", chapter, "modified"))

	def test_the_demo_course_does_not_count_as_published(self):
		course = self._draft("Continue Draft")
		frappe.set_user("Administrator")
		self._create_course(title=DEMO_COURSE_TITLE, instructor=self.other.email)
		frappe.set_user(self.author.email)
		self.assertEqual(get_course_to_continue()["course"], course)

	def test_a_guest_cannot_call_it(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			frappe.is_whitelisted(get_course_to_continue)
