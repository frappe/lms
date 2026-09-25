import json

import frappe

from lms.lms.gateway_tools import create_lesson_quiz
from lms.lms.test_helpers import BaseTestUtils


class TestGatewayQuizTools(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=8)
		self.instructor = self._create_user(
			f"quiz-tool-instructor-{suffix}@example.com",
			"Quiz",
			"Instructor",
			["Course Creator"],
		)
		self.student = self._create_user(
			f"quiz-tool-student-{suffix}@example.com", "Quiz", "Student", ["LMS Student"]
		)
		self.course = self._create_course(
			title=f"Gateway Quiz Course {suffix}", instructor=self.instructor.email
		)
		self.chapter = self._create_chapter(f"Gateway Quiz Chapter {suffix}", self.course.name)
		self.lesson = self._create_lesson(
			f"Gateway Quiz Lesson {suffix}", self.chapter.name, self.course.name
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _quiz_payload(self):
		return {
			"title": f"Gateway Quiz {frappe.generate_hash(length=6)}",
			"passing_percentage": 75,
			"max_attempts": 2,
			"show_answers": True,
			"questions": [
				{
					"text": "Which values are even?",
					"type": "multiple_choice",
					"marks": 3,
					"options": [
						{"text": "Two", "is_correct": True},
						{"text": "Three", "is_correct": False},
						{"text": "Four", "is_correct": True},
					],
				},
				{
					"text": "Name the LMS framework.",
					"type": "short_answer",
					"marks": 2,
					"answers": ["Frappe", "Frappe Framework"],
				},
			],
		}

	def _remember_created_docs(self, result):
		for question in result["questions"]:
			self.cleanup_items.append(("LMS Question", question))
		self.cleanup_items.append(("LMS Quiz", result["quiz"]))

	def test_instructor_creates_quiz_and_attaches_it_to_lesson(self):
		original_blocks = json.loads(self.lesson.content)["blocks"]
		frappe.set_user(self.instructor.email)

		result = create_lesson_quiz(self.lesson.name, self._quiz_payload())
		self._remember_created_docs(result)

		self.assertEqual(result["course"], self.course.name)
		self.assertEqual(result["lesson"], self.lesson.name)
		self.assertEqual(result["total_marks"], 5)
		self.assertEqual(len(result["questions"]), 2)

		quiz = frappe.get_doc("LMS Quiz", result["quiz"])
		self.assertEqual(quiz.course, self.course.name)
		self.assertEqual(quiz.lesson, self.lesson.name)
		self.assertEqual(quiz.passing_percentage, 75)
		self.assertEqual(quiz.max_attempts, 2)
		self.assertEqual(len(quiz.questions), 2)

		choice = frappe.get_doc("LMS Question", result["questions"][0])
		self.assertEqual(choice.type, "Choices")
		self.assertEqual(choice.option_1, "Two")
		self.assertEqual(choice.is_correct_1, 1)
		self.assertEqual(choice.multiple, 1)

		short_answer = frappe.get_doc("LMS Question", result["questions"][1])
		self.assertEqual(short_answer.type, "User Input")
		self.assertEqual(short_answer.possibility_2, "Frappe Framework")

		blocks = json.loads(frappe.db.get_value("Course Lesson", self.lesson.name, "content"))["blocks"]
		self.assertEqual(blocks[:-1], original_blocks)
		self.assertEqual(blocks[-1]["type"], "quiz")
		self.assertEqual(blocks[-1]["data"]["quiz"], quiz.name)

	def test_student_cannot_create_a_quiz_for_the_lesson(self):
		quiz_count = frappe.db.count("LMS Quiz")
		question_count = frappe.db.count("LMS Question")
		original_content = self.lesson.content
		frappe.set_user(self.student.email)

		with self.assertRaises(frappe.PermissionError):
			create_lesson_quiz(self.lesson.name, self._quiz_payload())

		self.assertEqual(frappe.db.count("LMS Quiz"), quiz_count)
		self.assertEqual(frappe.db.count("LMS Question"), question_count)
		self.assertEqual(frappe.db.get_value("Course Lesson", self.lesson.name, "content"), original_content)

	def test_invalid_lesson_content_rolls_back_created_quiz_and_questions(self):
		frappe.db.set_value("Course Lesson", self.lesson.name, "content", "https://example.com/video")
		quiz_count = frappe.db.count("LMS Quiz")
		question_count = frappe.db.count("LMS Question")
		frappe.set_user(self.instructor.email)

		with self.assertRaises(frappe.ValidationError):
			create_lesson_quiz(self.lesson.name, self._quiz_payload())

		self.assertEqual(frappe.db.count("LMS Quiz"), quiz_count)
		self.assertEqual(frappe.db.count("LMS Question"), question_count)
		self.assertEqual(
			frappe.db.get_value("Course Lesson", self.lesson.name, "content"),
			"https://example.com/video",
		)

	def test_rejects_invalid_question_before_writing(self):
		payload = self._quiz_payload()
		payload["questions"][0]["options"] = [
			{"text": "One", "is_correct": False},
			{"text": "Two", "is_correct": False},
		]
		quiz_count = frappe.db.count("LMS Quiz")
		question_count = frappe.db.count("LMS Question")
		frappe.set_user(self.instructor.email)

		with self.assertRaises(frappe.ValidationError):
			create_lesson_quiz(self.lesson.name, payload)

		self.assertEqual(frappe.db.count("LMS Quiz"), quiz_count)
		self.assertEqual(frappe.db.count("LMS Question"), question_count)
