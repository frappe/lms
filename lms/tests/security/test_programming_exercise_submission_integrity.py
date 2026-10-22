from unittest.mock import patch

import frappe

from lms.lms.api import create_programming_exercise_submission
from lms.lms.test_helpers import BaseTestUtils

SUBMISSION = "LMS Programming Exercise Submission"


# Guards a programming exercise result against being written anywhere but the
# endpoint that runs the code.
class TestProgrammingExerciseSubmissionIntegrity(BaseTestUtils):
	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": f"Integrity {hash}",
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [{"input": "2 3", "expected_output": "5", "hidden": 0}],
			}
		).insert()
		self.instructor = self._create_user(
			f"pei-instr-{hash}@example.com", "Ivy", "Instr", ["Course Creator"]
		).name
		self.moderator = self._create_user(f"pei-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		self.student = self._create_user(f"pei-stud-{hash}@example.com", "Stu", "Dent", ["LMS Student"]).name
		self.victim = self._create_user(f"pei-vic-{hash}@example.com", "Vic", "Tim", ["LMS Student"]).name
		self._require_no_moderators(self.instructor, self.student, self.victim)

		course = self._create_course(f"Integrity Course {hash}", instructor=self.instructor).name
		self._place_in_lesson(course, "LMS Programming Exercise", self.exercise.name)
		self._create_enrollment(self.student, course)
		self._create_enrollment(self.victim, course)

	def _as(self, user, fn):
		frappe.set_user(user)
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	def _post(self, **fields):
		"""What POST /api/resource does with the request body."""
		data = {"exercise": self.exercise.name, "code": "print(5)", "status": "Passed", **fields}
		return frappe.new_doc(SUBMISSION, **data).insert()

	def _save_through_endpoint(self, output):
		with patch("lms.lms.api.run_test_cases", return_value=[output]):
			return self._as(
				self.student,
				lambda: create_programming_exercise_submission(self.exercise.name, "new", "print(input())"),
			)

	def test_a_learner_cannot_post_a_result_directly(self):
		for member in ("student", "victim"):
			with self.subTest(member=member):
				before = frappe.db.count(SUBMISSION, {"exercise": self.exercise.name})
				with self.assertRaises(frappe.PermissionError):
					self._as(self.student, lambda: self._post(member=getattr(self, member)))
				self.assertEqual(frappe.db.count(SUBMISSION, {"exercise": self.exercise.name}), before)

	def test_request_flags_cannot_pass_as_server_grading(self):
		with self.assertRaises(frappe.PermissionError):
			self._as(
				self.student,
				lambda: self._post(member=self.student, flags={"graded_on_server": True}),
			)

	def test_a_learner_cannot_rewrite_the_status_of_their_own_row(self):
		name = self._save_through_endpoint("4")
		self.assertEqual(frappe.db.get_value(SUBMISSION, name, "status"), "Failed")

		def flip():
			doc = frappe.get_doc(SUBMISSION, name)
			doc.status = "Passed"
			doc.save()

		with self.assertRaises(frappe.PermissionError):
			self._as(self.student, flip)
		self.assertEqual(frappe.db.get_value(SUBMISSION, name, "status"), "Failed")

	def test_the_endpoint_still_records_the_servers_result(self):
		name = self._save_through_endpoint("5")
		row = frappe.db.get_value(SUBMISSION, name, ["member", "status"], as_dict=True)
		self.assertEqual((row.member, row.status), (self.student, "Passed"))

	def test_the_courses_instructor_may_edit_a_learners_row(self):
		name = self._save_through_endpoint("4")

		def override():
			doc = frappe.get_doc(SUBMISSION, name)
			doc.status = "Passed"
			doc.save()

		self._as(self.instructor, override)
		self.assertEqual(frappe.db.get_value(SUBMISSION, name, "status"), "Passed")

	def test_a_moderator_may_create_a_row_directly(self):
		doc = self._as(self.moderator, lambda: self._post(member=self.victim))
		self.assertEqual(doc.member, self.victim)
