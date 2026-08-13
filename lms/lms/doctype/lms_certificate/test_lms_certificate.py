# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

from unittest.mock import patch

import frappe

from lms.lms.doctype.lms_certificate.lms_certificate import create_certificate
from lms.lms.test_helpers import BaseTestUtils


class TestLMSCertificate(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._setup_course_flow()
		frappe.db.set_value("LMS Course", self.course.name, "enable_certification", 1)

	def tearDown(self):
		frappe.session.user = "Administrator"
		super().tearDown()

	def test_create_certificate_is_idempotent(self):
		"""Calling create_certificate twice in a row for the same member and
		course should hand back the same certificate the second time, not
		create a second one."""
		frappe.session.user = self.student2.email

		first = create_certificate(self.course.name)
		second = create_certificate(self.course.name)

		self.assertEqual(first.name, second.name)
		self.assertEqual(
			frappe.db.count("LMS Certificate", {"member": self.student2.email, "course": self.course.name}),
			1,
		)

	def test_create_certificate_survives_a_lost_race(self):
		"""https://github.com/frappe/lms/issues/2408 - two concurrent requests
		for the same member+course can both pass the is_certified() check
		before either one's insert has committed, since nothing locks between
		the two. Force that window here by making is_certified() report "not
		certified yet" on the second call even though the first call's
		certificate already made it into the database. With the unique
		constraint on (member, course, batch_name) in place, that second
		insert should come back as a UniqueValidationError, which
		create_certificate now catches and turns into the certificate the
		first call already created - not an error, and not a second row.
		"""
		frappe.session.user = self.student2.email

		first = create_certificate(self.course.name)

		with patch("lms.lms.doctype.lms_certificate.lms_certificate.is_certified", return_value=None):
			second = create_certificate(self.course.name)

		self.assertEqual(first.name, second.name)
		self.assertEqual(
			frappe.db.count("LMS Certificate", {"member": self.student2.email, "course": self.course.name}),
			1,
		)
