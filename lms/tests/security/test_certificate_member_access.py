# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.doctype.lms_certificate.lms_certificate import get_default_certificate_template
from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.make_certificate_shares_read_only import execute as make_shares_read_only


class TestCertificateMemberAccess(BaseTestUtils):
	"""A learner reads and prints the certificate they earned. What it says is set
	by whoever issued it."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.learner = cls._create_user(f"cmlrn-{hash}@example.com", "Lee", "Learner", ["LMS Student"])
		instructor = cls._create_user(f"cminst-{hash}@example.com", "Ian", "Instructor", ["Course Creator"])
		cls.course = cls._create_course(title=f"Cert Course {hash}", instructor=instructor.name)
		cls.other_course = cls._create_course(title=f"Other Cert Course {hash}", instructor=instructor.name)
		cls._create_enrollment(cls.learner.name, cls.course.name)

	def setUp(self):
		super().setUp()
		# Earned the way create_certificate issues it: saved as the learner, who owns it.
		frappe.set_user(self.learner.name)
		self.certificate = frappe.get_doc(
			{
				"doctype": "LMS Certificate",
				"member": self.learner.name,
				"course": self.course.name,
				"issue_date": nowdate(),
				"template": get_default_certificate_template(),
			}
		).save(ignore_permissions=True)

	def _share(self):
		return frappe.db.get_value(
			"DocShare",
			{
				"share_doctype": "LMS Certificate",
				"share_name": self.certificate.name,
				"user": self.learner.name,
			},
			["read", "write", "share"],
			as_dict=True,
		)

	def test_the_learner_is_shared_their_certificate_to_read_only(self):
		self.assertEqual(self._share(), {"read": 1, "write": 0, "share": 0})

	def test_the_learner_can_read_and_print_it(self):
		certificate = frappe.get_doc("LMS Certificate", self.certificate.name)
		for ptype in ("read", "print"):
			self.assertTrue(frappe.has_permission("LMS Certificate", ptype, certificate), ptype)

	def test_the_learner_cannot_change_it(self):
		certificate = frappe.get_doc("LMS Certificate", self.certificate.name)
		certificate.course = self.other_course.name
		certificate.issue_date = add_days(nowdate(), -2000)
		certificate.published = 1
		with self.assertRaises(frappe.PermissionError):
			certificate.save()
		self.assertEqual(frappe.db.get_value("LMS Certificate", certificate.name, "course"), self.course.name)

	def test_the_learner_cannot_pass_it_on(self):
		with self.assertRaises(frappe.PermissionError):
			frappe.share.add_docshare("LMS Certificate", self.certificate.name, "Guest", read=1)

	def test_the_learner_reads_an_unpublished_certificate_issued_to_them(self):
		frappe.set_user("Administrator")
		frappe.db.set_value(
			"LMS Certificate", self.certificate.name, {"owner": "Administrator", "published": 0}
		)
		frappe.set_user(self.learner.name)
		certificate = frappe.get_doc("LMS Certificate", self.certificate.name)
		for ptype in ("read", "print"):
			self.assertTrue(frappe.has_permission("LMS Certificate", ptype, certificate), ptype)

	def test_someone_else_cannot_read_an_unpublished_certificate(self):
		frappe.set_user("Administrator")
		frappe.db.set_value("LMS Certificate", self.certificate.name, "published", 0)
		other = self._create_user(
			f"cmoth-{frappe.generate_hash(length=6)}@example.com", "Ola", "Other", ["LMS Student"]
		)
		frappe.set_user(other.name)
		certificate = frappe.get_doc("LMS Certificate", self.certificate.name)
		self.assertFalse(frappe.has_permission("LMS Certificate", "read", certificate))

	def test_certificates_shared_before_are_made_read_only(self):
		frappe.set_user("Administrator")
		frappe.db.set_value(
			"DocShare",
			{
				"share_doctype": "LMS Certificate",
				"share_name": self.certificate.name,
				"user": self.learner.name,
			},
			{"write": 1, "share": 1},
		)
		# One the learner passed on while they still could.
		frappe.get_doc(
			{
				"doctype": "DocShare",
				"share_doctype": "LMS Certificate",
				"share_name": self.certificate.name,
				"user": "Administrator",
				"read": 1,
				"write": 1,
				"share": 1,
			}
		).insert(ignore_permissions=True)

		make_shares_read_only()

		self.assertEqual(self._share(), {"read": 1, "write": 0, "share": 0})
		self.assertFalse(
			frappe.db.exists(
				"DocShare",
				{"share_doctype": "LMS Certificate", "share_name": self.certificate.name, "write": 1},
			)
		)
