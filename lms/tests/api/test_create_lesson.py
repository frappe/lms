import frappe

from lms.lms.api import _new_lesson_title_max_length, create_lesson
from lms.lms.test_helpers import BaseTestUtils


class TestCreateLesson(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Course Creator", "Moderator"]
		)
		cls.other_creator = cls._create_user(
			"create-lesson-other@example.com", "Other", "Creator", ["Course Creator"]
		)
		cls.student = cls._create_user("student1@example.com", "Ashley", "Smith", ["LMS Student"])
		cls.course = cls._create_course(title=f"Create Lesson Course {frappe.generate_hash(length=6)}")
		cls.chapter = cls._create_chapter(
			f"Create Lesson Chapter {frappe.generate_hash(length=6)}", cls.course.name
		)

	def setUp(self):
		super().setUp()
		frappe.set_user(self.instructor.name)

	def _lessons(self):
		return frappe.get_all("Lesson Reference", filters={"parent": self.chapter.name}, pluck="lesson")

	def test_without_title_uses_untitled_placeholder(self):
		name = create_lesson(self.chapter.name)
		self.assertEqual(frappe.db.get_value("Course Lesson", name, "title"), "Untitled lesson")

	def test_title_is_stripped_and_appended_to_the_chapter(self):
		before = len(self._lessons())
		name = create_lesson(self.chapter.name, "  Getting started  ")

		lesson = frappe.db.get_value("Course Lesson", name, ["title", "chapter", "course"], as_dict=True)
		self.assertEqual(lesson.title, "Getting started")
		self.assertEqual((lesson.chapter, lesson.course), (self.chapter.name, self.course.name))
		idx = frappe.db.get_value("Lesson Reference", {"parent": self.chapter.name, "lesson": name}, "idx")
		self.assertEqual(idx, before + 1)

	def test_longest_title_that_fits_the_docname_is_accepted(self):
		title = "x" * _new_lesson_title_max_length()
		name = create_lesson(self.chapter.name, title)
		self.assertEqual(frappe.db.get_value("Course Lesson", name, "title"), title)

	def test_invalid_titles_are_rejected_before_anything_is_inserted(self):
		before = self._lessons()
		for title in ("", "   ", "\n\t", "x" * (_new_lesson_title_max_length() + 1)):
			with self.subTest(title=title), self.assertRaises(frappe.ValidationError):
				create_lesson(self.chapter.name, title)
		self.assertEqual(self._lessons(), before)

	def test_non_string_title_is_rejected_by_the_whitelist_wrapper(self):
		with self.assertRaises(frappe.FrappeTypeError):
			create_lesson(self.chapter.name, ["Title"])

	def test_non_string_title_is_rejected_by_the_body_guard(self):
		for title in (["Title"], {"title": "x"}, 5):
			with (
				self.subTest(title=title),
				self.assertRaisesRegex(frappe.ValidationError, "must be a string"),
			):
				create_lesson.__wrapped__(self.chapter.name, title)

	def test_non_string_chapter_is_rejected_by_the_body_guard(self):
		with self.assertRaisesRegex(frappe.ValidationError, "must be a string"):
			create_lesson.__wrapped__(["!=", ""], "Title")

	def test_callers_who_cannot_modify_the_course_are_refused(self):
		before = self._lessons()
		for user in (self.student.name, self.other_creator.name, "Guest"):
			frappe.set_user(user)
			with self.subTest(user=user), self.assertRaises(frappe.PermissionError):
				create_lesson(self.chapter.name, "Sneaky lesson")
		frappe.set_user("Administrator")
		self.assertEqual(self._lessons(), before)
