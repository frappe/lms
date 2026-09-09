# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest
from types import SimpleNamespace

from lms.lms.doctype.lms_quiz_submission.lms_quiz_submission import LMSQuizSubmission


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
