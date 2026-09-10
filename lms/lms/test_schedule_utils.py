# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import unittest
from datetime import timedelta
from unittest.mock import patch
<<<<<<< HEAD
from zoneinfo import ZoneInfo

import frappe
from frappe.utils import get_datetime, get_system_timezone

from lms.lms.schedule_utils import (
	assert_within_schedule,
	datetime_to_iso,
	enrich_schedule_payload,
=======

import frappe
from frappe.utils import now_datetime

from lms.lms.schedule_utils import (
	assert_within_schedule,
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
	get_schedule_block_reason,
	validate_schedule_fields,
)

<<<<<<< HEAD
# Fixed wall-clock used for every time-dependent assertion so the suite does
# not depend on when it runs.
FIXED_NOW = get_datetime("2026-06-15 12:00:00")

=======
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)

class _ScheduleDoc:
	def __init__(self, enable_scheduling=0, schedule_start=None, schedule_end=None):
		self.enable_scheduling = enable_scheduling
		self.schedule_start = schedule_start
		self.schedule_end = schedule_end


class TestScheduleUtils(unittest.TestCase):
	def test_disabled_schedule_clears_dates(self):
		doc = _ScheduleDoc(
			enable_scheduling=0,
<<<<<<< HEAD
			schedule_start=FIXED_NOW,
			schedule_end=FIXED_NOW + timedelta(days=1),
=======
			schedule_start=now_datetime(),
			schedule_end=now_datetime() + timedelta(days=1),
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
		)
		validate_schedule_fields(doc)
		self.assertIsNone(doc.schedule_start)
		self.assertIsNone(doc.schedule_end)

	def test_enabled_requires_start(self):
		doc = _ScheduleDoc(enable_scheduling=1, schedule_start=None)
		self.assertRaises(frappe.ValidationError, validate_schedule_fields, doc)

	def test_end_must_be_after_start(self):
<<<<<<< HEAD
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=FIXED_NOW,
			schedule_end=FIXED_NOW - timedelta(hours=1),
=======
		start = now_datetime()
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=start,
			schedule_end=start - timedelta(hours=1),
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
		)
		self.assertRaises(frappe.ValidationError, validate_schedule_fields, doc)

	def test_valid_window_passes(self):
<<<<<<< HEAD
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=FIXED_NOW,
			schedule_end=FIXED_NOW + timedelta(days=1),
=======
		start = now_datetime()
		doc = _ScheduleDoc(
			enable_scheduling=1,
			schedule_start=start,
			schedule_end=start + timedelta(days=1),
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
		)
		validate_schedule_fields(doc)

	def test_block_reason_not_started(self):
<<<<<<< HEAD
		start = FIXED_NOW + timedelta(days=1)
		self.assertEqual(
			get_schedule_block_reason(1, start, None, now=FIXED_NOW),
=======
		start = now_datetime() + timedelta(days=1)
		self.assertEqual(
			get_schedule_block_reason(1, start, None),
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
			"not_started",
		)

	def test_block_reason_ended(self):
<<<<<<< HEAD
		end = FIXED_NOW - timedelta(hours=1)
		self.assertEqual(
			get_schedule_block_reason(1, FIXED_NOW - timedelta(days=1), end, now=FIXED_NOW),
=======
		end = now_datetime() - timedelta(hours=1)
		self.assertEqual(
			get_schedule_block_reason(1, now_datetime() - timedelta(days=1), end),
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
			"ended",
		)

	def test_block_reason_open_without_end(self):
<<<<<<< HEAD
		start = FIXED_NOW - timedelta(hours=1)
		self.assertIsNone(get_schedule_block_reason(1, start, None, now=FIXED_NOW))

	def test_assert_within_schedule_throws_before_start(self):
		start = FIXED_NOW + timedelta(days=1)
		with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
			with self.assertRaises(frappe.ValidationError):
				assert_within_schedule(1, start, None, label="Quiz")

	def test_datetime_to_iso_uses_system_timezone(self):
		iso = datetime_to_iso(FIXED_NOW)
		self.assertTrue(iso.startswith("2026-06-15T12:00:00"))
		aware = get_datetime(FIXED_NOW).replace(tzinfo=ZoneInfo(get_system_timezone()))
		self.assertEqual(iso, aware.isoformat())

	def test_enrich_schedule_payload_adds_iso_and_reason(self):
		with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
			payload = enrich_schedule_payload(
				{
					"enable_scheduling": 1,
					"schedule_start": FIXED_NOW + timedelta(days=1),
					"schedule_end": None,
				}
			)
		self.assertEqual(payload["schedule_block_reason"], "not_started")
		self.assertTrue(payload["schedule_start_iso"].startswith("2026-06-16T12:00:00"))
		self.assertIsNone(payload["schedule_end_iso"])
=======
		start = now_datetime() - timedelta(hours=1)
		self.assertIsNone(get_schedule_block_reason(1, start, None))

	def test_assert_within_schedule_throws_before_start(self):
		start = now_datetime() + timedelta(days=1)
		with self.assertRaises(frappe.ValidationError):
			assert_within_schedule(1, start, None, label="Quiz")
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)


class TestLMSQuizScheduling(unittest.TestCase):
	def tearDown(self):
		frappe.db.rollback()

	def test_quiz_validate_requires_schedule_start(self):
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
<<<<<<< HEAD
				"title": "Schedule Quiz Missing Start",
=======
				"title": f"Schedule Quiz {frappe.generate_hash(length=6)}",
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
				"passing_percentage": 50,
				"enable_scheduling": 1,
			}
		)
		self.assertRaises(frappe.ValidationError, quiz.insert)

<<<<<<< HEAD
	def test_submit_quiz_blocked_before_start(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz

		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": "Schedule Quiz Submit Before Start",
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
				"title": "Schedule Quiz Withhold Questions",
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
		self.assertTrue(payload["quiz"]["schedule_start_iso"].startswith("2026-06-17T12:00:00"))
		self.assertEqual(payload["quiz"]["questions"], [])
		self.assertEqual(payload["questions_by_name"], {})
=======
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
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)


class TestLMSAssignmentScheduling(unittest.TestCase):
	def tearDown(self):
		frappe.db.rollback()

	def test_assignment_validate_requires_schedule_start(self):
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
<<<<<<< HEAD
				"title": "Schedule Assignment Missing Start",
=======
				"title": f"Schedule ASG {frappe.generate_hash(length=6)}",
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
				"type": "Text",
				"question": "Answer this",
				"enable_scheduling": 1,
			}
		)
		self.assertRaises(frappe.ValidationError, assignment.insert)

	def test_assignment_submission_blocked_after_end(self):
<<<<<<< HEAD
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": "Schedule Assignment Ended Window",
				"type": "Text",
				"question": "Answer this",
				"enable_scheduling": 1,
				"schedule_start": FIXED_NOW - timedelta(days=1),
				"schedule_end": FIXED_NOW - timedelta(hours=1),
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture, seeding the assignment under test
		assignment.insert(ignore_permissions=True)
=======
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
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)

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
<<<<<<< HEAD
				with patch("lms.lms.schedule_utils.now_datetime", return_value=FIXED_NOW):
					with self.assertRaises(frappe.ValidationError):
						# nosemgrep: lms-unjustified-ignore-permissions - exercise validate, not DocPerm
						submission.insert(ignore_permissions=True)

	def test_get_assignment_includes_schedule_block_reason(self):
		from lms.lms.utils import get_assignment

		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": "Schedule Assignment Future Window",
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
		self.assertTrue(payload["schedule_start_iso"].startswith("2026-06-16T12:00:00"))

	def test_get_assignment_requires_read_permission(self):
		from lms.lms.utils import get_assignment

		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": "Schedule Assignment Permission Check",
				"type": "Text",
				"question": "Answer this",
				"enable_scheduling": 0,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture
		assignment.insert(ignore_permissions=True)

		with patch.object(
			frappe.model.document.Document,
			"check_permission",
			side_effect=frappe.PermissionError,
		):
			self.assertRaises(frappe.PermissionError, get_assignment, assignment.name)
=======
				self.assertRaises(frappe.ValidationError, submission.insert, ignore_permissions=True)
>>>>>>> 60ef8e4 (feat(quiz): add availability scheduling for quizzes and assignments)
