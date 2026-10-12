# Copyright (c) 2022, Frappe and Contributors
# See license.txt

import json
import os

import frappe
import frappe.client
from frappe.utils import nowdate

from lms.lms.doctype.lms_certificate_evaluation.lms_certificate_evaluation import (
	create_lms_certificate,
)
from lms.lms.test_helpers import BaseTestUtils

COURSE_EVALUATOR_JSON = os.path.join(
	os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
	"course_evaluator",
	"course_evaluator.json",
)


class TestLMSCertificateEvaluation(BaseTestUtils):
	"""Ticket 68758. The Batch Evaluator DocPerm grants CRUD on the whole doctype, so every
	assertion here is about the has_permission / query-condition pair keeping one
	evaluator out of another's evaluations."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# User names are the lowercased email, while frappe.session.user keeps
		# whatever set_user was handed; a mixed-case fixture compares unequal to its
		# own row and fakes a denial.
		hash = frappe.generate_hash(length=6).lower()
		cls.evaluator_a = cls._create_user(
			f"certeval-a-{hash}@example.com", "Eval", "Ay", ["Batch Evaluator"]
		).name
		cls.evaluator_b = cls._create_user(
			f"certeval-b-{hash}@example.com", "Eval", "Bee", ["Batch Evaluator"]
		).name
		cls.member = cls._create_user(
			f"certeval-member-{hash}@example.com", "Cert", "Member", ["LMS Student"]
		).name
		cls.student = cls._create_user(
			f"certeval-student-{hash}@example.com", "Cert", "Student", ["LMS Student"]
		).name
		cls.course = cls._create_course(title=f"Cert Eval Course {hash}", instructor=cls.evaluator_a)
		# evaluator_b is the evaluator ASSIGNED to this course. The create rule asks
		# get_evaluator(), not the row's own field, so a course with no assigned
		# evaluator would deny everyone and the no-regression tests would pass vacuously.
		# Course Evaluator autonames field:evaluator, so the row is unique in the DB and
		# ignore_if_duplicate leans on that instead of an exists()-then-insert race.
		# nosemgrep: lms-unjustified-ignore-permissions
		frappe.get_doc({"doctype": "Course Evaluator", "evaluator": cls.evaluator_b}).insert(
			ignore_permissions=True, ignore_if_duplicate=True
		)
		frappe.db.set_value("LMS Course", cls.course.name, "evaluator", cls.evaluator_b)

	def setUp(self):
		super().setUp()
		self.assertIn("Batch Evaluator", frappe.get_roles(self.evaluator_a))
		self.assertIn("Batch Evaluator", frappe.get_roles(self.evaluator_b))
		self.assertNotIn("Batch Evaluator", frappe.get_roles(self.student))
		self.evaluation = self._create_evaluation(self.evaluator_b, self.member)

	def _create_evaluation(self, evaluator, member, start_time="10:00:00"):
		# nosemgrep: lms-unjustified-ignore-permissions - seeding the row the rules under test are then measured against
		return frappe.get_doc(
			{
				"doctype": "LMS Certificate Evaluation",
				"course": self.course.name,
				"member": member,
				"evaluator": evaluator,
				"date": nowdate(),
				"start_time": start_time,
				"status": "Pending",
			}
		).insert(ignore_permissions=True)

	def _evaluation_payload(self, evaluator, member, start_time):
		return {
			"doctype": "LMS Certificate Evaluation",
			"course": self.course.name,
			"member": member,
			"evaluator": evaluator,
			"date": nowdate(),
			"start_time": start_time,
			"status": "Pending",
		}

	def test_an_evaluator_cannot_create_an_evaluation_assigned_to_another(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.insert(self._evaluation_payload(self.evaluator_b, self.member, "11:00:00"))

	def test_an_evaluator_cannot_write_another_evaluators_evaluation(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.set_value("LMS Certificate Evaluation", self.evaluation.name, "summary", "tampered")

	def test_an_evaluator_cannot_delete_another_evaluators_evaluation(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("LMS Certificate Evaluation", self.evaluation.name)

	def test_another_evaluators_evaluation_is_not_listed(self):
		"""The hook is consulted on a single-document read but not on a list query,
		so the leak this closes is the one a plain report or export goes through."""
		frappe.set_user(self.evaluator_a)
		names = frappe.get_list(
			"LMS Certificate Evaluation", filters={"name": self.evaluation.name}, pluck="name"
		)
		self.assertEqual(names, [])

	def test_an_evaluator_cannot_certify_from_another_evaluators_evaluation(self):
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			create_lms_certificate(self.evaluation.name)

	def test_create_lms_certificate_rejects_a_non_string_evaluation(self):
		"""The type hint only raises under frappe.flags.in_test, so the guard has to
		be reached past the decorator that the runner makes strict."""
		frappe.set_user(self.evaluator_b)
		with self.assertRaises(frappe.ValidationError):
			create_lms_certificate.__wrapped__({"doctype": "LMS Certificate Evaluation"})

	def test_an_evaluator_cannot_self_assign_on_a_course_they_do_not_evaluate(self):
		"""Regression: scoping create to the row's own `evaluator` field was not enough.

		The caller chooses that field on a new row, so an evaluator could still mint a
		Pass for any member on any course by naming themselves. The rule asks
		get_evaluator() for the course/batch instead, matching save_evaluation_details.
		"""
		frappe.set_user(self.evaluator_a)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.insert(self._evaluation_payload(self.evaluator_a, self.student, "13:00:00"))

	def test_the_assigned_evaluator_still_works_their_own_evaluation(self):
		frappe.set_user(self.evaluator_b)

		frappe.client.set_value("LMS Certificate Evaluation", self.evaluation.name, "summary", "graded")
		self.assertEqual(
			frappe.db.get_value("LMS Certificate Evaluation", self.evaluation.name, "summary"),
			"graded",
		)

		names = frappe.get_list(
			"LMS Certificate Evaluation", filters={"name": self.evaluation.name}, pluck="name"
		)
		self.assertEqual(names, [self.evaluation.name])

		created = frappe.client.insert(self._evaluation_payload(self.evaluator_b, self.student, "12:00:00"))
		self.assertEqual(created["evaluator"], self.evaluator_b)

		self.assertEqual(create_lms_certificate(self.evaluation.name).doctype, "LMS Certificate")

	def test_a_moderator_is_unrestricted(self):
		moderator = self._create_user(
			f"certeval-mod-{frappe.generate_hash(length=6).lower()}@example.com",
			"Cert",
			"Mod",
			["Moderator", "Batch Evaluator"],
		).name
		frappe.set_user(moderator)

		names = frappe.get_list(
			"LMS Certificate Evaluation", filters={"name": self.evaluation.name}, pluck="name"
		)
		self.assertEqual(names, [self.evaluation.name])
		frappe.client.set_value("LMS Certificate Evaluation", self.evaluation.name, "summary", "moderated")

	def test_a_plain_student_reaches_nothing(self):
		frappe.set_user(self.student)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.set_value("LMS Certificate Evaluation", self.evaluation.name, "summary", "tampered")

	def test_course_evaluator_is_not_self_assignable(self):
		"""Inserting a Course Evaluator row *grants* its subject the Batch Evaluator
		role (CourseEvaluator.validate_evaluator_role writes the Has Role with
		ignore_permissions), so create on that doctype is a role grant. The shipped
		permissions are the fix; tabDocPerm only catches up at `bench migrate`, so
		apply them here rather than assert against whatever this site last synced.
		"""
		with open(COURSE_EVALUATOR_JSON) as f:
			shipped = {p["role"]: p for p in json.load(f)["permissions"]}

		for role in ("Batch Evaluator", "Course Creator"):
			for ptype in ("create", "write", "delete"):
				self.assertFalse(
					shipped[role].get(ptype),
					f"Course Evaluator must not grant {ptype} to {role}",
				)

		rows = frappe.get_all(
			"DocPerm",
			filters={"parent": "Course Evaluator", "role": ["in", ["Batch Evaluator", "Course Creator"]]},
			fields=["name", "role", "create", "write", "delete"],
		)
		try:
			for row in rows:
				frappe.db.set_value(
					"DocPerm",
					row.name,
					{ptype: 0 for ptype in ("create", "write", "delete")},
					update_modified=False,
				)
			frappe.clear_cache()

			frappe.set_user(self.evaluator_a)
			with self.assertRaises(frappe.PermissionError):
				frappe.client.insert({"doctype": "Course Evaluator", "evaluator": self.evaluator_a})
		finally:
			frappe.set_user("Administrator")
			for row in rows:
				frappe.db.set_value(
					"DocPerm",
					row.name,
					{ptype: row.get(ptype) for ptype in ("create", "write", "delete")},
					update_modified=False,
				)
			frappe.clear_cache()

	def test_setting_availability_still_works_without_the_docperm(self):
		"""The one legitimate write path: every Course Evaluator write in lms.lms.api
		goes through ignore_permissions, so narrowing the DocPerm costs an evaluator
		nothing."""
		from lms.lms.api import add_evaluator_slot

		frappe.set_user(self.evaluator_a)
		self.assertTrue(add_evaluator_slot(self.evaluator_a, "Monday", "09:00:00", "10:00:00"))
