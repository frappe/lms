import frappe

from lms.lms.doctype.course_lesson import course_lesson
from lms.lms.test_helpers import BaseTestUtils


class TestEmptyQuizCompletion(BaseTestUtils):
	"""A quiz the learner cannot submit must not hold the lesson back."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"eq-instructor@example.com", "Empty", "Instructor", ["Course Creator"]
		)
		cls.student = cls._create_user("eq-student@example.com", "Empty", "Student", ["LMS Student"])
		cls.course = cls._create_course("Empty Quiz Course", instructor=cls.instructor.email)
		cls.chapter = cls._create_chapter("Empty Quiz Chapter", cls.course.name)
		cls._create_chapter_reference(cls.course.name, cls.chapter.name)
		cls._create_enrollment(cls.student.email, cls.course.name)

		original_capture = course_lesson.capture
		course_lesson.capture = lambda *a, **k: None
		cls.addClassCleanup(setattr, course_lesson, "capture", original_capture)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _lesson_with_quiz(self, quiz):
		content = frappe.as_json({"blocks": [{"type": "quiz", "data": {"quiz": quiz}}]})
		lesson = self._create_lesson(f"Lesson {quiz}", self.chapter.name, self.course.name, content)
		self._create_lesson_reference(self.chapter.name, lesson.name)
		return lesson

	def _completes(self, lesson):
		frappe.set_user(self.student.email)
		course_lesson.save_progress(lesson.name, self.course.name)
		frappe.set_user("Administrator")
		return frappe.db.exists(
			"LMS Course Progress",
			{"lesson": lesson.name, "member": self.student.email, "status": "Complete"},
		)

	def test_quiz_without_questions_does_not_block_the_lesson(self):
		quiz = self._create_quiz([], title="Empty Quiz")
		self.assertTrue(self._completes(self._lesson_with_quiz(quiz.name)))

	def test_quiz_whose_questions_were_deleted_does_not_block_the_lesson(self):
		question = self._create_quiz_questions()[0]
		quiz = self._create_quiz([question], title="Orphaned Quiz")
		frappe.db.delete("LMS Question", question.name)
		self.assertTrue(self._completes(self._lesson_with_quiz(quiz.name)))

	def test_unsubmitted_quiz_with_a_question_still_blocks_the_lesson(self):
		quiz = self._create_quiz(self._create_quiz_questions()[:1], title="Real Quiz")
		self.assertFalse(self._completes(self._lesson_with_quiz(quiz.name)))
