import frappe
from frappe.utils import nowdate

from lms.lms.dashboard.course import issue_course_certificate
from lms.lms.doctype.lms_certificate.lms_certificate import (
	create_certificate,
	get_default_certificate_template,
)
from lms.lms.test_helpers import BaseTestUtils


class TestCertificateBatch(BaseTestUtils):
	"""A course taken through a batch is certified as part of that batch (#2675)."""

	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		self._create_evaluator("frappe@example.com")
		self.student = self._create_user("cert-batch@example.com", "Cert", "Batch", ["LMS Student"])
		self.course = self._create_course(title="Certificate Batch Course")
		self.second_course = self._create_course(title="Certificate Batch Second Course")
		for course in (self.course, self.second_course):
			course.db_set("enable_certification", 1)
		self.batch = self._create_batch(self.course.name, title="Certificate Batch")
		self.batch.append("courses", {"course": self.second_course.name, "evaluator": "frappe@example.com"})
		self.batch.save()
		self._create_batch_enrollment(self.student.name, self.batch.name)

	def _complete(self, course):
		frappe.db.set_value(
			"LMS Enrollment", {"course": course, "member": self.student.name}, "progress", 100
		)

	def _claim(self, course):
		self._complete(course)
		frappe.set_user(self.student.name)
		try:
			return create_certificate(course)
		finally:
			frappe.set_user("Administrator")

	def test_a_claimed_certificate_names_the_batch(self):
		certificate = self._claim(self.course.name)

		self.assertEqual(
			frappe.db.get_value("LMS Certificate", certificate.name, ["batch_name", "batch_title"]),
			(self.batch.name, self.batch.title),
		)

	def test_each_course_of_the_batch_can_be_certified(self):
		"""The batch check refused a second course once the first carried the batch."""
		self._claim(self.course.name)
		second = self._claim(self.second_course.name)

		self.assertEqual(frappe.db.get_value("LMS Certificate", second.name, "batch_name"), self.batch.name)

	def test_a_certificate_issued_from_the_dashboard_names_the_batch(self):
		chapter = self._create_chapter("Certificate Batch Chapter", self.course.name).name
		self._create_chapter_reference(self.course.name, chapter)
		lesson = self._create_lesson("Certificate Batch Lesson", chapter, self.course.name).name
		self._create_lesson_reference(chapter, lesson)
		self._create_progress(self.student.name, self.course.name, lesson)
		enrollment = frappe.db.get_value(
			"LMS Enrollment", {"course": self.course.name, "member": self.student.name}
		)

		certificate = issue_course_certificate(self.course.name, enrollment)

		self.assertEqual(
			frappe.db.get_value("LMS Certificate", certificate["name"], "batch_name"), self.batch.name
		)

	def test_a_certificate_issued_without_a_batch_stays_course_level(self):
		"""A member may hold a course-level certificate beside the batch ones."""
		self._complete(self.course.name)
		certificate = frappe.get_doc(
			{
				"doctype": "LMS Certificate",
				"member": self.student.name,
				"course": self.course.name,
				"issue_date": nowdate(),
				"template": get_default_certificate_template(),
			}
		).insert()

		self.assertFalse(certificate.batch_name)

	def test_a_learner_removed_from_the_batch_is_still_certified_for_the_course(self):
		"""Removing a learner from a batch keeps their course enrollment, which still
		names the batch; a certificate naming it would be refused as not enrolled."""
		frappe.delete_doc(
			"LMS Batch Enrollment",
			frappe.db.get_value(
				"LMS Batch Enrollment", {"batch": self.batch.name, "member": self.student.name}
			),
		)

		certificate = self._claim(self.course.name)

		self.assertFalse(frappe.db.get_value("LMS Certificate", certificate.name, "batch_name"))

	def test_a_course_taken_on_its_own_names_no_batch(self):
		course = self._create_course(title="Certificate Solo Course")
		course.db_set("enable_certification", 1)
		self._create_enrollment(self.student.name, course.name)

		certificate = self._claim(course.name)

		self.assertFalse(frappe.db.get_value("LMS Certificate", certificate.name, "batch_name"))
