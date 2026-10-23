# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.permissions import can_access_assessment
from lms.lms.test_helpers import BaseTestUtils


class BatchFixtures(BaseTestUtils):
	@classmethod
	def _make_batch(cls, title, course, evaluator, published=1, instructor=None):
		batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": title,
				"start_date": nowdate(),
				"end_date": add_days(nowdate(), 10),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"published": published,
				"description": f"A batch for {title}",
				"batch_details": f"Details of {title}",
				"instructors": [{"instructor": instructor or cls.instructor.name}],
				"courses": [{"course": course, "evaluator": evaluator}],
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - fixture setup as Administrator; the batch gate is what the tests measure afterwards
		batch.insert(ignore_permissions=True)
		return batch

	def _listed(self, doctype, user):
		frappe.set_user(user)
		try:
			return set(frappe.get_list(doctype, pluck="name", limit_page_length=0))
		finally:
			frappe.set_user("Administrator")


class TestBatchCourseEvaluatorQuizScope(BatchFixtures):
	"""The evaluator on Batch Course (B, C) reaches the quizzes C's lessons place,
	and the submissions of those quizzes by B's students only."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"bce-instr-{suffix}@example.com", "Ivo", "Instructor", ["Course Creator", "Batch Evaluator"]
		)
		cls.evaluator = cls._create_user(f"bce-eval-{suffix}@example.com", "Eve", "Eval", ["Batch Evaluator"])
		cls.other_evaluator = cls._create_user(
			f"bce-other-{suffix}@example.com", "Oli", "Other", ["Batch Evaluator"]
		)
		cls.bystander = cls._create_user(f"bce-role-{suffix}@example.com", "Rob", "Role", ["Batch Evaluator"])
		cls._require_no_moderators(cls.evaluator.name, cls.other_evaluator.name, cls.bystander.name)
		cls._create_evaluator(cls.evaluator.name)
		cls._create_evaluator(cls.other_evaluator.name)

		cls.course = cls._create_course(title=f"BCE Course {suffix}", instructor=cls.instructor.name)
		questions = cls._create_quiz_questions()
		cls.quiz = cls._create_quiz(questions, title=f"BCE Quiz {suffix}")
		cls.hidden_quiz = cls._create_quiz(questions, title=f"BCE Hidden Quiz {suffix}")
		cls._place_in_lesson(cls.course.name, "LMS Quiz", cls.quiz.name)
		cls._place_in_lesson(cls.course.name, "LMS Quiz", cls.hidden_quiz.name, instructor_only=True)

		cls.batch = cls._make_batch(f"BCE Batch {suffix}", cls.course.name, cls.evaluator.name)
		cls.other_batch = cls._make_batch(f"BCE Other {suffix}", cls.course.name, cls.other_evaluator.name)

		cls.student = cls._create_user(f"bce-s1-{suffix}@example.com", "Sam", "InBatch", ["LMS Student"])
		cls.course_only = cls._create_user(
			f"bce-s2-{suffix}@example.com", "Cai", "CourseOnly", ["LMS Student"]
		)
		cls.other_student = cls._create_user(
			f"bce-s3-{suffix}@example.com", "Ola", "OtherBatch", ["LMS Student"]
		)
		cls._create_batch_enrollment(cls.student.name, cls.batch.name)
		cls._create_enrollment(cls.course_only.name, cls.course.name)
		cls._create_batch_enrollment(cls.other_student.name, cls.other_batch.name)

		cls.mine = cls._submit(cls.student.name)
		cls.not_in_batch = cls._submit(cls.course_only.name)
		cls.other_batch_sub = cls._submit(cls.other_student.name)

	@classmethod
	def _submit(cls, member):
		# nosemgrep: lms-unjustified-ignore-permissions - fixture setup as Administrator; the submission gate is what the tests measure afterwards
		return frappe.get_doc(
			{
				"doctype": "LMS Quiz Submission",
				"quiz": cls.quiz.name,
				"member": member,
				"score": 1,
				"score_out_of": 1,
				"percentage": 100,
				"passing_percentage": 70,
			}
		).insert(ignore_permissions=True)

	def test_the_evaluator_reads_a_quiz_placed_in_the_course_they_evaluate(self):
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.evaluator.name))
		self.assertIn(self.quiz.name, self._listed("LMS Quiz", self.evaluator.name))

	def test_an_instructor_only_placement_stays_hidden(self):
		self.assertFalse(can_access_assessment("LMS Quiz", self.hidden_quiz.name, user=self.evaluator.name))
		self.assertNotIn(self.hidden_quiz.name, self._listed("LMS Quiz", self.evaluator.name))

	def test_the_role_alone_reaches_no_quiz(self):
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.bystander.name))
		self.assertNotIn(self.quiz.name, self._listed("LMS Quiz", self.bystander.name))

	def test_the_evaluator_reads_only_their_batch_students_submissions(self):
		read = {
			sub.name
			for sub in (self.mine, self.not_in_batch, self.other_batch_sub)
			if frappe.has_permission("LMS Quiz Submission", "read", sub, user=self.evaluator.name)
		}
		self.assertEqual(read, {self.mine.name})

	def test_the_list_matches_the_doc_check_for_every_caller(self):
		subs = (self.mine, self.not_in_batch, self.other_batch_sub)
		for user in (self.evaluator.name, self.other_evaluator.name, self.bystander.name):
			listed = self._listed("LMS Quiz Submission", user)
			for sub in subs:
				with self.subTest(user=user, submission=sub.member):
					self.assertEqual(
						frappe.has_permission("LMS Quiz Submission", "read", sub, user=user),
						sub.name in listed,
					)

	def test_the_other_batch_evaluator_reads_only_their_own_student(self):
		self.assertTrue(
			frappe.has_permission(
				"LMS Quiz Submission", "read", self.other_batch_sub, user=self.other_evaluator.name
			)
		)
		self.assertFalse(
			frappe.has_permission("LMS Quiz Submission", "read", self.mine, user=self.other_evaluator.name)
		)
