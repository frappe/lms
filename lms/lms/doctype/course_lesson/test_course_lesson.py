# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest


class TestApplyEnforcementFlags(unittest.TestCase):
	def _call(self, *, quiz_done, assignment_done, enforce_quiz, enforce_assignment):
		from lms.lms.doctype.course_lesson.course_lesson import (
			apply_enforcement_flags,
		)

		settings = {
			"enforce_quiz_completion": enforce_quiz,
			"enforce_assignment_completion": enforce_assignment,
		}
		return apply_enforcement_flags(
			quiz_done=quiz_done,
			assignment_done=assignment_done,
			settings=settings,
		)

	def test_both_enforced_passes_through(self):
		self.assertEqual(
			self._call(quiz_done=True, assignment_done=True, enforce_quiz=1, enforce_assignment=1),
			(True, True),
		)
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=True, enforce_quiz=1, enforce_assignment=1),
			(False, True),
		)
		self.assertEqual(
			self._call(quiz_done=True, assignment_done=False, enforce_quiz=1, enforce_assignment=1),
			(True, False),
		)

	def test_quiz_off_returns_true_for_quiz(self):
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=False, enforce_quiz=0, enforce_assignment=1),
			(True, False),
		)

	def test_assignment_off_returns_true_for_assignment(self):
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=False, enforce_quiz=1, enforce_assignment=0),
			(False, True),
		)

	def test_both_off_returns_true_true(self):
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=False, enforce_quiz=0, enforce_assignment=0),
			(True, True),
		)

	def test_missing_settings_keys_treated_as_enforced(self):
		from lms.lms.doctype.course_lesson.course_lesson import (
			apply_enforcement_flags,
		)

		self.assertEqual(
			apply_enforcement_flags(quiz_done=False, assignment_done=True, settings={}),
			(False, True),
		)


class TestApplyEnforcementFlagsEdgeCases(unittest.TestCase):
	def setUp(self):
		from lms.lms.doctype.course_lesson.course_lesson import (
			apply_enforcement_flags,
		)

		self.fn = apply_enforcement_flags

	def test_dict_subclass_input(self):
		"""A frappe._dict-like subclass of dict should work via duck-typing."""

		class _Dict(dict):
			pass

		settings = _Dict({"enforce_quiz_completion": 0, "enforce_assignment_completion": 1})
		self.assertEqual(self.fn(quiz_done=False, assignment_done=False, settings=settings), (True, False))

	def test_string_zero_is_truthy_treated_as_enforced(self):
		"""Frappe may return '0' as a string from raw queries. `not '0'` is False, so it's still enforced.

		Codifies current behavior — callers that hit this should pass int(value) explicitly.
		"""
		settings = {"enforce_quiz_completion": "0", "enforce_assignment_completion": "0"}
		# Both still treated as enforced because non-empty strings are truthy.
		self.assertEqual(self.fn(quiz_done=False, assignment_done=False, settings=settings), (False, False))

	def test_string_one_treated_as_enforced(self):
		settings = {"enforce_quiz_completion": "1", "enforce_assignment_completion": "1"}
		self.assertEqual(self.fn(quiz_done=True, assignment_done=True, settings=settings), (True, True))
		self.assertEqual(self.fn(quiz_done=False, assignment_done=True, settings=settings), (False, True))

	def test_none_for_flag_disables_enforcement(self):
		"""Present-but-None: helper sees `not None == True`, treats as NOT enforced.

		Distinct from missing key (which defaults to 1 / enforced via dict.get's default).
		"""
		settings = {"enforce_quiz_completion": None, "enforce_assignment_completion": 1}
		self.assertEqual(self.fn(quiz_done=False, assignment_done=False, settings=settings), (True, False))

	def test_both_int_zero_disabled(self):
		settings = {"enforce_quiz_completion": 0, "enforce_assignment_completion": 0}
		for quiz_done in (True, False):
			for assignment_done in (True, False):
				with self.subTest(quiz_done=quiz_done, assignment_done=assignment_done):
					self.assertEqual(
						self.fn(quiz_done=quiz_done, assignment_done=assignment_done, settings=settings),
						(True, True),
					)

	def test_idempotent(self):
		settings = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 1}
		first = self.fn(quiz_done=True, assignment_done=False, settings=settings)
		second = self.fn(quiz_done=True, assignment_done=False, settings=settings)
		self.assertEqual(first, second)

	def test_does_not_mutate_settings(self):
		settings = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 0}
		snapshot = dict(settings)
		self.fn(quiz_done=True, assignment_done=False, settings=settings)
		self.assertEqual(settings, snapshot)

	def test_keyword_argument_contract(self):
		"""save_progress invokes with keyword args; the helper must accept them in any order."""
		settings = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 1}
		self.assertEqual(
			self.fn(settings=settings, quiz_done=True, assignment_done=False),
			(True, False),
		)
		self.assertEqual(
			self.fn(assignment_done=False, quiz_done=True, settings=settings),
			(True, False),
		)


class TestServePrivateFileVersionSafe(unittest.TestCase):
	"""serve_resource must not pass `filename=` to a Frappe whose send_private_file
	predates that kwarg (LMS supports frappe>=14). Regression for the student-view 500:
	TypeError: send_private_file() got an unexpected keyword argument 'filename'."""

	def _run(self, stub):
		from lms.lms.doctype.course_lesson import course_lesson

		original = course_lesson.send_private_file
		course_lesson.send_private_file = stub
		try:
			return course_lesson._serve_private_file("/files/x.pdf", "nice.pdf")
		finally:
			course_lesson.send_private_file = original

	def test_old_frappe_without_filename_kwarg(self):
		calls = []

		def old_stub(path):  # pre-filename Frappe: only accepts the path
			calls.append((path,))
			return "sent"

		self.assertEqual(self._run(old_stub), "sent")
		self.assertEqual(calls, [("/files/x.pdf",)])

	def test_new_frappe_passes_filename(self):
		calls = []

		def new_stub(path, filename=None):
			calls.append((path, filename))
			return "sent"

		self.assertEqual(self._run(new_stub), "sent")
		self.assertEqual(calls, [("/files/x.pdf", "nice.pdf")])
