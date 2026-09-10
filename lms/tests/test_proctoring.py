# Copyright (c) 2026, FOSS United and contributors
# See license.txt
"""
Tests for quiz proctoring: violation event persistence, permission gates, and
the is_open_ended_submission helper.

Organised into four layers:
  1. TestViolationEventNormalization  — pure unit tests on the client payload parser
  2. TestSaveViolationEventsDB        — integration: events actually land in DB
  3. TestSubmitQuizWithViolations     — integration: submit_quiz + violations end-to-end
  4. TestGetQuizViolationLogs         — permission checks + returned data shape
  5. TestIsOpenEndedSubmission        — boolean helper for frontend editable-marks gate
"""

import json
import unittest
from datetime import timedelta
from unittest.mock import patch

import frappe
from frappe.utils import add_to_date, convert_utc_to_system_timezone, get_datetime, now_datetime

from lms.lms.doctype.lms_quiz.lms_quiz import (
	MAX_VIOLATION_EVENTS,
	_normalise_violation_events,
	_save_violation_events,
	get_quiz_violation_logs,
	is_open_ended_submission,
	submit_quiz,
)

# ---------------------------------------------------------------------------
# Shared fixture builders
# ---------------------------------------------------------------------------


def _normalise(*events):
	"""Client payload in, storable rows out."""
	return _normalise_violation_events(json.dumps(list(events)))


def _local(iso_utc):
	"""The site-timezone datetime a UTC stamp from the browser should be stored as."""
	return convert_utc_to_system_timezone(get_datetime(iso_utc)).replace(tzinfo=None)


def _make_question():
	q = frappe.new_doc("LMS Question")
	q.update(
		{
			"question": f"Proctoring test question {frappe.generate_hash(length=6)}?",
			"type": "Choices",
			"option_1": "Correct",
			"is_correct_1": 1,
			"option_2": "Wrong",
			"is_correct_2": 0,
		}
	)
	q.save(ignore_permissions=True)
	return q


def _make_quiz(question, title=None):
	title = title or f"Proctoring Quiz {frappe.generate_hash(length=6)}"
	quiz = frappe.new_doc("LMS Quiz")
	quiz.update(
		{
			"title": title,
			"passing_percentage": 50,
			"enable_proctoring": 1,
			"max_violations": 3,
		}
	)
	quiz.append("questions", {"question": question.name, "marks": 5})
	quiz.save(ignore_permissions=True)
	return quiz


def _make_submission(quiz_name, member="Administrator"):
	sub = frappe.new_doc("LMS Quiz Submission")
	sub.update(
		{
			"quiz": quiz_name,
			"member": member,
			"score": 0,
			"score_out_of": 5,
			"percentage": 0,
			"passing_percentage": 50,
		}
	)
	sub.save(ignore_permissions=True)
	return sub


def _get_logs(submission_name):
	return frappe.get_all(
		"LMS Quiz Violation Log",
		filters={"quiz_submission": submission_name},
		fields=["event_type", "severity", "timestamp"],
		order_by="timestamp asc",
		ignore_permissions=True,
	)


# ---------------------------------------------------------------------------
# 1. Pure unit tests — no DB writes
# ---------------------------------------------------------------------------


class TestViolationEventNormalization(unittest.TestCase):
	"""_normalise_violation_events decides what part of a learner-supplied payload is
	fit to store: known event types, known severities, timestamps that are neither
	unparseable nor in the future."""

	def test_iso_timestamp_is_converted_from_utc_to_site_timezone(self):
		# JS Date.toISOString() is always UTC; the stored value must be in the site's
		# timezone so it reads in the same clock as every other date on the page.
		events = _normalise(
			{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-31T08:38:00.000Z"}
		)
		self.assertEqual(len(events), 1)
		self.assertEqual(events[0]["timestamp"], _local("2026-07-31T08:38:00.000Z"))

	def test_iso_timestamp_without_milliseconds_normalised(self):
		events = _normalise(
			{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-31T08:38:00Z"}
		)
		self.assertEqual(events[0]["timestamp"], _local("2026-07-31T08:38:00Z"))

	def test_missing_timestamp_falls_back_to_server_now(self):
		events = _normalise({"eventType": "tab_switch", "severity": "violation"})
		self.assertEqual(len(events), 1)
		self.assertAlmostEqual(events[0]["timestamp"], now_datetime(), delta=timedelta(minutes=1))

	def test_unparseable_timestamp_falls_back_to_server_now(self):
		events = _normalise({"eventType": "tab_switch", "severity": "violation", "timestamp": "not-a-date"})
		self.assertAlmostEqual(events[0]["timestamp"], now_datetime(), delta=timedelta(minutes=1))

	def test_future_timestamp_is_clamped_to_server_now(self):
		# A learner cannot backdate — or postdate — evidence by editing their clock.
		events = _normalise(
			{
				"eventType": "tab_switch",
				"severity": "violation",
				"timestamp": add_to_date(now_datetime(), years=1).isoformat(),
			}
		)
		self.assertAlmostEqual(events[0]["timestamp"], now_datetime(), delta=timedelta(minutes=1))

	def test_camel_case_eventType_key_is_accepted(self):
		events = _normalise(
			{"eventType": "no_face", "severity": "violation", "timestamp": "2026-01-01T00:00:00Z"}
		)
		self.assertEqual(events[0]["event_type"], "no_face")

	def test_snake_case_event_type_key_is_accepted(self):
		events = _normalise(
			{"event_type": "focus_loss", "severity": "violation", "timestamp": "2026-01-01T00:00:00Z"}
		)
		self.assertEqual(events[0]["event_type"], "focus_loss")

	def test_camel_case_takes_precedence_over_snake_case(self):
		# If both keys exist, camelCase wins (matches JS payload shape)
		events = _normalise(
			{"eventType": "tab_switch", "event_type": "no_face", "timestamp": "2026-01-01T00:00:00Z"}
		)
		self.assertEqual(events[0]["event_type"], "tab_switch")

	def test_unknown_event_type_is_silently_dropped(self):
		events = _normalise(
			{"eventType": "hacked_event", "severity": "violation"},
			{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-01-01T00:00:00Z"},
		)
		self.assertEqual(len(events), 1)
		self.assertEqual(events[0]["event_type"], "tab_switch")

	def test_non_dict_entries_are_skipped(self):
		events = _normalise(
			"tab_switch",
			None,
			{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-01-01T00:00:00Z"},
		)
		self.assertEqual(len(events), 1)

	def test_invalid_severity_coerced_to_violation(self):
		events = _normalise(
			{"eventType": "tab_switch", "severity": "critical", "timestamp": "2026-01-01T00:00:00Z"}
		)
		self.assertEqual(events[0]["severity"], "violation")

	def test_warning_severity_preserved(self):
		events = _normalise(
			{"eventType": "no_face", "severity": "warning", "timestamp": "2026-01-01T00:00:00Z"}
		)
		self.assertEqual(events[0]["severity"], "warning")

	def test_empty_payload_yields_no_events(self):
		self.assertEqual(_normalise_violation_events(None), [])
		self.assertEqual(_normalise_violation_events(""), [])
		self.assertEqual(_normalise(), [])

	def test_event_list_is_capped(self):
		flood = [
			{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-01-01T00:00:00Z"}
		] * (MAX_VIOLATION_EVENTS + 50)
		self.assertEqual(len(_normalise(*flood)), MAX_VIOLATION_EVENTS)

	def test_payload_that_is_not_a_list_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			_normalise_violation_events(json.dumps({"eventType": "tab_switch"}))

	def test_empty_event_list_never_calls_bulk_insert(self):
		with patch("frappe.db.bulk_insert") as mock_insert:
			_save_violation_events("dummy-sub", [])
		mock_insert.assert_not_called()

	def test_all_five_valid_event_types_are_accepted(self):
		valid_types = ["tab_switch", "no_face", "multiple_faces", "focus_loss", "camera_disconnect"]
		events = _normalise(
			*[
				{"eventType": t, "severity": "violation", "timestamp": "2026-01-01T00:00:00Z"}
				for t in valid_types
			]
		)
		self.assertCountEqual([e["event_type"] for e in events], valid_types)

	def test_mixed_valid_and_invalid_types_keeps_only_valid(self):
		events = _normalise(
			{"eventType": "tab_switch", "timestamp": "2026-01-01T00:00:00Z"},
			{"eventType": "screen_capture", "timestamp": "2026-01-01T00:01:00Z"},  # invalid
			{"eventType": "multiple_faces", "timestamp": "2026-01-01T00:02:00Z"},
		)
		self.assertEqual(len(events), 2)


# ---------------------------------------------------------------------------
# 2. Integration — events actually written to the database
# ---------------------------------------------------------------------------


class TestSaveViolationEventsDB(unittest.TestCase):
	"""_save_violation_events with a real DB submission."""

	@classmethod
	def setUpClass(cls):
		cls.question = _make_question()
		cls.quiz = _make_quiz(cls.question)
		cls.submission = _make_submission(cls.quiz.name)

	@classmethod
	def tearDownClass(cls):
		frappe.db.delete("LMS Quiz Violation Log", {"quiz_submission": cls.submission.name})
		frappe.db.delete("LMS Quiz Submission", cls.submission.name)
		frappe.db.delete("LMS Quiz", cls.quiz.name)
		frappe.db.delete("LMS Question", cls.question.name)

	def setUp(self):
		frappe.db.delete("LMS Quiz Violation Log", {"quiz_submission": self.submission.name})

	def test_valid_events_land_in_db(self):
		_save_violation_events(
			self.submission.name,
			_normalise(
				{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-01T10:00:00Z"},
				{"eventType": "no_face", "severity": "warning", "timestamp": "2026-07-01T10:01:00Z"},
			),
		)
		logs = _get_logs(self.submission.name)
		self.assertEqual(len(logs), 2)
		self.assertEqual(logs[0].event_type, "tab_switch")
		self.assertEqual(logs[0].severity, "violation")
		self.assertEqual(logs[1].event_type, "no_face")
		self.assertEqual(logs[1].severity, "warning")

	def test_timestamp_stored_in_site_timezone(self):
		_save_violation_events(
			self.submission.name,
			_normalise(
				{
					"eventType": "focus_loss",
					"severity": "violation",
					"timestamp": "2026-07-15T14:30:45.123Z",
				}
			),
		)
		logs = _get_logs(self.submission.name)
		self.assertEqual(get_datetime(logs[0].timestamp), _local("2026-07-15T14:30:45.123Z"))

	def test_unknown_events_not_stored(self):
		_save_violation_events(
			self.submission.name,
			_normalise(
				{"eventType": "totally_fake", "severity": "violation"},
				{
					"eventType": "camera_disconnect",
					"severity": "violation",
					"timestamp": "2026-07-01T10:00:00Z",
				},
			),
		)
		logs = _get_logs(self.submission.name)
		self.assertEqual(len(logs), 1)
		self.assertEqual(logs[0].event_type, "camera_disconnect")

	def test_multiple_calls_append_not_replace(self):
		_save_violation_events(
			self.submission.name,
			_normalise(
				{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-01T10:00:00Z"}
			),
		)
		_save_violation_events(
			self.submission.name,
			_normalise(
				{"eventType": "no_face", "severity": "violation", "timestamp": "2026-07-01T10:01:00Z"}
			),
		)
		logs = _get_logs(self.submission.name)
		self.assertEqual(len(logs), 2)

	def test_insert_failure_is_swallowed(self):
		# The graded submission is already saved by the time this runs, so a broken
		# audit-log write must not surface as a failed submission.
		with (
			patch("frappe.db.bulk_insert", side_effect=Exception("boom")),
			patch("frappe.log_error") as mock_log,
		):
			_save_violation_events(
				self.submission.name,
				_normalise(
					{
						"eventType": "tab_switch",
						"severity": "violation",
						"timestamp": "2026-07-01T10:00:00Z",
					}
				),
			)
		mock_log.assert_called_once()


# ---------------------------------------------------------------------------
# 3. End-to-end: submit_quiz persists violation_count and violation_events
# ---------------------------------------------------------------------------


class TestSubmitQuizWithViolations(unittest.TestCase):
	"""submit_quiz — violation_count, submission_reason, and violation_events are
	all persisted correctly through the full submission path."""

	@classmethod
	def setUpClass(cls):
		cls.question = _make_question()
		cls.quiz = _make_quiz(cls.question)
		cls.original_user = frappe.session.user
		frappe.session.user = "Administrator"

	@classmethod
	def tearDownClass(cls):
		frappe.session.user = cls.original_user
		# Resolved before the submissions go, because that is what identifies the rows.
		# These classes run outside a transaction, so an unfiltered delete here does not
		# roll back: it truncates the table on whatever site the suite is pointed at.
		submissions = frappe.get_all("LMS Quiz Submission", filters={"quiz": cls.quiz.name}, pluck="name")
		if submissions:
			frappe.db.delete("LMS Quiz Violation Log", {"quiz_submission": ("in", submissions)})
		frappe.db.delete("LMS Quiz Submission", {"quiz": cls.quiz.name})
		frappe.db.delete("LMS Quiz", cls.quiz.name)
		frappe.db.delete("LMS Question", cls.question.name)

	def _results(self):
		return json.dumps([{"question_name": self.question.name, "answer": ["Correct"]}])

	def _stored(self, submission, field):
		return frappe.db.get_value("LMS Quiz Submission", submission, field)

	def _violations(self, count):
		return json.dumps(
			[
				{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-01T10:00:00Z"}
				for _ in range(count)
			]
		)

	def test_violation_count_saved_on_submission(self):
		# No event list to derive from (the pagehide beacon), so the reported count stands.
		result = submit_quiz(self.quiz.name, results=self._results(), violation_count=2)
		self.assertEqual(self._stored(result["submission"], "violation_count"), 2)

	def test_reported_count_is_ignored_when_events_are_supplied(self):
		# A learner who logs two violations but reports none is recorded as two.
		result = submit_quiz(
			self.quiz.name,
			results=self._results(),
			violation_count=0,
			violation_events=self._violations(2),
		)
		self.assertEqual(self._stored(result["submission"], "violation_count"), 2)

	def test_inflated_count_is_cut_back_to_the_events(self):
		result = submit_quiz(
			self.quiz.name,
			results=self._results(),
			violation_count=99,
			violation_events=self._violations(1),
		)
		self.assertEqual(self._stored(result["submission"], "violation_count"), 1)

	def test_warnings_do_not_count_as_violations(self):
		events = json.dumps(
			[
				{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-01T10:00:00Z"},
				{"eventType": "no_face", "severity": "warning", "timestamp": "2026-07-01T10:01:00Z"},
			]
		)
		result = submit_quiz(
			self.quiz.name, results=self._results(), violation_count=2, violation_events=events
		)
		self.assertEqual(self._stored(result["submission"], "violation_count"), 1)
		self.assertEqual(len(_get_logs(result["submission"])), 2)

	def test_submission_reason_saved(self):
		# max_violations is 3 on the fixture quiz, so three logged violations back the claim.
		result = submit_quiz(
			self.quiz.name,
			results=self._results(),
			submission_reason="max_violations",
			violation_events=self._violations(3),
		)
		self.assertEqual(self._stored(result["submission"], "submission_reason"), "max_violations")

	def test_unsupported_max_violations_claim_is_downgraded(self):
		result = submit_quiz(
			self.quiz.name,
			results=self._results(),
			submission_reason="max_violations",
			violation_events=self._violations(1),
		)
		self.assertEqual(self._stored(result["submission"], "submission_reason"), "manual")

	def test_reason_is_forced_to_max_violations_when_the_events_say_so(self):
		# Hiding an auto-submit behind "manual" does not work: the log outvotes the claim.
		result = submit_quiz(
			self.quiz.name,
			results=self._results(),
			submission_reason="manual",
			violation_events=self._violations(3),
		)
		self.assertEqual(self._stored(result["submission"], "submission_reason"), "max_violations")

	def test_unknown_submission_reason_falls_back_to_manual(self):
		result = submit_quiz(
			self.quiz.name, results=self._results(), submission_reason="<script>alert(1)</script>"
		)
		self.assertEqual(self._stored(result["submission"], "submission_reason"), "manual")

	def test_events_are_ignored_when_proctoring_is_off(self):
		question = _make_question()
		quiz = _make_quiz(question)
		quiz.enable_proctoring = 0
		quiz.save(ignore_permissions=True)
		try:
			result = submit_quiz(
				quiz.name,
				results=json.dumps([{"question_name": question.name, "answer": ["Correct"]}]),
				violation_count=5,
				submission_reason="max_violations",
				violation_events=self._violations(5),
			)
			self.assertEqual(self._stored(result["submission"], "violation_count"), 0)
			self.assertEqual(self._stored(result["submission"], "submission_reason"), "manual")
			self.assertEqual(_get_logs(result["submission"]), [])
		finally:
			frappe.db.delete("LMS Quiz Submission", {"quiz": quiz.name})
			frappe.db.delete("LMS Quiz", quiz.name)
			frappe.db.delete("LMS Question", question.name)

	def test_submission_survives_a_failing_violation_log_write(self):
		# The frontend no longer retries on error, so a broken log write must not be
		# allowed to fail the submission it belongs to.
		with patch("frappe.db.bulk_insert", side_effect=Exception("boom")), patch("frappe.log_error"):
			result = submit_quiz(
				self.quiz.name,
				results=self._results(),
				violation_count=1,
				violation_events=self._violations(1),
			)
		self.assertIn("submission", result)
		self.assertEqual(self._stored(result["submission"], "violation_count"), 1)

	def test_violation_events_persisted_when_provided(self):
		events = json.dumps(
			[
				{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-01T10:00:00Z"},
				{"eventType": "no_face", "severity": "warning", "timestamp": "2026-07-01T10:01:00Z"},
			]
		)
		result = submit_quiz(
			self.quiz.name,
			results=self._results(),
			violation_count=1,
			violation_events=events,
		)
		logs = _get_logs(result["submission"])
		self.assertEqual(len(logs), 2)
		saved_types = {log.event_type for log in logs}
		self.assertIn("tab_switch", saved_types)
		self.assertIn("no_face", saved_types)

	def test_invalid_violation_events_json_raises_validation_error(self):
		# _parse_json_arg rejects malformed JSON with a clean ValidationError rather
		# than a raw 500. Only a genuinely malformed payload gets this far — a payload
		# that parses is filtered down to what is storable instead of being rejected.
		with self.assertRaises(frappe.ValidationError):
			submit_quiz(
				self.quiz.name,
				results=self._results(),
				violation_events="not-valid-json",
			)

	def test_submit_without_violation_events_succeeds(self):
		result = submit_quiz(self.quiz.name, results=self._results())
		self.assertIn("submission", result)
		self.assertIn("score", result)

	def test_zero_violation_count_is_stored(self):
		result = submit_quiz(self.quiz.name, results=self._results(), violation_count=0)
		count = frappe.db.get_value("LMS Quiz Submission", result["submission"], "violation_count")
		self.assertEqual(count, 0)

	def test_invalid_event_types_in_payload_are_dropped_not_stored(self):
		events = json.dumps(
			[
				{"eventType": "illegal_action", "severity": "violation"},
				{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-01T10:00:00Z"},
			]
		)
		result = submit_quiz(
			self.quiz.name, results=self._results(), violation_count=1, violation_events=events
		)
		logs = _get_logs(result["submission"])
		self.assertEqual(len(logs), 1)
		self.assertEqual(logs[0].event_type, "tab_switch")


# ---------------------------------------------------------------------------
# 4. get_quiz_violation_logs — permission gates and data accuracy
# ---------------------------------------------------------------------------


class TestGetQuizViolationLogs(unittest.TestCase):
	"""get_quiz_violation_logs enforces that only the submission owner (or a
	privileged user) can read violation logs."""

	@classmethod
	def setUpClass(cls):
		hash_ = frappe.generate_hash(length=6)

		cls.student = frappe.get_doc(
			{
				"doctype": "User",
				"email": f"proc-student-{hash_}@test.com",
				"first_name": "Proctor",
				"last_name": "Student",
				"send_welcome_email": 0,
				"roles": [{"role": "LMS Student"}],
			}
		).insert(ignore_permissions=True)

		cls.outsider = frappe.get_doc(
			{
				"doctype": "User",
				"email": f"proc-outsider-{hash_}@test.com",
				"first_name": "Proctor",
				"last_name": "Outsider",
				"send_welcome_email": 0,
				"roles": [{"role": "LMS Student"}],
			}
		).insert(ignore_permissions=True)

		cls.question = _make_question()
		cls.quiz = _make_quiz(cls.question)
		cls.submission = _make_submission(cls.quiz.name, member=cls.student.name)

		_save_violation_events(
			cls.submission.name,
			_normalise(
				{"eventType": "tab_switch", "severity": "violation", "timestamp": "2026-07-01T09:00:00Z"},
				{"eventType": "no_face", "severity": "warning", "timestamp": "2026-07-01T09:01:00Z"},
			),
		)

	@classmethod
	def tearDownClass(cls):
		frappe.db.delete("LMS Quiz Violation Log", {"quiz_submission": cls.submission.name})
		frappe.db.delete("LMS Quiz Submission", cls.submission.name)
		frappe.db.delete("LMS Quiz", cls.quiz.name)
		frappe.db.delete("LMS Question", cls.question.name)
		frappe.delete_doc("User", cls.student.name, force=True, ignore_permissions=True)
		frappe.delete_doc("User", cls.outsider.name, force=True, ignore_permissions=True)

	def _call(self, user):
		original = frappe.session.user
		frappe.session.user = user
		try:
			return get_quiz_violation_logs(self.submission.name)
		finally:
			frappe.session.user = original

	def test_submission_owner_can_read_logs(self):
		logs = self._call(self.student.name)
		self.assertEqual(len(logs), 2)

	def test_system_manager_can_read_logs(self):
		logs = self._call("Administrator")
		self.assertEqual(len(logs), 2)

	def test_unrelated_student_is_rejected(self):
		with self.assertRaises(frappe.PermissionError):
			self._call(self.outsider.name)

	def test_nonexistent_submission_raises_validation_error(self):
		original = frappe.session.user
		frappe.session.user = "Administrator"
		try:
			with self.assertRaises(frappe.ValidationError):
				get_quiz_violation_logs("nonexistent-submission-xyz")
		finally:
			frappe.session.user = original

	def test_logs_returned_in_ascending_timestamp_order(self):
		logs = self._call("Administrator")
		self.assertEqual(logs[0].event_type, "tab_switch")
		self.assertEqual(logs[1].event_type, "no_face")

	def test_returned_fields_include_event_type_severity_timestamp(self):
		logs = self._call("Administrator")
		first = logs[0]
		self.assertIn("event_type", first)
		self.assertIn("severity", first)
		self.assertIn("timestamp", first)

	def test_severities_are_stored_correctly(self):
		logs = self._call("Administrator")
		severity_map = {log.event_type: log.severity for log in logs}
		self.assertEqual(severity_map["tab_switch"], "violation")
		self.assertEqual(severity_map["no_face"], "warning")


# ---------------------------------------------------------------------------
# 5. is_open_ended_submission
# ---------------------------------------------------------------------------


class TestIsOpenEndedSubmission(unittest.TestCase):
	"""is_open_ended_submission returns True/False based on the linked quiz's
	question type, enabling the frontend to decide whether marks are editable."""

	@classmethod
	def setUpClass(cls):
		cls.question = _make_question()  # Choices type
		cls.quiz = _make_quiz(cls.question)
		cls.submission = _make_submission(cls.quiz.name)

	@classmethod
	def tearDownClass(cls):
		frappe.db.delete("LMS Quiz Submission", cls.submission.name)
		frappe.db.delete("LMS Quiz", cls.quiz.name)
		frappe.db.delete("LMS Question", cls.question.name)

	def test_choice_quiz_returns_false(self):
		self.assertFalse(is_open_ended_submission(self.submission.name))

	def test_nonexistent_submission_returns_false(self):
		self.assertFalse(is_open_ended_submission("does-not-exist-xyz"))

	def test_returns_bool_not_truthy(self):
		result = is_open_ended_submission(self.submission.name)
		self.assertIsInstance(result, bool)
