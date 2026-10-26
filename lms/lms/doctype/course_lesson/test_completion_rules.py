import frappe

from lms.lms.doctype.course_lesson import course_lesson
from lms.lms.doctype.course_lesson.course_lesson import (
	get_assignment_progress,
	get_programming_exercise_progress,
	get_quiz_progress,
)
from lms.lms.doctype.lms_quiz.lms_quiz import save_progress_after_quiz
from lms.lms.test_helpers import BaseTestUtils


class CompletionFixtures(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		instructor = cls._create_user(
			f"cr-instr-{hash}@example.com", "Rule", "Instructor", ["Course Creator"]
		)
		cls.student = cls._create_user(
			f"cr-student-{hash}@example.com", "Rule", "Student", ["LMS Student"]
		).name
		cls.course = cls._create_course(f"Completion Rule Course {hash}", instructor=instructor.email).name
		cls._create_enrollment(cls.student, cls.course)

		cls.quiz = cls._create_quiz(cls._create_quiz_questions()[:1], title=f"Rule Quiz {hash}")
		cls.quiz_lesson = cls._place_in_lesson(cls.course, "LMS Quiz", cls.quiz.name).name
		cls.assignment = cls._create_assignment(f"Rule Assignment {hash}").name
		cls.assignment_lesson = cls._place_in_lesson(cls.course, "LMS Assignment", cls.assignment).name
		cls.open_ended_quiz, cls.open_ended_question = cls._create_open_ended_quiz(hash)
		cls.open_ended_lesson = cls._place_in_lesson(cls.course, "LMS Quiz", cls.open_ended_quiz).name
		cls.exercise = cls._create_programming_exercise(f"Rule Exercise {hash}").name
		cls.exercise_lesson = cls._place_in_lesson(cls.course, "LMS Programming Exercise", cls.exercise).name

	@classmethod
	def _create_open_ended_quiz(cls, hash):
		question = frappe.get_doc(
			{"doctype": "LMS Question", "question": f"Explain it {hash}", "type": "Open Ended"}
		).insert()
		quiz = frappe.get_doc(
			{"doctype": "LMS Quiz", "title": f"Open Ended Rule Quiz {hash}", "passing_percentage": 50}
		)
		quiz.append("questions", {"question": question.name, "marks": 5})
		quiz.insert()
		return quiz.name, question.name

	@classmethod
	def _submit_quiz(cls, quiz, percentage):
		"""The score is written straight in: set_percentage would recompute it from rows."""
		submission = frappe.get_doc(
			{"doctype": "LMS Quiz Submission", "quiz": quiz, "member": cls.student, "passing_percentage": 70}
		).insert()
		frappe.db.set_value("LMS Quiz Submission", submission.name, "percentage", percentage)
		return submission.name

	@classmethod
	def _submit_assignment(cls, status):
		frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": cls.assignment,
				"member": cls.student,
				"answer": "My answer.",
				"status": status,
			}
		).insert()

	@classmethod
	def _submit_exercise(cls, status):
		frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise Submission",
				"exercise": cls.exercise,
				"member": cls.student,
				"code": "print(1)",
				"status": status,
			}
		).insert()


# Regression on this branch only, no upstream PR: each item is held to its own rule.
# Added on fix/course-progress-enforcement (no PR yet).
class TestCompletionRuleChecks(CompletionFixtures):
	def _quiz(self, rule):
		return get_quiz_progress(self.quiz_lesson, self.student, rule)

	def test_no_quiz_submission_meets_neither_rule(self):
		self.assertFalse(self._quiz("Attempted"))
		self.assertFalse(self._quiz("Passed"))

	def test_a_failing_quiz_submission_is_an_attempt_but_not_a_pass(self):
		self._submit_quiz(self.quiz.name, 0)
		self.assertTrue(self._quiz("Attempted"))
		self.assertFalse(self._quiz("Passed"))

	def test_a_passing_quiz_submission_meets_the_passed_rule(self):
		self._submit_quiz(self.quiz.name, 100)
		self.assertTrue(self._quiz("Passed"))

	def test_an_item_with_no_rule_does_not_hold_the_lesson(self):
		self.assertTrue(self._quiz(None))
		self.assertTrue(get_assignment_progress(self.assignment_lesson, self.student, None))
		self.assertTrue(get_programming_exercise_progress(self.exercise_lesson, self.student, None))

	def test_an_ungraded_assignment_is_an_attempt_but_not_a_pass(self):
		self._submit_assignment("Not Graded")
		self.assertTrue(get_assignment_progress(self.assignment_lesson, self.student, "Attempted"))
		self.assertFalse(get_assignment_progress(self.assignment_lesson, self.student, "Passed"))

	def test_a_passed_assignment_meets_the_passed_rule(self):
		self._submit_assignment("Pass")
		self.assertTrue(get_assignment_progress(self.assignment_lesson, self.student, "Passed"))

	def test_a_failed_exercise_is_an_attempt_but_not_a_pass(self):
		self._submit_exercise("Failed")
		self.assertTrue(get_programming_exercise_progress(self.exercise_lesson, self.student, "Attempted"))
		self.assertFalse(get_programming_exercise_progress(self.exercise_lesson, self.student, "Passed"))

	def test_a_passed_exercise_meets_the_passed_rule(self):
		self._submit_exercise("Passed")
		self.assertTrue(get_programming_exercise_progress(self.exercise_lesson, self.student, "Passed"))

	def test_an_ungraded_open_ended_quiz_is_an_attempt_but_not_a_pass(self):
		self._submit_quiz(self.open_ended_quiz, 0)
		self.assertTrue(get_quiz_progress(self.open_ended_lesson, self.student, "Passed", "Attempted"))
		self.assertFalse(get_quiz_progress(self.open_ended_lesson, self.student, "Attempted", "Passed"))

	def test_each_kind_of_quiz_is_held_only_to_its_own_rule(self):
		self.assertTrue(get_quiz_progress(self.open_ended_lesson, self.student, "Passed", None))
		self.assertFalse(get_quiz_progress(self.quiz_lesson, self.student, "Passed", None))
		self.assertTrue(get_quiz_progress(self.quiz_lesson, self.student, None, "Passed"))


# Regression on this branch only, no upstream PR: a grade completes the lesson it held back.
# Added on fix/course-progress-enforcement (no PR yet).
class TestGradingCompletesTheLesson(CompletionFixtures):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.video_assignment = cls._create_assignment(f"Video Rule Assignment {cls.course}").name
		chapter = cls._create_chapter(f"Video Chapter {cls.course}", cls.course)
		content = frappe.as_json(
			{
				"blocks": [
					{"type": "upload", "data": {"file_url": "/files/intro.mp4", "file_type": "mp4"}},
					{"type": "assignment", "data": {"assignment": cls.video_assignment}},
				]
			}
		)
		cls.video_lesson = cls._create_lesson(
			f"Video Lesson {cls.course}", chapter.name, cls.course, content
		).name
		cls.video_quiz = cls._create_quiz(cls._create_quiz_questions()[:1], title=f"Video Quiz {cls.course}")
		quiz_content = frappe.as_json(
			{
				"blocks": [
					{"type": "upload", "data": {"file_url": "/files/intro.mp4", "file_type": "mp4"}},
					{"type": "quiz", "data": {"quiz": cls.video_quiz.name}},
				]
			}
		)
		cls.video_quiz_lesson = cls._create_lesson(
			f"Video Quiz Lesson {cls.course}", chapter.name, cls.course, quiz_content
		).name
		cls.legacy_quiz, cls.legacy_question = cls._create_open_ended_quiz(f"legacy {cls.course}")
		cls.legacy_lesson = cls._create_lesson(
			f"Legacy Quiz Lesson {cls.course}", chapter.name, cls.course
		).name
		frappe.db.set_value(
			"Course Lesson",
			cls.legacy_lesson,
			{"content": None, "body": "A markdown lesson.", "quiz_id": cls.legacy_quiz},
		)

		original_capture = course_lesson.capture
		course_lesson.capture = lambda *a, **k: None
		cls.addClassCleanup(setattr, course_lesson, "capture", original_capture)

	def setUp(self):
		super().setUp()
		self._set_settings(
			enforce_video_completion=0,
			enforce_quiz_completion=1,
			enforce_quiz_passing=1,
			enforce_open_ended_quiz_passing=1,
			enforce_assignment_completion=1,
			enforce_assignment_passing=1,
		)

	def _set_settings(self, **values):
		for field, value in values.items():
			frappe.db.set_single_value("LMS Settings", field, value)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")

	def _is_complete(self, lesson):
		return bool(
			frappe.db.exists(
				"LMS Course Progress", {"member": self.student, "lesson": lesson, "status": "Complete"}
			)
		)

	def _grade_assignment(self, assignment, status):
		submission = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": assignment,
				"member": self.student,
				"answer": "My answer.",
				"status": "Not Graded",
			}
		).insert()
		self.assertFalse(self._is_complete(self.assignment_lesson))
		submission.status = status
		submission.save()

	def test_passing_an_assignment_completes_its_lesson(self):
		self._grade_assignment(self.assignment, "Pass")
		self.assertTrue(self._is_complete(self.assignment_lesson))

	def _resume_at(self, lesson):
		chapter = frappe.db.get_value("Course Lesson", self.assignment_lesson, "chapter")
		for idx, outlined in enumerate((self.assignment_lesson, self.open_ended_lesson), start=1):
			frappe.get_doc(
				{
					"doctype": "Lesson Reference",
					"lesson": outlined,
					"parent": chapter,
					"parenttype": "Course Chapter",
					"parentfield": "lessons",
					"idx": idx,
				}
			).insert()
		enrollment = frappe.db.get_value("LMS Enrollment", {"course": self.course, "member": self.student})
		frappe.db.set_value("LMS Enrollment", enrollment, "current_lesson", lesson)
		return enrollment

	# Regression on this branch only, no upstream PR: Continue Learning reopened a graded lesson.
	# Added on fix/course-progress-enforcement (no PR yet).
	def test_passing_an_assignment_moves_the_resume_point_past_its_lesson(self):
		enrollment = self._resume_at(self.assignment_lesson)
		self._grade_assignment(self.assignment, "Pass")
		self.assertEqual(
			frappe.db.get_value("LMS Enrollment", enrollment, "current_lesson"), self.open_ended_lesson
		)

	def test_grading_leaves_a_resume_point_the_learner_moved_on_from(self):
		enrollment = self._resume_at(self.exercise_lesson)
		self._grade_assignment(self.assignment, "Pass")
		self.assertEqual(
			frappe.db.get_value("LMS Enrollment", enrollment, "current_lesson"), self.exercise_lesson
		)

	def test_failing_an_assignment_leaves_its_lesson_open(self):
		self._grade_assignment(self.assignment, "Fail")
		self.assertFalse(self._is_complete(self.assignment_lesson))

	def test_a_lesson_with_an_enforced_video_waits_for_the_learner(self):
		self._set_settings(enforce_video_completion=1)
		self._grade_assignment(self.video_assignment, "Pass")
		self.assertFalse(self._is_complete(self.video_lesson))

	def test_the_same_lesson_completes_when_videos_are_not_enforced(self):
		self._grade_assignment(self.video_assignment, "Pass")
		self.assertTrue(self._is_complete(self.video_lesson))

	def _grade_open_ended_quiz(self, quiz, question, lesson):
		submission = frappe.get_doc(
			{
				"doctype": "LMS Quiz Submission",
				"quiz": quiz,
				"member": self.student,
				"score_out_of": 5,
				"passing_percentage": 50,
				"result": [
					{
						"question_name": question,
						"answer": "Because.",
						"marks": 0,
						"marks_out_of": 5,
					}
				],
			}
		).insert()
		self.assertEqual(submission.percentage, 0)
		self.assertFalse(self._is_complete(lesson))

		submission.result[0].marks = 5
		submission.save()

	def test_grading_an_open_ended_quiz_to_passing_completes_its_lesson(self):
		self._grade_open_ended_quiz(self.open_ended_quiz, self.open_ended_question, self.open_ended_lesson)
		self.assertTrue(self._is_complete(self.open_ended_lesson))

	def test_grading_a_legacy_quiz_id_quiz_completes_its_lesson(self):
		self._grade_open_ended_quiz(self.legacy_quiz, self.legacy_question, self.legacy_lesson)
		self.assertTrue(self._is_complete(self.legacy_lesson))

	def _submit_quiz_on_video_lesson(self):
		self._set_settings(enforce_quiz_passing=0)
		self._submit_quiz(self.video_quiz.name, 0)
		frappe.set_user(self.student)
		try:
			save_progress_after_quiz(frappe._dict(lesson=self.video_quiz_lesson, course=self.course))
		finally:
			frappe.set_user("Administrator")

	def test_a_quiz_submit_waits_for_an_enforced_video(self):
		self._set_settings(enforce_video_completion=1)
		self._submit_quiz_on_video_lesson()
		self.assertFalse(self._is_complete(self.video_quiz_lesson))

	def test_a_quiz_submit_completes_a_video_lesson_when_videos_are_not_enforced(self):
		self._submit_quiz_on_video_lesson()
		self.assertTrue(self._is_complete(self.video_quiz_lesson))
