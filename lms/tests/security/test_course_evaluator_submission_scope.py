# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestCourseEvaluatorSubmissionScope(BaseTestUtils):
	"""The evaluator of a paid-certificate course reads the submissions its
	enrolled students make on assessments the course's lessons place, with no
	batch in between."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"ces-instr-{suffix}@example.com", "Ivo", "Instructor", ["Course Creator"]
		)
		cls.evaluator = cls._create_user(f"ces-eval-{suffix}@example.com", "Eve", "Eval", ["Batch Evaluator"])
		cls.lapsed = cls._create_user(
			f"ces-lapsed-{suffix}@example.com", "Lin", "Lapsed", ["Batch Evaluator"]
		)
		cls.bystander = cls._create_user(f"ces-role-{suffix}@example.com", "Rob", "Role", ["Batch Evaluator"])
		cls._require_no_moderators(cls.evaluator.name, cls.lapsed.name, cls.bystander.name)
		for user in (cls.evaluator, cls.lapsed, cls.bystander):
			cls._create_evaluator(user.name)

		cls.course = cls._course(f"CES Course {suffix}", cls.evaluator.name, paid_certificate=1)
		cls.unpaid_course = cls._course(f"CES Unpaid {suffix}", cls.lapsed.name, paid_certificate=0)
		cls.other_course = cls._course(f"CES Other {suffix}", cls.bystander.name, paid_certificate=1)

		cls.assignment = cls._create_assignment(title=f"CES Assignment {suffix}")
		cls.hidden_assignment = cls._create_assignment(title=f"CES Hidden {suffix}")
		cls._place_in_lesson(cls.course.name, "LMS Assignment", cls.assignment.name)
		cls._place_in_lesson(cls.unpaid_course.name, "LMS Assignment", cls.assignment.name)
		cls._place_in_lesson(
			cls.course.name, "LMS Assignment", cls.hidden_assignment.name, instructor_only=True
		)

		cls.student = cls._create_user(f"ces-s1-{suffix}@example.com", "Sam", "Enrolled", ["LMS Student"])
		cls.outsider = cls._create_user(f"ces-s2-{suffix}@example.com", "Oli", "Outsider", ["LMS Student"])
		cls._create_enrollment(cls.student.name, cls.course.name)
		cls._create_enrollment(cls.student.name, cls.unpaid_course.name)
		cls._create_enrollment(cls.outsider.name, cls.other_course.name)

		cls.enrolled_sub = cls._submit(cls.assignment.name, cls.student.name)
		cls.outsider_sub = cls._submit(cls.assignment.name, cls.outsider.name)
		cls.hidden_sub = cls._submit(cls.hidden_assignment.name, cls.student.name)

	@classmethod
	def _course(cls, title, evaluator, paid_certificate):
		course = cls._create_course(title=title, instructor=cls.instructor.name)
		# Set directly: a paid certificate's price and timezone validation is not what is measured.
		frappe.db.set_value(
			"LMS Course", course.name, {"paid_certificate": paid_certificate, "evaluator": evaluator}
		)
		return course

	@classmethod
	def _submit(cls, assignment, member):
		# nosemgrep: lms-unjustified-ignore-permissions - fixture setup as Administrator; the submission gate is what the tests measure afterwards
		return frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": assignment,
				"member": member,
				"answer": "An answer.",
				"status": "Not Graded",
			}
		).insert(ignore_permissions=True)

	def _listed(self, user):
		frappe.set_user(user)
		try:
			return set(frappe.get_list("LMS Assignment Submission", pluck="name", limit_page_length=0))
		finally:
			frappe.set_user("Administrator")

	def _reads(self, sub, user):
		return frappe.has_permission("LMS Assignment Submission", "read", sub, user=user)

	def test_the_course_evaluator_reads_an_enrolled_students_submission(self):
		self.assertTrue(self._reads(self.enrolled_sub, self.evaluator.name))
		self.assertIn(self.enrolled_sub.name, self._listed(self.evaluator.name))

	def test_the_course_evaluator_can_grade_it(self):
		self.assertTrue(
			frappe.has_permission(
				"LMS Assignment Submission", "write", self.enrolled_sub, user=self.evaluator.name
			)
		)

	def test_a_student_outside_the_course_stays_hidden(self):
		self.assertFalse(self._reads(self.outsider_sub, self.evaluator.name))
		self.assertNotIn(self.outsider_sub.name, self._listed(self.evaluator.name))

	def test_an_instructor_only_placement_stays_hidden(self):
		self.assertFalse(self._reads(self.hidden_sub, self.evaluator.name))
		self.assertNotIn(self.hidden_sub.name, self._listed(self.evaluator.name))

	def test_an_evaluator_left_on_a_course_without_paid_certificate_reaches_nothing(self):
		self.assertFalse(self._reads(self.enrolled_sub, self.lapsed.name))
		self.assertNotIn(self.enrolled_sub.name, self._listed(self.lapsed.name))

	def test_the_course_evaluator_opens_the_assignment_the_submission_answers(self):
		"""The submission screen loads the assignment through get_assignment first,
		so a submission the evaluator may read but whose assignment they may not
		renders nothing."""
		from lms.lms.utils import get_assignment

		frappe.set_user(self.evaluator.name)
		try:
			self.assertEqual(get_assignment(self.assignment.name)["name"], self.assignment.name)
			with self.assertRaises(frappe.PermissionError):
				get_assignment(self.hidden_assignment.name)
		finally:
			frappe.set_user("Administrator")

		self.assertFalse(
			frappe.has_permission("LMS Assignment", "read", self.assignment.name, user=self.bystander.name)
		)
		self.assertFalse(
			frappe.has_permission("LMS Assignment", "write", self.assignment.name, user=self.evaluator.name)
		)

	def test_the_list_matches_the_doc_check_for_every_caller(self):
		subs = (self.enrolled_sub, self.outsider_sub, self.hidden_sub)
		for user in (self.evaluator.name, self.lapsed.name, self.bystander.name):
			listed = self._listed(user)
			for sub in subs:
				with self.subTest(user=user, submission=sub.name):
					self.assertEqual(self._reads(sub, user), sub.name in listed)
