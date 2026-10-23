# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""An open-ended answer scores nothing until an evaluator grades it, whatever
marks the page sends along with it."""

import json

import frappe

from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz
from lms.lms.test_helpers import BaseTestUtils


class TestOpenEndedMarks(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.learner = cls._create_user(f"oem-learn-{hash}@example.com", "Le", "Arner", ["LMS Student"]).name
		instructor = cls._create_user(f"oem-instr-{hash}@example.com", "In", "Str", ["Course Creator"]).name
		cls.course = cls._create_course(title=f"Open Ended Course {hash}", instructor=instructor).name

		question = frappe.new_doc("LMS Question")
		question.update({"question": f"Explain it {hash}", "type": "Open Ended"})
		question.save()
		cls.question = question.name

		quiz = frappe.new_doc("LMS Quiz")
		quiz.update({"title": f"Open Ended Quiz {hash}", "passing_percentage": 50, "total_marks": 5})
		quiz.append("questions", {"question": question.name, "marks": 5})
		quiz.save()
		cls.quiz = quiz.name
		cls.lesson = cls._place_in_lesson(cls.course, "LMS Quiz", cls.quiz).name
		# The stamp is what save_progress_after_quiz reads to find the lesson.
		cls._stamp_legacy_quiz_placement(cls.quiz, cls.course, cls.lesson)
		cls._create_enrollment(cls.learner, cls.course)

	def test_marks_sent_with_an_open_ended_answer_do_not_count(self):
		frappe.set_user(self.learner)
		results = [
			{
				"question_name": self.question,
				"answer": ["Because it is."],
				"marks": 5,
				"marks_out_of": 5,
				"is_correct": 1,
			}
		]
		result = submit_quiz(self.quiz, json.dumps(results))

		submission = frappe.get_doc("LMS Quiz Submission", result["submission"])
		self.assertEqual([row.marks for row in submission.result], [0])
		self.assertEqual(submission.score, 0)
		self.assertEqual(submission.percentage, 0)
		self.assertFalse(result["pass"])
		self.assertTrue(result["is_open_ended"])
		self.assertFalse(
			frappe.db.exists(
				"LMS Course Progress", {"member": self.learner, "lesson": self.lesson, "status": "Complete"}
			)
		)
