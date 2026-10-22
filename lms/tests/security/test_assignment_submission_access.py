# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A learner answers an assignment only when a course or batch of theirs places
it. The fetch_from fields would otherwise copy any assignment's question back."""

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestAssignmentSubmissionAccess(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		instructor = cls._create_user(f"asa-instr-{hash}@example.com", "In", "Str", ["Course Creator"]).name
		cls.course_learner = cls._create_user(
			f"asa-course-{hash}@example.com", "Co", "Urse", ["LMS Student"]
		).name
		cls.batch_learner = cls._create_user(
			f"asa-batch-{hash}@example.com", "Ba", "Tch", ["LMS Student"]
		).name
		cls.outsider = cls._create_user(f"asa-out-{hash}@example.com", "Ou", "Tsider", ["LMS Student"]).name
		evaluator = cls._create_user(f"asa-eval-{hash}@example.com", "Ev", "Al", ["Batch Evaluator"]).name
		cls._create_evaluator(evaluator)

		cls.assignment = cls._create_assignment(f"Reachable Assignment {hash}").name
		cls.unplaced = cls._create_assignment(f"Unplaced Assignment {hash}").name

		course = cls._create_course(title=f"Placing Course {hash}", instructor=instructor).name
		cls._place_in_lesson(course, "LMS Assignment", cls.assignment)
		cls._create_enrollment(cls.course_learner, course)

		# The batch runs a course that does not place the assignment, so its
		# learner reaches the assignment through the batch alone.
		other_course = cls._create_course(title=f"Batch Only Course {hash}", instructor=instructor).name
		batch = cls._create_batch(
			other_course, instructor=instructor, title=f"Placing Batch {hash}", evaluator=evaluator
		)
		batch.append("assessment", {"assessment_type": "LMS Assignment", "assessment_name": cls.assignment})
		batch.save()
		cls._create_batch_enrollment(cls.batch_learner, batch.name)

	def _submission(self, assignment):
		return frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": assignment,
				"answer": "My answer.",
			}
		)

	def test_a_member_of_a_course_that_places_it_submits(self):
		frappe.set_user(self.course_learner)
		doc = self._submission(self.assignment).insert()
		self.assertEqual(doc.member, self.course_learner)
		self.assertTrue(doc.question)

	def test_a_member_of_a_batch_that_runs_it_submits(self):
		frappe.set_user(self.batch_learner)
		doc = self._submission(self.assignment).insert()
		self.assertEqual(doc.member, self.batch_learner)

	def test_an_unrelated_learner_cannot_submit(self):
		frappe.set_user(self.outsider)
		with self.assertRaises(frappe.PermissionError):
			self._submission(self.assignment).insert()
		self.assertFalse(
			frappe.db.exists(
				"LMS Assignment Submission", {"assignment": self.assignment, "member": self.outsider}
			)
		)

	def test_a_saved_submission_cannot_be_repointed_at_an_unreachable_assignment(self):
		frappe.set_user(self.course_learner)
		doc = self._submission(self.assignment).insert()
		doc.assignment = self.unplaced
		with self.assertRaises(frappe.PermissionError):
			doc.save()
