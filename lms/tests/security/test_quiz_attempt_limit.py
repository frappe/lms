import threading
from unittest.mock import patch

import frappe

from lms.lms.doctype.lms_quiz.lms_quiz import create_submission
from lms.lms.doctype.lms_quiz_submission.lms_quiz_submission import (
	LMSQuizSubmission,
	MaximumAttemptsExceededError,
)
from lms.lms.test_helpers import BaseTestUtils
from lms.tests.test_coupon_redemption import THREAD_TIMEOUT, _delete_committed, _delete_committed_user

# How long a worker that has counted waits for the others to count too. The lock keeps
# them out, so with it in place this wait always runs out.
COUNTED_TIMEOUT = 3


class _QuizAttemptFixtures:
	"""Mixed into a savepoint-isolated class and a commit-based one."""

	def _submit(self):
		submission = frappe.get_doc(
			{
				"doctype": "LMS Quiz Submission",
				"quiz": self.quiz,
				"member": self.member,
				"percentage": 0,
				"passing_percentage": 70,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - create_submission saves the same way; the limit is under test
		return submission.insert(ignore_permissions=True)


class TestQuizAttemptLimit(_QuizAttemptFixtures, BaseTestUtils):
	"""max_attempts is a count of the member's submissions. Under REPEATABLE READ a plain
	count is read from the request's snapshot, so parallel submits all see the same
	number. The member's User row serialises them and the count is a locking read."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.member = cls._create_user(f"qal-{hash}@example.com", "Qal", "Student", ["LMS Student"]).name
		cls.quiz = cls._create_quiz([], title=f"Attempt Limit Quiz {hash}").name

	def _set_max_attempts(self, value):
		frappe.db.set_value("LMS Quiz", self.quiz, "max_attempts", value)

	def test_an_attempt_past_the_limit_is_refused(self):
		self._set_max_attempts(1)
		self._submit()
		with self.assertRaises(MaximumAttemptsExceededError):
			self._submit()

	def test_no_limit_allows_any_number_of_attempts(self):
		self._set_max_attempts(0)
		self._submit()
		self._submit()
		self.assertEqual(
			frappe.db.count("LMS Quiz Submission", {"quiz": self.quiz, "member": self.member}), 2
		)


class TestQuizAttemptLimitConcurrency(_QuizAttemptFixtures, BaseTestUtils):
	"""Parallel submits on their own connections, which commit. Skips BaseTestUtils'
	savepoint, as TestCouponRedemptionConcurrency does, and cleans up explicitly."""

	def setUp(self):
		# Skip BaseTestUtils.setUp: these tests commit.
		super(BaseTestUtils, self).setUp()
		hash = frappe.generate_hash(length=6)
		self.member = self._create_user(f"qalc-{hash}@example.com", "Qalc", "Student", ["LMS Student"]).name
		self.other = self._create_user(f"qalc-{hash}-2@example.com", "Qalc", "Other", ["LMS Student"]).name
		self.quiz = self._create_quiz([], title=f"Attempt Limit Race Quiz {hash}").name
		frappe.db.set_value("LMS Quiz", self.quiz, "max_attempts", 1)

	def tearDown(self):
		# Skip BaseTestUtils.tearDown: _in_parallel already cleaned up.
		super(BaseTestUtils, self).tearDown()

	def test_parallel_submits_at_the_limit_admit_one(self):
		"""Without the User lock both workers insert and then each counts the other's
		uncommitted row."""
		outcomes = self._in_parallel([self.member, self.member])

		self.assertEqual(sorted(outcomes), ["exceeded", "submitted"])

	def test_different_learners_submitting_together_both_get_in(self):
		"""Their counts lock the same empty stretch of the member index. Each counts after
		inserting, so one insert waits for the other's commit instead of deadlocking."""
		outcomes = self._in_parallel([self.member, self.other])

		self.assertEqual(outcomes, ["submitted", "submitted"])

	def _in_parallel(self, members) -> list:
		"""Submit once per member, each on its own connection. A worker that has counted
		waits for the rest to count before it commits."""
		workers = len(members)
		site = frappe.local.site
		# The workers run on their own connections, so the fixtures have to be
		# visible outside this test's transaction.
		frappe.db.commit()  # nosemgrep
		started = threading.Barrier(workers)
		counted = threading.Barrier(workers)
		validate = LMSQuizSubmission.validate_if_max_attempts_exceeded
		outcomes = []

		def count_then_wait(doc):
			validate(doc)
			try:
				counted.wait(timeout=COUNTED_TIMEOUT)
			except threading.BrokenBarrierError:
				pass  # the others are queued on a lock this worker holds

		def run(member):
			try:
				frappe.init(site=site)
				frappe.connect()
				try:
					frappe.set_user(member)
					started.wait(timeout=THREAD_TIMEOUT)
					create_submission(self.quiz, [], 0, 70)
					frappe.db.commit()  # nosemgrep
					outcomes.append("submitted")
				finally:
					frappe.destroy()
			except MaximumAttemptsExceededError:
				outcomes.append("exceeded")
			except Exception as e:  # surfaced in the assertion
				outcomes.append(repr(e))
				started.abort()

		threads = [threading.Thread(target=run, args=(member,)) for member in members]
		try:
			with patch.object(LMSQuizSubmission, "validate_if_max_attempts_exceeded", count_then_wait):
				for thread in threads:
					thread.start()
				for thread in threads:
					thread.join(timeout=THREAD_TIMEOUT)
					self.assertFalse(thread.is_alive(), "a worker did not finish")
			return outcomes
		finally:
			self._commit_cleanup()

	def _commit_cleanup(self):
		"""The fixtures and submissions were committed, so rolling back the test cannot
		remove them."""
		for name in frappe.get_all("LMS Quiz Submission", {"quiz": self.quiz}, pluck="name"):
			_delete_committed("LMS Quiz Submission", name)
		_delete_committed("LMS Quiz", self.quiz)
		_delete_committed_user(self.member)
		_delete_committed_user(self.other)
		frappe.db.commit()  # nosemgrep
