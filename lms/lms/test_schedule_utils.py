# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import unittest
from datetime import timedelta
from unittest.mock import patch

import frappe
from frappe.utils import get_datetime

from lms.lms.schedule_utils import (
	assert_within_schedule,
	get_schedule_block_reason,
	validate_schedule_fields,
)

# Fixed wall-clock used for every time-dependent assertion so the suite does
# not depend on when it runs.
FIXED_NOW = get_datetime("2026-06-15 12:00:00")


class _ScheduleDoc:
	def __init__(self, enable_scheduling=0, schedule_start=None, schedule_end=None):
		self.enable_scheduling = enable_scheduling
		self.schedule_start = schedule_start
		self.schedule_end = schedule_end


class TestScheduleUtils(unittest.TestCase):
	def test_disabled_schedule_clears_dates(self):
		doc = _ScheduleDoc(
			enable_scheduling=0,
			schedule_start=FIXED_NOW,
			schedule_end=FIXED_NOW + timedelta(days=1),
		)
		validate_schedule_fields(doc)
		self.assertIsNone(doc.schedule_start)
		self.assertIsNone(doc.schedule_end)

	def test_enabled_requires_start(self):
		doc = _ScheduleDoc(enable_scheduling=1, schedule_start=None)
		self.assertRaises(frappe.ValidationError, validate_schedule_fields, doc)

	def test_end_must_be_after_start(self):
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=FIXED_NOW,
			schedule_end=FIXED_NOW - timedelta(hours=1),
		)
		self.assertRaises(frappe.ValidationError, validate_schedule_fields, doc)

	def test_valid_window_passes(self):
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=FIXED_NOW,
			schedule_end=FIXED_NOW + timedelta(days=1),
		)
		validate_schedule_fields(doc)

	def test_block_reason_not_started(self):
		start = FIXED_NOW + timedelta(days=1)
		self.assertEqual(
			get_schedule_block_reason(1, start, None, now=FIXED_NOW),
			"not_started",
		)

	def test_block_reason_ended(self):
		end = FIXED_NOW - timedelta(hours=1)
		self.assertEqual(
			get_schedule_block_reason(1, FIXED_NOW - timedelta(days=1), end, now=FIXED_NOW),
			"ended",
		)

	def test_block_reason_open_without_end(self):
		start = FIXED_NOW - timedelta(hours=1)
		self.assertIsNone(get_schedule_block_reason(1, start, None, now=FIXED_NOW))

	def test_assert_within_schedule_throws_before_start(self):
		start = FIXED_NOW + timedelta(days=1)
		with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
			with self.assertRaises(frappe.ValidationError):
				assert_within_schedule(1, start, None, label="Quiz")


class TestLMSQuizScheduling(unittest.TestCase):
	def tearDown(self):
		frappe.db.rollback()

	def test_quiz_validate_requires_schedule_start(self):
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"Schedule Quiz {frappe.generate_hash(length=6)}",
				"passing_percentage": 50,
				"enable_scheduling": 1,
			}
		)
		self.assertRaises(frappe.ValidationError, quiz.insert)

	def test_quiz_validate_rejects_end_before_start(self):
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"Schedule Quiz {frappe.generate_hash(length=6)}",
				"passing_percentage": 50,
				"enable_scheduling": 1,
				"schedule_start": FIXED_NOW,
				"schedule_end": FIXED_NOW - timedelta(hours=1),
			}
		)
		self.assertRaises(frappe.ValidationError, quiz.insert)

	def test_submit_quiz_blocked_before_start(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz

		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"Future Quiz {frappe.generate_hash(length=6)}",
				"passing_percentage": 50,
				"enable_scheduling": 1,
				"schedule_start": FIXED_NOW + timedelta(days=2),
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture, seeding the quiz under test
		quiz.insert(ignore_permissions=True)

		with patch("lms.lms.permissions.can_access_quiz", return_value=True):
			with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
				with self.assertRaises(frappe.ValidationError):
					submit_quiz(quiz=quiz.name, results="[]")

	def test_get_quiz_withholds_questions_before_start(self):
		from lms.lms.utils import get_quiz_with_questions

		question = frappe.get_doc(
			{
				"doctype": "LMS Question",
				"question": "Secret prompt",
				"type": "Choices",
				"option_1": "A",
				"is_correct_1": 1,
				"option_2": "B",
				"is_correct_2": 0,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture
		question.insert(ignore_permissions=True)

		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"Future Quiz {frappe.generate_hash(length=6)}",
				"passing_percentage": 50,
				"enable_scheduling": 1,
				"schedule_start": FIXED_NOW + timedelta(days=2),
				"questions": [{"question": question.name, "marks": 1}],
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture
		quiz.insert(ignore_permissions=True)

		with patch("lms.lms.permissions.can_access_quiz", return_value=True):
			with patch("lms.lms.utils.PRIVILEGED_ROLES", frozenset()):
				with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
					payload = get_quiz_with_questions(quiz.name)

		self.assertEqual(payload["quiz"]["schedule_block_reason"], "not_started")
		self.assertEqual(payload["quiz"]["questions"], [])
		self.assertEqual(payload["questions_by_name"], {})


class TestLMSAssignmentScheduling(unittest.TestCase):
	def tearDown(self):
		frappe.db.rollback()

	def test_assignment_validate_requires_schedule_start(self):
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": f"Schedule ASG {frappe.generate_hash(length=6)}",
				"type": "Text",
				"question": "Answer this",
				"enable_scheduling": 1,
			}
		)
		self.assertRaises(frappe.ValidationError, assignment.insert)

	def test_assignment_submission_blocked_after_end(self):
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": f"Ended ASG {frappe.generate_hash(length=6)}",
				"type": "Text",
				"question": "Answer this",
				"enable_scheduling": 1,
				"schedule_start": FIXED_NOW - timedelta(days=1),
				"schedule_end": FIXED_NOW - timedelta(hours=1),
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture, seeding the assignment under test
		assignment.insert(ignore_permissions=True)

		submission = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": assignment.name,
				"member": frappe.session.user,
				"type": "Text",
				"answer": "late answer",
			}
		)
		# Force student path: patch privileged roles empty for this user.
		with patch(
			"lms.lms.doctype.lms_assignment_submission.lms_assignment_submission.PRIVILEGED_ROLES",
			frozenset(),
		):
			with patch(
				"lms.lms.doctype.lms_assignment_submission.lms_assignment_submission.frappe.get_roles",
				return_value=["LMS Student"],
			):
				with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
					with self.assertRaises(frappe.ValidationError):
						# nosemgrep: lms-unjustified-ignore-permissions - exercise validate, not DocPerm
						submission.insert(ignore_permissions=True)

	def test_get_assignment_includes_schedule_block_reason(self):
		from lms.lms.utils import get_assignment

		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": f"Future ASG {frappe.generate_hash(length=6)}",
				"type": "Text",
				"question": "Answer this",
				"enable_scheduling": 1,
				"schedule_start": FIXED_NOW + timedelta(days=1),
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture
		assignment.insert(ignore_permissions=True)

		with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
			payload = get_assignment(assignment.name)

		self.assertEqual(payload["schedule_block_reason"], "not_started")
