# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Deleting a programming exercise is for its authors and Moderators. Its
submissions go with it, through the document API rather than raw deletes."""

import frappe

from lms.lms.api import delete_programming_exercise
from lms.lms.test_helpers import BaseTestUtils


class TestProgrammingExerciseDelete(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"ped-auth-{hash}@example.com", "Au", "Thor", ["Course Creator"]).name
		cls.other_creator = cls._create_user(
			f"ped-other-{hash}@example.com", "Ot", "Her", ["Course Creator"]
		).name
		cls.evaluator = cls._create_user(f"ped-eval-{hash}@example.com", "Ev", "Al", ["Batch Evaluator"]).name
		cls.moderator = cls._create_user(f"ped-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.learner = cls._create_user(f"ped-learn-{hash}@example.com", "Le", "Arner", ["LMS Student"]).name
		cls._require_no_moderators(cls.author, cls.other_creator, cls.evaluator)

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.exercise = self._create_programming_exercise(f"Delete Exercise {hash}").name
		self._set_authors("LMS Programming Exercise", self.exercise, [self.author])
		self.submission = (
			frappe.get_doc(
				{
					"doctype": "LMS Programming Exercise Submission",
					"exercise": self.exercise,
					"member": self.learner,
					"code": "print(1)",
					"status": "Passed",
				}
			)
			.insert()
			.name
		)

	def _delete_as(self, user):
		frappe.set_user(user)
		delete_programming_exercise(self.exercise)

	def _assert_gone(self):
		self.assertFalse(frappe.db.exists("LMS Programming Exercise", self.exercise))
		self.assertFalse(frappe.db.exists("LMS Programming Exercise Submission", self.submission))

	def _assert_kept(self):
		self.assertTrue(frappe.db.exists("LMS Programming Exercise", self.exercise))
		self.assertTrue(frappe.db.exists("LMS Programming Exercise Submission", self.submission))

	def test_the_author_deletes_the_exercise_and_its_submissions(self):
		self._delete_as(self.author)
		self._assert_gone()

	def test_a_moderator_deletes_any_exercise(self):
		self._delete_as(self.moderator)
		self._assert_gone()

	def test_another_course_creator_cannot_delete_it(self):
		with self.assertRaises(frappe.PermissionError):
			self._delete_as(self.other_creator)
		self._assert_kept()

	def test_a_batch_evaluator_cannot_delete_it(self):
		with self.assertRaises(frappe.PermissionError):
			self._delete_as(self.evaluator)
		self._assert_kept()
