from contextlib import contextmanager
from unittest.mock import patch

import frappe

from lms.lms.doctype.lms_batch_enrollment.lms_batch_enrollment import LMSBatchEnrollment
from lms.lms.doctype.lms_enrollment.lms_enrollment import LMSEnrollment
from lms.lms.enrollment_constraints import (
	REDUNDANT_BATCH_INDEX,
	ensure_enrollment_unique_constraints,
)
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import enroll_in_course


class TestEnrollmentRaces(BaseTestUtils):
	"""Both controllers check for a duplicate with exists() and then insert().

	Two concurrent requests both read "absent" and both insert, so the check
	cannot settle it on its own. A FOR UPDATE lock on the parent row makes the
	second request wait until the first has committed, which is what protects
	every site — there is no migration, so an already-installed site gets no
	unique index. The index that after_install adds on a fresh install is the
	backstop for what bypasses the controller entirely.

	Neutralising the check is how the index is exercised in one process: it is
	exactly the state both requests are in after their read.
	"""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"race-instr-{hash}@example.com", "Race", "Instr", ["Course Creator", "Moderator"]
		)
		self._create_evaluator(self.instructor.email)
		self.course = self._create_course(title=f"Race Course {hash}", instructor=self.instructor.email)
		self.batch = self._create_batch(
			course=self.course.name,
			instructor=self.instructor.email,
			title=f"Race Batch {hash}",
			evaluator=self.instructor.email,
		)
		self.member = self._create_user(f"race-member-{hash}@example.com", "Race", "Tester", ["LMS Student"])

	def test_the_unique_indexes_exist(self):
		"""after_install is the only thing that adds these, so this passes on a
		fresh site (including CI) and says nothing about an upgraded one — the
		lock tests below are what cover those."""
		self.assertTrue(frappe.db.has_index("tabLMS Batch Enrollment", "unique_batch_member"))
		self.assertTrue(frappe.db.has_index("tabLMS Enrollment", "unique_course_member"))

	def test_constraining_is_idempotent_and_cannot_skip(self):
		"""after_install runs on sites that may already have these indexes, so the
		helper has to be a no-op then. It also no longer has a path that returns
		having added nothing: the dedupe and its log-and-return are deleted, so
		either add_unique creates the index or it raises. (The raising half is not
		asserted here — proving it needs a live unique index dropped and duplicate
		rows inserted, which would leave this shared site unconstrained if the test
		died midway. add_unique is frappe's, and the skip branch is gone.)"""
		ensure_enrollment_unique_constraints()
		self.assertTrue(frappe.db.has_index("tabLMS Batch Enrollment", "unique_batch_member"))
		self.assertTrue(frappe.db.has_index("tabLMS Enrollment", "unique_course_member"))

	def test_the_superseded_plain_index_is_dropped(self):
		"""unique_batch_member covers the same two columns in the same order as
		the index add_batch_enrollment_index added for the Raven lookup."""
		self.assertFalse(frappe.db.has_index("tabLMS Batch Enrollment", REDUNDANT_BATCH_INDEX))

	def test_duplicate_batch_enrollment_is_refused_by_the_database(self):
		with patch.object(LMSBatchEnrollment, "validate_duplicate_members"):
			self._insert_batch_enrollment()
			with self.assertRaises(frappe.UniqueValidationError):
				self._insert_batch_enrollment()

	def test_duplicate_course_enrollment_is_refused_by_the_database(self):
		with patch.object(LMSEnrollment, "validate_duplicate_enrollment"):
			self._insert_enrollment()
			with self.assertRaises(frappe.UniqueValidationError):
				self._insert_enrollment()

	def test_the_controller_check_still_reports_the_friendly_error(self):
		"""The constraint is a backstop, not a replacement: a sequential duplicate
		must still get the readable message rather than a database error."""
		self._insert_batch_enrollment()
		with self.assertRaises(frappe.ValidationError) as caught:
			self._insert_batch_enrollment()
		self.assertNotIsInstance(caught.exception, frappe.UniqueValidationError)

	def test_batch_enrollment_locks_the_batch_before_reading(self):
		"""A lock taken after the read is no lock at all, so the order is the
		assertion. Same shape as the payment and coupon locks in lms/lms/utils.py."""
		log = []
		with self._logging_db(log):
			self._insert_batch_enrollment()
		self._assert_locked_before_read(log, "LMS Batch", "LMS Batch Enrollment")

	def test_course_enrollment_locks_the_course_before_reading(self):
		log = []
		with self._logging_db(log):
			self._insert_enrollment()
		self._assert_locked_before_read(log, "LMS Course", "LMS Enrollment")

	def test_the_paid_course_callback_locks_before_its_own_check(self):
		"""enroll_in_course pre-checks with exists() so a repeated payment callback
		is a no-op. Unlocked, two callbacks arriving together both read "absent" and
		the loser hits the controller's duplicate error — failing a request that has
		already taken the money.

		The payment lookup is stubbed to an empty name: the record it points at is
		not the subject, and an empty Link saves cleanly."""
		log = []
		stubs = {"LMS Payment": frappe._dict(name=None, source=None)}
		with self._logging_db(log, stubs=stubs):
			enroll_in_course(self.course.name, "LMS-PAY-RACE-TEST")

		created = frappe.db.get_value(
			"LMS Enrollment", {"course": self.course.name, "member": frappe.session.user}
		)
		self.assertIsNotNone(created)
		self.cleanup_items.append(("LMS Enrollment", created))
		self._assert_locked_before_read(log, "LMS Course", "LMS Enrollment")

	def test_batch_enrollment_locks_each_course_before_auto_enrolling(self):
		"""A batch enrolment enrols its member in the batch's courses, with the same
		check-then-insert shape one level down. Two batches sharing a course would
		otherwise both read "absent" for one member and the loser would throw."""
		log = []
		with self._logging_db(log):
			self._insert_batch_enrollment()
		self._assert_locked_before_read(log, "LMS Course", "LMS Enrollment")

	@contextmanager
	def _logging_db(self, log, stubs=None):
		"""Wraps the real calls rather than replacing them, so the insert still runs
		and the log records the order it went in."""
		real_get_value, real_exists = frappe.db.get_value, frappe.db.exists

		def spy_get_value(*args, **kwargs):
			if kwargs.get("for_update") and args:
				log.append(("lock", args[0]))
			# stubs stand in for lookups that are not under test, so a path can be
			# exercised without building its unrelated fixtures.
			if stubs and args and args[0] in stubs:
				return stubs[args[0]]
			return real_get_value(*args, **kwargs)

		def spy_exists(*args, **kwargs):
			if args:
				log.append(("read", args[0]))
			return real_exists(*args, **kwargs)

		with (
			patch.object(frappe.db, "get_value", spy_get_value),
			patch.object(frappe.db, "exists", spy_exists),
		):
			yield

	def _assert_locked_before_read(self, log, parent_doctype, child_doctype):
		self.assertIn(("lock", parent_doctype), log, f"no FOR UPDATE on {parent_doctype}: {log}")
		self.assertIn(("read", child_doctype), log)
		self.assertLess(
			log.index(("lock", parent_doctype)),
			log.index(("read", child_doctype)),
			f"read {child_doctype} before locking {parent_doctype}: {log}",
		)

	def _insert_batch_enrollment(self):
		doc = frappe.get_doc(
			{
				"doctype": "LMS Batch Enrollment",
				"batch": self.batch.name,
				"member": self.member.name,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - the race, not the role check, is under test
		doc.insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Batch Enrollment", doc.name))
		return doc

	def _insert_enrollment(self):
		doc = frappe.get_doc(
			{
				"doctype": "LMS Enrollment",
				"course": self.course.name,
				"member": self.member.name,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - the race, not the role check, is under test
		doc.insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Enrollment", doc.name))
		return doc
