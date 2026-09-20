# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""Ticket 73298: the quiz payload must not carry the answer key to a learner.

`get_quiz_with_questions` is gated by `can_access_quiz`, but it returned
`explanation_1..10` alongside the options. Authors normally write an explanation
only on the correct option, so the mere presence of `explanation_N` named the
answer -- before the learner had answered anything, and regardless of
`show_answers`.
"""

import frappe

from lms.lms.doctype.lms_question.lms_question import QUESTION_EXPLANATION_FIELDS
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_quiz_with_questions

EXPLANATION = "Because two plus two equals four."


class TestQuizAnswerDisclosure(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)

		cls.moderator = cls._create_user(f"qad-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		cls.author = cls._create_user(f"qad-auth-{hash}@example.com", "Ann", "Author", ["Course Creator"])
		cls.student = cls._create_user(f"qad-stud-{hash}@example.com", "Sam", "Stud", ["LMS Student"])

		cls.course = cls._create_course(title=f"Answer Disclosure Course {hash}", instructor=cls.author.name)
		cls._create_enrollment(cls.student.name, cls.course.name)

		# The authoring pattern that leaks: one explanation, on the correct option.
		cls.question = frappe.new_doc("LMS Question")
		cls.question.update(
			{
				"question": f"What is 2+2? {hash}",
				"type": "Choices",
				"option_1": "Three",
				"is_correct_1": 0,
				"option_2": "Four",
				"is_correct_2": 1,
				"explanation_2": EXPLANATION,
			}
		)
		cls.question.save()

		cls.quiz = frappe.new_doc("LMS Quiz")
		cls.quiz.update(
			{
				"title": f"Answer Disclosure Quiz {hash}",
				"passing_percentage": 70,
				"show_answers": 0,
				"enable_scheduling": 0,
			}
		)
		cls.quiz.append("questions", {"question": cls.question.name, "marks": 5})
		cls.quiz.save()

		# Link the quiz to the course the way an embedded lesson would, without a
		# Course Lesson: `can_access_quiz` reads LMS Quiz.course.
		frappe.db.set_value("LMS Quiz", cls.quiz.name, "course", cls.course.name)
		frappe.clear_document_cache("LMS Quiz", cls.quiz.name)

	def _row(self, user):
		frappe.set_user(user)
		try:
			payload = get_quiz_with_questions(self.quiz.name)
		finally:
			frappe.set_user("Administrator")
		return payload["questions_by_name"][self.question.name]

	def _submit(self, member):
		submission = frappe.new_doc("LMS Quiz Submission")
		submission.update(
			{
				"quiz": self.quiz.name,
				"member": member,
				"score": 5,
				"score_out_of": 5,
				"percentage": 100,
				"passing_percentage": 70,
			}
		)
		# Fixture setup: seeding a prior submission is the precondition under test,
		# not the thing being tested. The entitlement rule is exercised separately.
		# nosemgrep: lms-unjustified-ignore-permissions
		submission.insert(ignore_permissions=True)
		return submission

	def _set_show_answers(self, value):
		frappe.db.set_value("LMS Quiz", self.quiz.name, "show_answers", value)
		frappe.clear_document_cache("LMS Quiz", self.quiz.name)

	# -- the leak ---------------------------------------------------------

	def test_learner_who_has_not_submitted_gets_no_explanations(self):
		self.assertNotIn("Moderator", frappe.get_roles(self.student.name))
		self.assertNotIn("Course Creator", frappe.get_roles(self.student.name))
		self.assertFalse(
			frappe.db.exists("LMS Quiz Submission", {"quiz": self.quiz.name, "member": self.student.name})
		)

		row = self._row(self.student.name)
		self.assertEqual(
			[field for field in QUESTION_EXPLANATION_FIELDS if row.get(field)],
			[],
			"an explanation written only on the correct option names the answer",
		)
		self.assertEqual([key for key in row if key.startswith("explanation_")], [])

	def test_correctness_flags_stay_out_of_the_learner_payload(self):
		row = self._row(self.student.name)
		self.assertEqual([key for key in row if key.startswith("is_correct_")], [])
		# The control: the answer this payload must not give away.
		self.assertEqual(frappe.db.get_value("LMS Question", self.question.name, "is_correct_2"), 1)

	# -- no regression ----------------------------------------------------

	def test_learner_who_has_submitted_still_gets_explanations(self):
		self._submit(self.student.name)
		row = self._row(self.student.name)
		self.assertEqual(row.get("explanation_2"), EXPLANATION)

	def test_privileged_users_still_get_explanations(self):
		for case, user in (("moderator", self.moderator.name), ("course_creator", self.author.name)):
			with self.subTest(case=case):
				self.assertTrue(
					{"Moderator", "Course Creator"} & set(frappe.get_roles(user)),
					"this case is only meaningful for a privileged role",
				)
				self.assertEqual(self._row(user).get("explanation_2"), EXPLANATION)

	def test_show_answers_quiz_still_ships_explanations_to_a_fresh_learner(self):
		"""Quiz.vue renders these right after check_answer and never refetches."""
		self._set_show_answers(1)
		row = self._row(self.student.name)
		self.assertEqual(row.get("explanation_2"), EXPLANATION)
