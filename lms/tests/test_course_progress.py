import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_course_progress


class TestCourseProgress(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		suffix = frappe.generate_hash(length=8)
		self.student = self._create_user(
			f"progress-{suffix}@example.com", "Progress", "Student", ["LMS Student"]
		)
		self.course = self._create_course(title=f"Progress Course {suffix}")
		chapter = self._create_chapter(f"Progress Chapter {suffix}", self.course.name)
		self._create_chapter_reference(self.course.name, chapter.name)

		self.lessons = []
		for i in range(2):
			lesson = self._create_lesson(f"Progress Lesson {i} {suffix}", chapter.name, self.course.name)
			self._create_lesson_reference(chapter.name, lesson.name)
			self.lessons.append(lesson.name)

		self.removed_lesson = self._create_lesson(
			f"Removed Lesson {suffix}", chapter.name, self.course.name
		).name

	def test_progress_ignores_lessons_removed_from_the_course(self):
		# Regression: progress over 100% from orphan rows (#3006, fixed in #3042).
		self._create_lesson_progress(self.student.name, self.course.name, self.lessons[0])
		self._create_lesson_progress(self.student.name, self.course.name, self.removed_lesson)

		self.assertEqual(get_course_progress(self.course.name, self.student.name), 50)

	def test_progress_never_exceeds_100(self):
		# Regression: duplicate rows still pushed progress over 100% (#3006, fixed in #3042).
		for lesson in self.lessons:
			self._create_lesson_progress(self.student.name, self.course.name, lesson)
		frappe.get_doc(
			{
				"doctype": "LMS Course Progress",
				"member": self.student.name,
				"course": self.course.name,
				"lesson": self.lessons[0],
				"status": "Complete",
			}
		).db_insert()

		self.assertEqual(get_course_progress(self.course.name, self.student.name), 100)
