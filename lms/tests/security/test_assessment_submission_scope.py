# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe

from lms.lms.permissions import assessment_submission_has_permission
from lms.lms.test_helpers import BaseTestUtils


class TestAssessmentSubmissionScope(BaseTestUtils):
	"""A submission reaches its own member and whoever administers the assessment
	it answers -- both halves registered in hooks.py, both read off the stored row."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.suffix = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"asub-instr-{self.suffix}@example.com", "Ivy", "Instructor", ["Course Creator"]
		)
		self.member = self._create_user(
			f"asub-member-{self.suffix}@example.com", "Mel", "Member", ["LMS Student"]
		)
		self.outsider = self._create_user(
			f"asub-outsider-{self.suffix}@example.com", "Ove", "Outsider", ["LMS Student"]
		)
		self.course = self._create_course(
			title=f"Submission Course {self.suffix}", instructor=self.instructor.name
		)
		self.assignment = self._create_assignment(title=f"Submission Assignment {self.suffix}")
		self._place_in_lesson(self.course.name, "LMS Assignment", self.assignment.name)
		self._create_enrollment(self.member.name, self.course.name)
		self.submission = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": self.assignment.name,
				"member": self.member.name,
				"answer": "The submitted answer.",
			}
		).insert(ignore_permissions=True)
		# insert() stamps `owner` from the acting session user regardless of what is
		# passed in, so the if_owner DocPerm needs it set explicitly afterwards.
		frappe.db.set_value("LMS Assignment Submission", self.submission.name, "owner", self.member.name)
		self.submission.reload()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_both_halves_are_registered_for_all_three_submission_doctypes(self):
		from lms import hooks

		for doctype in (
			"LMS Quiz Submission",
			"LMS Assignment Submission",
			"LMS Programming Exercise Submission",
		):
			with self.subTest(doctype=doctype):
				self.assertEqual(
					hooks.has_permission.get(doctype),
					"lms.lms.permissions.assessment_submission_has_permission",
				)
				self.assertIsNotNone(hooks.permission_query_conditions.get(doctype))

	def test_the_owning_member_reads_it_and_an_outsider_does_not(self):
		self.assertTrue(
			frappe.has_permission("LMS Assignment Submission", "read", self.submission, user=self.member.name)
		)
		self.assertFalse(
			frappe.has_permission(
				"LMS Assignment Submission", "read", self.submission, user=self.outsider.name
			)
		)

	def test_the_query_condition_narrows_get_list_the_same_way(self):
		frappe.set_user(self.member.name)
		try:
			self.assertIn(
				self.submission.name,
				frappe.get_list("LMS Assignment Submission", pluck="name", limit_page_length=0),
			)
		finally:
			frappe.set_user("Administrator")
		frappe.set_user(self.outsider.name)
		try:
			self.assertNotIn(
				self.submission.name,
				frappe.get_list("LMS Assignment Submission", pluck="name", limit_page_length=0),
			)
		finally:
			frappe.set_user("Administrator")

	def test_the_batch_evaluator_role_on_its_own_administers_nothing(self):
		"""The role's DocPerm row grants write site-wide (if_owner=0), which is the
		grant this pair narrows. What makes someone an evaluator *of* an assessment is
		the Batch Course row tagging them on a batch that runs it; the role alone --
		which a Course Evaluator insert hands out -- leaves them a bystander."""
		bystander = self._create_user(
			f"asub-eval-{self.suffix}@example.com", "Bea", "Bystander", ["Batch Evaluator"]
		)
		self.assertFalse(
			frappe.has_permission("LMS Assignment Submission", "write", self.submission, user=bystander.name)
		)

	def test_the_course_instructor_administers_it(self):
		self.assertTrue(
			frappe.has_permission(
				"LMS Assignment Submission", "write", self.submission, user=self.instructor.name
			)
		)

	def test_the_course_instructor_lists_quiz_submissions(self):
		"""LMS Quiz Submission's own DocPerm grants read only to System Manager and
		the owning student; without an instructor role granted there too, the query
		condition has nothing to narrow and this hook is never even reached."""
		questions = self._create_quiz_questions()
		quiz = self._create_quiz(questions, title=f"Submission Quiz {self.suffix}")
		self._place_in_lesson(self.course.name, "LMS Quiz", quiz.name)
		submission = frappe.get_doc(
			{
				"doctype": "LMS Quiz Submission",
				"quiz": quiz.name,
				"member": self.member.name,
				"score": 1,
				"score_out_of": 1,
				"percentage": 100,
				"passing_percentage": 70,
			}
		).insert(ignore_permissions=True)

		self.assertTrue(
			frappe.has_permission("LMS Quiz Submission", "read", submission, user=self.instructor.name)
		)
		frappe.set_user(self.instructor.name)
		try:
			self.assertIn(
				submission.name,
				frappe.get_list("LMS Quiz Submission", pluck="name", limit_page_length=0),
			)
		finally:
			frappe.set_user("Administrator")

	def test_a_system_manager_keeps_access(self):
		"""The DocPerm gain for Quiz Submission's instructor roles must not have
		disturbed System Manager's own row on either submission doctype."""
		site_admin = self._create_user(
			f"asub-sysman-{self.suffix}@example.com", "Sam", "SysManager", ["System Manager"]
		)
		self.assertTrue(
			frappe.has_permission("LMS Assignment Submission", "read", self.submission, user=site_admin.name)
		)
		quiz_submission = frappe.get_doc(
			{
				"doctype": "LMS Quiz Submission",
				"quiz": self._create_quiz(
					self._create_quiz_questions(), title=f"Sysman Quiz {self.suffix}"
				).name,
				"member": self.member.name,
				"score": 1,
				"score_out_of": 1,
				"percentage": 100,
				"passing_percentage": 70,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(
			frappe.has_permission("LMS Quiz Submission", "read", quiz_submission, user=site_admin.name)
		)

	def test_naming_yourself_the_member_in_memory_does_not_grant_access(self):
		"""`member` must match in both the stored row and the submitted value; an
		outsider cannot claim someone else's row by relabelling it in memory."""
		doc = frappe.get_doc("LMS Assignment Submission", self.submission.name)
		doc.member = self.outsider.name
		self.assertFalse(assessment_submission_has_permission(doc, "read", self.outsider.name))

	def test_a_stranger_cannot_borrow_administration_by_repointing_the_assessment_field(self):
		"""The move this predicate refuses: a stranger who administers a *different*
		assignment cannot reach this row by pointing its assignment field at theirs --
		the stored assignment is the one that must be administered too."""
		other_course = self._create_course(title=f"Stranger Course {self.suffix}", instructor="Administrator")
		stranger = self._create_user(
			f"asub-stranger-{self.suffix}@example.com", "Sid", "Stranger", ["Course Creator"]
		)
		other_assignment = self._create_assignment(title=f"Stranger Assignment {self.suffix}")
		self._place_in_lesson(other_course.name, "LMS Assignment", other_assignment.name)
		other_course_doc = frappe.get_doc("LMS Course", other_course.name)
		other_course_doc.append("instructors", {"instructor": stranger.name})
		other_course_doc.save()

		doc = frappe.get_doc("LMS Assignment Submission", self.submission.name)
		doc.assignment = other_assignment.name
		self.assertFalse(assessment_submission_has_permission(doc, "write", stranger.name))
