# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A Course Creator reads and prints every certificate; issuing, changing and
deleting one is for the authors of its course or, for a batch certificate, of
its batch. The scope comes from the stored row, as it does for an evaluator."""

import frappe
from frappe.utils import nowdate

from lms.lms.doctype.lms_certificate.lms_certificate import get_default_certificate_template
from lms.lms.test_helpers import BaseTestUtils


class TestCertificateAuthoringScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"cas-auth-{hash}@example.com", "Au", "Thor", ["Course Creator"]).name
		cls.other_creator = cls._create_user(
			f"cas-other-{hash}@example.com", "Ot", "Her", ["Course Creator"]
		).name
		cls.moderator = cls._create_user(f"cas-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.learner = cls._create_user(f"cas-learn-{hash}@example.com", "Le", "Arner", ["LMS Student"]).name
		evaluator = cls._create_user(f"cas-eval-{hash}@example.com", "Ev", "Al", ["Batch Evaluator"]).name
		cls._create_evaluator(evaluator)
		cls._require_no_moderators(cls.author, cls.other_creator)

		cls.course = cls._create_course(title=f"Cert Scope {hash}", instructor=cls.author).name
		cls.other_course = cls._create_course(
			title=f"Other Cert Scope {hash}", instructor=cls.other_creator
		).name
		cls._create_enrollment(cls.learner, cls.course)
		cls._create_enrollment(cls.learner, cls.other_course)
		cls.batch = cls._create_batch(
			cls.course, instructor=cls.author, title=f"Cert Scope Batch {hash}", evaluator=evaluator
		).name
		cls._create_batch_enrollment(cls.learner, cls.batch)

	def setUp(self):
		super().setUp()
		self.certificate = self._certificate(course=self.course).insert()

	def _certificate(self, **fields):
		return frappe.get_doc(
			{
				"doctype": "LMS Certificate",
				"member": self.learner,
				"issue_date": nowdate(),
				"template": get_default_certificate_template(),
				"published": 1,
				**fields,
			}
		)

	def _can(self, user, ptype, doc=None):
		return frappe.has_permission("LMS Certificate", ptype, doc=doc or self.certificate, user=user)

	def test_every_course_creator_reads_and_prints_it(self):
		for ptype in ("read", "select", "print"):
			self.assertTrue(self._can(self.other_creator, ptype))
		frappe.set_user(self.other_creator)
		self.assertIn(self.certificate.name, frappe.get_list("LMS Certificate", pluck="name"))

	def test_only_the_courses_authors_change_it(self):
		for ptype in ("write", "delete"):
			with self.subTest(ptype=ptype):
				self.assertTrue(self._can(self.author, ptype))
				self.assertTrue(self._can(self.moderator, ptype))
				self.assertFalse(self._can(self.other_creator, ptype))

	def test_another_course_creator_cannot_save_it(self):
		frappe.set_user(self.other_creator)
		doc = frappe.get_doc("LMS Certificate", self.certificate.name)
		doc.published = 0
		with self.assertRaises(frappe.PermissionError):
			doc.save()

	def test_a_course_creator_issues_one_for_their_own_course_only(self):
		own = self._certificate(course=self.course)
		other = self._certificate(course=self.other_course)
		self.assertTrue(self._can(self.author, "create", own))
		self.assertFalse(self._can(self.author, "create", other))
		self.assertTrue(self._can(self.other_creator, "create", other))

	def test_it_cannot_be_moved_into_another_authors_course(self):
		doc = frappe.get_doc("LMS Certificate", self.certificate.name)
		doc.course = self.other_course
		self.assertFalse(self._can(self.author, "write", doc))
		self.assertFalse(self._can(self.other_creator, "write", doc))

	def test_a_batch_author_issues_a_batch_certificate(self):
		doc = self._certificate(batch_name=self.batch)
		self.assertTrue(self._can(self.author, "create", doc))
		self.assertFalse(self._can(self.other_creator, "create", doc))
