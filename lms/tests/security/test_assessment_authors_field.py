# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
import frappe.client

from lms.lms.api import get_assessment_authors
from lms.lms.permissions import stored_authors
from lms.lms.test_helpers import BaseTestUtils


class TestAssessmentAuthorsField(BaseTestUtils):
	"""Who may change an assessment's `authors` through frappe.client.set_value,
	the call the SPA's authors picker makes."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		self.author = self._create_user(f"aaf-a-{suffix}@example.com", "Ann", "Author", ["Course Creator"])
		self.co_author = self._create_user(
			f"aaf-c-{suffix}@example.com", "Cal", "Coauthor", ["Course Creator"]
		)
		self.placer = self._create_user(f"aaf-p-{suffix}@example.com", "Pat", "Placer", ["Course Creator"])
		self.moderator = self._create_user(f"aaf-m-{suffix}@example.com", "Mo", "Derator", ["Moderator"])
		roles = set(frappe.get_roles(self.placer.name))
		self.assertIn("Course Creator", roles)
		self.assertFalse(roles & {"Moderator", "System Manager"})

		self.assessments = {
			"LMS Quiz": self._create_quiz(self._create_quiz_questions(), title=f"AAF Quiz {suffix}").name,
			"LMS Assignment": self._create_assignment(title=f"AAF Assignment {suffix}").name,
			"LMS Programming Exercise": self._create_programming_exercise(
				title=f"AAF Exercise {suffix}"
			).name,
		}
		placer_course = self._create_course(f"AAF Placer Course {suffix}", instructor=self.placer.name)
		for doctype, name in self.assessments.items():
			self._set_authors(doctype, name, [self.author.name])
			self._place_in_lesson(placer_course.name, doctype, name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _set_authors_as(self, user, doctype, name, authors):
		frappe.set_user(user)
		try:
			frappe.client.set_value(doctype, name, "authors", [{"author": a} for a in authors])
		finally:
			frappe.set_user("Administrator")

	def test_an_instructor_of_a_placing_course_cannot_add_themselves(self):
		"""Guards #2780's author-only writes against frappe.client.set_value."""
		for doctype, name in self.assessments.items():
			with self.subTest(doctype=doctype):
				with self.assertRaises(frappe.PermissionError):
					self._set_authors_as(
						self.placer.name, doctype, name, [self.author.name, self.placer.name]
					)
				self.assertEqual(stored_authors(doctype, name), [self.author.name])

	def test_an_author_adds_a_co_author(self):
		"""Control for the refusal above (#2780)."""
		for doctype, name in self.assessments.items():
			with self.subTest(doctype=doctype):
				self._set_authors_as(self.author.name, doctype, name, [self.author.name, self.co_author.name])
				self.assertCountEqual(stored_authors(doctype, name), [self.author.name, self.co_author.name])

	def test_a_moderator_reassigns_the_authors(self):
		"""Control for the refusal above (#2780)."""
		for doctype, name in self.assessments.items():
			with self.subTest(doctype=doctype):
				self._set_authors_as(self.moderator.name, doctype, name, [self.co_author.name])
				self.assertEqual(stored_authors(doctype, name), [self.co_author.name])


class TestGetAssessmentAuthors(BaseTestUtils):
	"""The read the submission screens and the authors picker make."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		self.author = self._create_user(f"gaa-a-{suffix}@example.com", "Ann", "Author", ["Course Creator"])
		self.placer = self._create_user(f"gaa-p-{suffix}@example.com", "Pat", "Placer", ["Course Creator"])
		self.bystander = self._create_user(
			f"gaa-b-{suffix}@example.com", "Bo", "Bystander", ["Course Creator"]
		)
		self.moderator = self._create_user(f"gaa-m-{suffix}@example.com", "Mo", "Derator", ["Moderator"])
		self.student = self._create_user(f"gaa-s-{suffix}@example.com", "Sal", "Student", ["LMS Student"])
		self.quiz = self._create_quiz(self._create_quiz_questions(), title=f"GAA Quiz {suffix}").name
		self._set_authors("LMS Quiz", self.quiz, [self.author.name])
		course = self._create_course(f"GAA Placer Course {suffix}", instructor=self.placer.name)
		self._place_in_lesson(course.name, "LMS Quiz", self.quiz)
		self._create_enrollment(self.student.name, course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _read_as(self, user, doctype="LMS Quiz", name=None):
		frappe.set_user(user)
		try:
			return get_assessment_authors(doctype, name or self.quiz)
		finally:
			frappe.set_user("Administrator")

	def test_a_reviewer_of_a_placing_course_sees_the_authors_but_cannot_edit_them(self):
		result = self._read_as(self.placer.name)
		self.assertEqual(
			result["authors"],
			[{"name": self.author.name, "full_name": "Ann Author", "user_image": None}],
		)
		self.assertFalse(result["can_edit"])

	def test_an_author_and_a_moderator_may_edit(self):
		for user in (self.author.name, self.moderator.name):
			with self.subTest(user=user):
				self.assertTrue(self._read_as(user)["can_edit"])

	def test_a_row_with_no_authors_answers_with_its_owner(self):
		self._set_authors("LMS Quiz", self.quiz, [])
		frappe.db.set_value("LMS Quiz", self.quiz, "owner", self.author.name)
		result = self._read_as(self.author.name)
		self.assertEqual([a["name"] for a in result["authors"]], [self.author.name])
		self.assertTrue(result["can_edit"])

	def test_a_course_creator_who_cannot_read_the_assessment_is_refused(self):
		with self.assertRaises(frappe.PermissionError):
			self._read_as(self.bystander.name)

	def test_a_student_is_refused_even_where_they_can_read_the_quiz(self):
		with self.assertRaises(frappe.PermissionError):
			self._read_as(self.student.name)

	def test_a_doctype_that_is_not_an_assessment_is_refused(self):
		for doctype in ("User", "LMS Question", ["LMS Quiz"]):
			with self.subTest(doctype=doctype):
				with self.assertRaises((frappe.ValidationError, frappe.FrappeTypeError)):
					self._read_as(self.moderator.name, doctype=doctype)

	def test_a_name_that_is_not_a_string_is_refused(self):
		with self.assertRaises((frappe.ValidationError, frappe.FrappeTypeError)):
			self._read_as(self.moderator.name, name=["like", "%"])
