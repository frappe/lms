# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe

from lms.lms.api import get_heatmap_data
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_student_progress


class TestProgressAccess(BaseTestUtils):
	"""A learner's batch progress and daily activity are for the people who teach
	them. A site-wide role on its own reaches nobody."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash

		# Each reaches the learner one way only: the course, the batch's instructor
		# list, or the batch course's evaluator tag.
		cls.instructor = cls._create_user(
			f"pa-instr-{hash}@example.com", "Ivy", "Instr", ["Course Creator"]
		).name
		cls.batch_instructor = cls._create_user(
			f"pa-batch-instr-{hash}@example.com", "Bea", "Batch", ["Course Creator"]
		).name
		cls.evaluator = cls._create_user(
			f"pa-eval-{hash}@example.com", "Eve", "Eval", ["Batch Evaluator"]
		).name
		# Hold the same roles, teach nothing the learner is in.
		cls.other_creator = cls._create_user(
			f"pa-creator-{hash}@example.com", "Otto", "Creator", ["Course Creator"]
		).name
		cls.other_evaluator = cls._create_user(
			f"pa-other-eval-{hash}@example.com", "Oona", "Eval", ["Batch Evaluator"]
		).name
		cls.moderator = cls._create_user(f"pa-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.student = cls._create_user(f"pa-stud-{hash}@example.com", "Sam", "Stud", ["LMS Student"]).name
		cls.outsider = cls._create_user(f"pa-out-{hash}@example.com", "Ola", "Out", ["LMS Student"]).name

		cls.course = cls._create_course(f"Progress Access {hash}", instructor=cls.instructor).name
		chapter = cls._create_chapter(f"Chapter {hash}", cls.course).name
		cls.lesson = cls._create_lesson(f"Lesson {hash}", chapter, cls.course).name
		cls._create_chapter_reference(cls.course, chapter)
		cls._create_lesson_reference(chapter, cls.lesson)
		cls._create_enrollment(cls.student, cls.course)
		cls._create_progress(cls.student, cls.course, cls.lesson)

		cls._create_evaluator(cls.evaluator)
		cls._create_evaluator(cls.other_evaluator)
		cls.batch = cls._create_batch(
			cls.course,
			instructor=cls.batch_instructor,
			title=f"Progress Access Batch {hash}",
			evaluator=cls.evaluator,
		).name
		cls._create_batch_enrollment(cls.student, cls.batch)
		# The other evaluator's own batch: the role is real, the reach is not.
		other_course = cls._create_course(f"Progress Access Other {hash}", instructor=cls.other_creator).name
		cls._create_batch(
			other_course,
			instructor=cls.other_creator,
			title=f"Progress Access Other Batch {hash}",
			evaluator=cls.other_evaluator,
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _as(self, user, fn):
		frappe.set_user(user)
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	# get_batch_student_progress

	def test_batch_progress_is_for_the_batchs_own_staff(self):
		for user in (self.batch_instructor, self.evaluator, self.moderator):
			with self.subTest(user=user):
				details = self._as(user, lambda: get_batch_student_progress(self.student, self.batch))
				self.assertEqual(details["full_name"], "Sam Stud")
				self.assertEqual(details["courses"][0]["progress"], 100)

	def test_batch_progress_refuses_an_evaluator_of_another_batch(self):
		"""Holding Batch Evaluator used to pass the gate for every batch on the site.
		Teaching the course is not staffing the batch either."""
		for user in (self.other_evaluator, self.other_creator, self.instructor, self.student):
			with self.subTest(user=user):
				with self.assertRaises(frappe.PermissionError):
					self._as(user, lambda: get_batch_student_progress(self.student, self.batch))

	def test_batch_progress_still_refuses_a_member_outside_the_batch(self):
		with self.assertRaises(frappe.PermissionError):
			self._as(self.evaluator, lambda: get_batch_student_progress(self.outsider, self.batch))
		# The whitelist's type hints turn a non-string member away.
		with self.assertRaises(TypeError):
			self._as(self.evaluator, lambda: get_batch_student_progress(["x"], self.batch))

	# get_heatmap_data

	def test_heatmap_is_for_the_learner_and_the_people_who_teach_them(self):
		"""Through the course, the batch's instructor list, or its evaluator tag."""
		for user in (self.student, self.instructor, self.batch_instructor, self.evaluator, self.moderator):
			with self.subTest(user=user):
				data = self._as(user, lambda: get_heatmap_data(self.student))
				self.assertEqual(data["total_activities"], 1)

	def test_heatmap_resolves_a_username(self):
		username = frappe.db.get_value("User", self.student, "username")
		data = self._as(self.instructor, lambda: get_heatmap_data(username, base_days="30"))
		self.assertEqual(data["total_activities"], 1)

	def test_heatmap_refuses_staff_who_do_not_teach_the_learner(self):
		"""A Course Creator or Batch Evaluator used to reach every learner on the site."""
		for user in (self.other_creator, self.other_evaluator, self.outsider):
			with self.subTest(user=user):
				with self.assertRaises(frappe.PermissionError):
					self._as(user, lambda: get_heatmap_data(self.student))

	def test_heatmap_refuses_an_unknown_or_malformed_member(self):
		with self.assertRaises(frappe.PermissionError):
			self._as(self.instructor, lambda: get_heatmap_data(f"nobody-{self.hash}"))
		with self.assertRaises(TypeError):
			self._as(self.instructor, lambda: get_heatmap_data({"member": self.student}))
