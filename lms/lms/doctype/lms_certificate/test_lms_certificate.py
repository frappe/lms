# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

from contextlib import contextmanager
from unittest.mock import patch

import frappe

from lms.lms.doctype.lms_certificate.lms_certificate import LMSCertificate, create_certificate
from lms.lms.test_helpers import BaseTestUtils


class TestLMSCertificate(BaseTestUtils):
	"""create_certificate() checks is_certified() and only inserts if that comes
	back empty - a doubled click on "Get Certificate" is enough for two requests
	to both read "not certified yet" before either one's insert has committed
	(#2408). Locking the course row before that check, the same way
	enroll_in_course() locks it before its own duplicate-enrollment check
	(lms/lms/utils.py), makes the second request wait for the first to commit
	rather than racing it. The unique constraint on (member, course,
	batch_name) is the backstop for whatever creates a certificate without
	going through create_certificate() at all.
	"""

	def setUp(self):
		super().setUp()
		self._setup_course_flow()
		frappe.db.set_value("LMS Course", self.course.name, "enable_certification", 1)

	def tearDown(self):
		frappe.session.user = "Administrator"
		super().tearDown()

	def test_create_certificate_is_idempotent(self):
		# student1 is already certified for self.course via _setup_course_flow();
		# use student2, who is enrolled and complete but not yet certified.
		frappe.session.user = self.student2.email

		first = create_certificate(self.course.name)
		second = create_certificate(self.course.name)

		self.assertEqual(first.name, second.name)
		self.assertEqual(self._certificate_count(self.student2.email), 1)

	def test_create_certificate_locks_the_course_before_checking(self):
		"""A lock taken after the read is no lock at all, so the order is the
		assertion - same shape as test_course_enrollment_locks_the_course_before_reading
		in tests/test_enrollment_races.py."""
		frappe.session.user = self.student2.email
		log = []
		with self._logging_db(log):
			create_certificate(self.course.name)
		self.assertIn(("lock", "LMS Course"), log, f"no FOR UPDATE on LMS Course: {log}")
		self.assertIn(("read", "LMS Certificate"), log)
		self.assertLess(
			log.index(("lock", "LMS Course")),
			log.index(("read", "LMS Certificate")),
			f"read LMS Certificate before locking LMS Course: {log}",
		)

	def test_duplicate_certificate_is_refused_by_the_database(self):
		"""Bypasses both is_certified() and the controller's own duplicate check
		(validate_duplicate_certificate) - what's left standing between two
		certificates for the same member+course is the unique constraint alone.
		Same shape as test_duplicate_batch_enrollment_is_refused_by_the_database
		in tests/test_enrollment_races.py."""
		frappe.session.user = self.student2.email
		with patch.object(LMSCertificate, "validate_duplicate_certificate"):
			self._insert_certificate()
			with self.assertRaises(frappe.UniqueValidationError):
				self._insert_certificate()

	def test_the_controller_check_still_reports_the_friendly_error(self):
		"""The constraint is a backstop, not a replacement: an ordinary sequential
		duplicate - no race, nothing patched out - must still get the readable
		validate_duplicate_certificate() message rather than a database error."""
		frappe.session.user = self.student2.email
		self._insert_certificate()
		with self.assertRaises(frappe.ValidationError) as caught:
			self._insert_certificate()
		self.assertNotIsInstance(caught.exception, frappe.UniqueValidationError)

	def test_create_certificate_survives_a_lost_race(self):
		"""Simulates two requests landing close enough together that both pass
		is_certified() before either commits: force that window by patching
		is_certified() to keep saying "not certified yet" on the second call,
		and by patching out validate_duplicate_certificate() the same way
		test_duplicate_certificate_is_refused_by_the_database does, since a real
		concurrent request would not see the first request's uncommitted row
		either. What's left to stop the second insert is the unique constraint,
		which create_certificate() now catches and turns into the certificate
		the first call already created - not an error, and not a second row."""
		frappe.session.user = self.student2.email

		first = create_certificate(self.course.name)

		# First call (the top-level is_certified() check) reports "not
		# certified yet"; second call (create_certificate's own recovery,
		# after the forced UniqueValidationError below) reports the real
		# certificate the first create_certificate() call already made -
		# a fresh, unmocked is_certified() would see the same thing by then,
		# since it's genuinely committed at that point.
		with (
			patch(
				"lms.lms.doctype.lms_certificate.lms_certificate.is_certified",
				side_effect=[None, first.name],
			),
			patch.object(LMSCertificate, "validate_duplicate_certificate"),
		):
			second = create_certificate(self.course.name)

		self.assertEqual(first.name, second.name)
		self.assertEqual(self._certificate_count(self.student2.email), 1)

	def test_blank_course_and_batch_name_are_normalized_before_saving(self):
		"""The unique constraint is on (member, course, batch_name), and a
		course-only certificate's batch_name (or a batch-only one's course)
		would otherwise save as SQL NULL rather than "" - which the constraint
		would not treat as equal to another NULL, silently defeating it for
		exactly the rows it exists to protect (see delete_duplicate_certificates.py)."""
		frappe.session.user = self.student2.email
		certificate = self._insert_certificate()
		self.assertEqual(certificate.batch_name, "")

	def _certificate_count(self, member):
		return frappe.db.count("LMS Certificate", {"member": member, "course": self.course.name})

	def _insert_certificate(self):
		doc = frappe.get_doc(
			{
				"doctype": "LMS Certificate",
				"member": frappe.session.user,
				"course": self.course.name,
				"issue_date": frappe.utils.nowdate(),
			}
		)
		doc.insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Certificate", doc.name))
		return doc

	@contextmanager
	def _logging_db(self, log):
		"""Wraps the real calls rather than replacing them, so the insert still
		runs and the log records the order it went in. Same approach as
		_logging_db in tests/test_enrollment_races.py, extended to frappe.get_all
		since is_certified() reads through that rather than frappe.db.exists()."""
		real_get_value, real_get_all = frappe.db.get_value, frappe.get_all

		def spy_get_value(*args, **kwargs):
			if kwargs.get("for_update") and args:
				log.append(("lock", args[0]))
			return real_get_value(*args, **kwargs)

		def spy_get_all(*args, **kwargs):
			if args:
				log.append(("read", args[0]))
			return real_get_all(*args, **kwargs)

		with (
			patch.object(frappe.db, "get_value", spy_get_value),
			patch.object(frappe, "get_all", spy_get_all),
		):
			yield
