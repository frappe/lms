from contextlib import contextmanager
from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.share_enrollment import execute


class TestShareEnrollmentPatch(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"share-enrollment-patch-instructor@example.com",
			"Instructor",
			"Test",
			["Course Creator", "Moderator"],
		)
		cls.course = cls._create_course(
			title="Share Enrollment Patch Course", instructor=cls.instructor.email
		)

	def setUp(self):
		super().setUp()
		# The patch commits; keep that inside the test's rollback.
		commit = patch.object(frappe.db, "commit")
		self.commit = commit.start()
		self.addCleanup(commit.stop)

	def _enroll_new_student(self, index=0):
		# before_insert now makes the member the owner, so only legacy rows still carry
		# the admin who enrolled them. Recreate one of those.
		student = self._create_user(
			f"share-enrollment-patch-student-{index}@example.com", "Student", "Test", ["LMS Student"]
		)
		enrollment = self._create_enrollment(student.email, self.course.name)
		frappe.db.set_value("LMS Enrollment", enrollment.name, "owner", self.instructor.email)
		return enrollment

	def _shares(self, enrollment):
		return frappe.get_all(
			"DocShare",
			filters={"share_doctype": "LMS Enrollment", "share_name": enrollment.name},
			fields=["user", "read", "write", "notify_by_email"],
		)

	def test_shares_enrollment_created_by_someone_else(self):
		enrollment = self._enroll_new_student()

		execute()

		self.assertEqual(
			self._shares(enrollment),
			[{"user": enrollment.member, "read": 1, "write": 1, "notify_by_email": 0}],
		)

	def test_skips_self_enrollment(self):
		enrollment = self._enroll_new_student()
		frappe.db.set_value("LMS Enrollment", enrollment.name, "owner", enrollment.member)

		execute()

		self.assertEqual(self._shares(enrollment), [])

	def test_shares_enrollment_without_owner(self):
		enrollment = self._enroll_new_student()
		frappe.db.set_value("LMS Enrollment", enrollment.name, "owner", None)
		self.assertIsNone(frappe.db.get_value("LMS Enrollment", enrollment.name, "owner"))

		execute()

		self.assertEqual(len(self._shares(enrollment)), 1)

	def test_does_not_duplicate_existing_share(self):
		enrollment = self._enroll_new_student()
		frappe.share.add_docshare("LMS Enrollment", enrollment.name, enrollment.member, read=1)

		execute()

		self.assertEqual(len(self._shares(enrollment)), 1)

	def test_skips_member_without_user(self):
		enrollment = self._enroll_new_student()
		frappe.db.set_value("LMS Enrollment", enrollment.name, "member", "missing-user@example.com")

		execute()

		self.assertEqual(self._shares(enrollment), [])

	def test_stays_under_write_limit(self):
		enrollments = [self._enroll_new_student(index) for index in range(10)]
		frappe.db.transaction_writes = 0

		# patch_handler turns auto-commit off for patches, so the limit raises instead.
		with (
			patch.object(frappe.db, "auto_commit_on_many_writes", 0),
			patch.object(frappe.db, "MAX_WRITES_PER_TRANSACTION", 5),
		):
			execute()

		for enrollment in enrollments:
			self.assertEqual(len(self._shares(enrollment)), 1)

	def test_reads_and_inserts_inside_the_lock(self):
		events = []

		@contextmanager
		def lock(name, **kwargs):
			events.append("lock")
			yield
			events.append("unlock")

		def record(event, method):
			def wrapper(*args, **kwargs):
				events.append(event)
				return method(*args, **kwargs)

			return wrapper

		self._enroll_new_student()
		self.commit.side_effect = lambda: events.append("commit")

		with (
			patch("lms.patches.v2_0.share_enrollment.filelock", lock),
			patch.object(frappe, "get_all", record("read", frappe.get_all)),
			patch.object(frappe.db, "bulk_insert", record("insert", frappe.db.bulk_insert)),
		):
			execute()

		self.assertEqual(events, ["lock", "read", "insert", "commit", "unlock"])
