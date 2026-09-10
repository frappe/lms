# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import unittest
from datetime import timedelta
from unittest.mock import patch

import frappe
from frappe.utils import now_datetime

from lms.lms.schedule_utils import (
	assert_within_schedule,
	get_schedule_block_reason,
	validate_schedule_fields,
)


class _ScheduleDoc:
	def __init__(self, enable_scheduling=0, schedule_start=None, schedule_end=None):
		self.enable_scheduling = enable_scheduling
		self.schedule_start = schedule_start
		self.schedule_end = schedule_end


class TestScheduleUtils(unittest.TestCase):
	def test_disabled_schedule_clears_dates(self):
		doc = _ScheduleDoc(
			enable_scheduling=0,
			schedule_start=now_datetime(),
			schedule_end=now_datetime() + timedelta(days=1),
		)
		validate_schedule_fields(doc)
		self.assertIsNone(doc.schedule_start)
		self.assertIsNone(doc.schedule_end)

	def test_enabled_requires_start(self):
		doc = _ScheduleDoc(enable_scheduling=1, schedule_start=None)
		self.assertRaises(frappe.ValidationError, validate_schedule_fields, doc)

	def test_end_must_be_after_start(self):
		start = now_datetime()
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=start,
			schedule_end=start - timedelta(hours=1),
		)
		self.assertRaises(frappe.ValidationError, validate_schedule_fields, doc)

	def test_valid_window_passes(self):
		start = now_datetime()
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=start,
			schedule_end=start + timedelta(days=1),
		)
		validate_schedule_fields(doc)

	def test_block_reason_not_started(self):
		start = now_datetime() + timedelta(days=1)
		self.assertEqual(
			get_schedule_block_reason(1, start, None),
			"not_started",
		)

	def test_block_reason_ended(self):
		end = now_datetime() - timedelta(hours=1)
		self.assertEqual(
			get_schedule_block_reason(1, now_datetime() - timedelta(days=1), end),
			"ended",
		)

	def test_block_reason_open_without_end(self):
		start = now_datetime() - timedelta(hours=1)
		self.assertIsNone(get_schedule_block_reason(1, start, None))

	def test_assert_within_schedule_throws_before_start(self):
		start = now_datetime() + timedelta(days=1)
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
		start = now_datetime()
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"Schedule Quiz {frappe.generate_hash(length=6)}",
				"passing_percentage": 50,
				"enable_scheduling": 1,
				"schedule_start": start,
				"schedule_end": start - timedelta(hours=1),
			}
		)
		self.assertRaises(frappe.ValidationError, quiz.insert)

	def test_submit_quiz_blocked_before_start(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz

		start = now_datetime() + timedelta(days=2)
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"Future Quiz {frappe.generate_hash(length=6)}",
				"passing_percentage": 50,
				"enable_scheduling": 1,
				"schedule_start": start,
			}
		).insert(ignore_permissions=True)

		with patch("lms.lms.permissions.can_access_quiz", return_value=True):
			with self.assertRaises(frappe.ValidationError):
				submit_quiz(quiz=quiz.name, results="[]")


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
		end = now_datetime() - timedelta(hours=1)
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": f"Ended ASG {frappe.generate_hash(length=6)}",
				"type": "Text",
				"question": "Answer this",
				"enable_scheduling": 1,
				"schedule_start": end - timedelta(days=1),
				"schedule_end": end,
			}
		).insert(ignore_permissions=True)

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
				self.assertRaises(frappe.ValidationError, submission.insert, ignore_permissions=True)
