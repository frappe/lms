# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
from frappe.exceptions import FrappeTypeError
from frappe.utils import getdate

from lms.lms.api import get_certification_details
from lms.lms.test_helpers import BaseTestUtils

UNPUBLISHED_COURSE_MESSAGE = "You do not have permission to view this course."


class TestGetCertificationDetails(BaseTestUtils):
	"""LMS Student has no read permission on LMS Course, so everything the
	certification page needs about the course has to come from here."""

	def setUp(self):
		super().setUp()
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self.student = self._create_user(
			f"cert.learner.{frappe.generate_hash(length=8)}@example.com",
			"Cert",
			"Learner",
			["LMS Student"],
		)
		self.outsider = self._create_user(
			f"cert.outsider.{frappe.generate_hash(length=8)}@example.com",
			"Cert",
			"Outsider",
			["LMS Student"],
		)
		self.evaluator = self._create_evaluator()
		self.course = self._create_course()
		self.previous_course_fields = frappe.db.get_value(
			"LMS Course", self.course.name, ["paid_certificate", "evaluator", "published"], as_dict=1
		)
		frappe.db.set_value(
			"LMS Course",
			self.course.name,
			{"paid_certificate": 1, "evaluator": self.evaluator.name},
		)
		self._create_enrollment(self.student.name, self.course.name)
		frappe.db.set_value(
			"LMS Enrollment",
			{"course": self.course.name, "member": self.student.name},
			"purchased_certificate",
			1,
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.set_value("LMS Course", self.course.name, self.previous_course_fields)
		super().tearDown()

	def test_learner_gets_the_course_title_and_evaluator(self):
		frappe.set_user(self.student.name)
		# The gate this endpoint exists to get past.
		self.assertFalse(frappe.has_permission("LMS Course", "read"))

		details = get_certification_details(self.course.name)
		self.assertEqual(details["title"], self.course.title)
		self.assertEqual(details["evaluator"], self.evaluator.name)
		self.assertEqual(details["paid_certificate"], 1)
		self.assertEqual(details["membership"]["purchased_certificate"], 1)

	def test_evaluator_is_withheld_from_someone_not_on_the_course(self):
		frappe.set_user(self.outsider.name)
		details = get_certification_details(self.course.name)
		self.assertIsNone(details["membership"])
		self.assertIsNone(details["evaluator"])
		self.assertEqual(details["title"], self.course.title)

	def test_evaluator_is_withheld_until_the_certificate_is_paid_for(self):
		# Enrolment alone is self-service on a published course; the page only
		# reads the evaluator past the purchase gate.
		frappe.db.set_value(
			"LMS Enrollment",
			{"course": self.course.name, "member": self.student.name},
			"purchased_certificate",
			0,
		)
		frappe.set_user(self.student.name)

		details = get_certification_details(self.course.name)
		self.assertIsNotNone(details["membership"])
		self.assertIsNone(details["evaluator"])

	def test_a_guest_is_not_a_permitted_caller(self):
		# allow_guest is what frappe checks at dispatch, and it records the
		# function in frappe.guest_methods rather than tagging it.
		self.assertNotIn(get_certification_details, frappe.guest_methods)

		frappe.set_user("Guest")
		details = get_certification_details(self.course.name)
		self.assertIsNone(details["membership"])
		self.assertIsNone(details["evaluator"])
		self.assertIsNone(details["certificate"])

	def test_a_user_with_no_lms_role_gets_no_evaluator(self):
		stranger = self._create_user(
			f"cert.stranger.{frappe.generate_hash(length=8)}@example.com",
			"Cert",
			"Stranger",
			[],
		)
		frappe.set_user(stranger.name)

		details = get_certification_details(self.course.name)
		self.assertIsNone(details["membership"])
		self.assertIsNone(details["evaluator"])

	def test_certificate_carries_the_issue_date_the_page_renders(self):
		certificate = self._create_certificate(self.course.name, self.student.name)
		frappe.set_user(self.student.name)

		details = get_certification_details(self.course.name)
		self.assertEqual(details["certificate"]["name"], certificate.name)
		self.assertEqual(getdate(details["certificate"]["issue_date"]), getdate(certificate.issue_date))

	def test_unpublished_course_title_is_withheld_from_an_outsider(self):
		# get_course_details hides an unpublished course from anyone who isn't
		# enrolled, modifying it, or staff; this endpoint skipped that check.
		frappe.db.set_value("LMS Course", self.course.name, "published", 0)
		frappe.set_user(self.outsider.name)

		with self.assertRaisesRegex(frappe.PermissionError, UNPUBLISHED_COURSE_MESSAGE):
			get_certification_details(self.course.name)

	def test_unpublished_course_is_still_visible_to_the_enrolled_learner(self):
		frappe.db.set_value("LMS Course", self.course.name, "published", 0)
		frappe.set_user(self.student.name)

		details = get_certification_details(self.course.name)
		self.assertEqual(details["title"], self.course.title)

	def test_unpublished_course_is_still_visible_to_the_instructor(self):
		frappe.db.set_value("LMS Course", self.course.name, "published", 0)
		frappe.set_user(self.instructor.name)

		details = get_certification_details(self.course.name)
		self.assertEqual(details["title"], self.course.title)

	def test_unknown_course_returns_no_details(self):
		frappe.set_user(self.student.name)
		details = get_certification_details(f"missing-{frappe.generate_hash(length=8)}")
		self.assertIsNone(details["title"])
		self.assertIsNone(details["evaluator"])
		self.assertIsNone(details["certificate"])

	def test_non_string_course_is_rejected_at_the_boundary(self):
		# A filter list is the exploit db.get_value's flexibility hands you.
		frappe.set_user(self.student.name)
		with self.assertRaises(FrappeTypeError):
			get_certification_details(["!=", ""])

	def test_the_isinstance_guard_rejects_it_too(self):
		# require_type_annotated_api_methods makes frappe coerce before the body
		# runs, so the guard above it is only reachable undecorated. Without this
		# the guard has no coverage at all and the test above passes on a commit
		# that never had one.
		frappe.set_user(self.student.name)
		with self.assertRaises(frappe.ValidationError):
			get_certification_details.__wrapped__(["!=", ""])
