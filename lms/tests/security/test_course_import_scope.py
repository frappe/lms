# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Regressions from #2286 (a4a0a76ad): a Course Creator's course archive created users and a
Course Evaluator (granting Batch Evaluator) and added test cases to any exercise.
Added for audit findings #2 and #23 on branch fix/course-import-scope."""

import json
import os
import zipfile

import frappe

from lms.lms.api import import_course_from_zip
from lms.lms.test_helpers import BaseTestUtils


class TestCourseImportScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = frappe.generate_hash(length=6).lower()
		cls.course_creator = cls._create_user(
			f"cis-cc-{cls.hash}@example.com", "Course", "Creator", ["Course Creator"]
		).name
		cls.exercise_author = cls._create_user(
			f"cis-author-{cls.hash}@example.com", "Exercise", "Author", ["Course Creator"]
		).name
		cls.moderator = cls._create_user(
			f"cis-mod-{cls.hash}@example.com", "Mod", "Erator", ["Moderator", "LMS Student"]
		).name
		cls.student = cls._create_user(
			f"cis-student-{cls.hash}@example.com", "Stu", "Dent", ["LMS Student"]
		).name

	def _victim_exercise(self):
		frappe.set_user(self.exercise_author)
		exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": f"Victim Exercise {frappe.generate_hash(length=6)}",
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [{"input": "2 3", "expected_output": "5"}],
			}
		).insert()
		frappe.set_user("Administrator")
		return exercise

	def _archive(
		self, instructor=None, evaluator=None, test_case_parent=None, exercise=None, evaluator_fields=None
	):
		tag = frappe.generate_hash(length=6).lower()
		instructor = instructor or self.course_creator
		instructors = [{"instructor": instructor}]
		course = {
			"title": f"Imported Scope Course {tag}",
			"short_introduction": "x",
			"description": "x",
			"instructors": instructors,
		}
		if evaluator:
			course["evaluator"] = evaluator
		path = frappe.get_site_path("private", "files", f"import-scope-{tag}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr("course.json", json.dumps(course))
			zf.writestr(
				"instructors.json",
				json.dumps([{"name": instructor, "email": instructor, "first_name": "New"}]),
			)
			if evaluator:
				zf.writestr(
					"evaluator.json",
					json.dumps(
						{
							"doctype": "Course Evaluator",
							"name": evaluator,
							"evaluator": evaluator,
							**(evaluator_fields or {}),
						}
					),
				)
			if test_case_parent:
				zf.writestr(
					f"assessments/test_cases/tc-{tag}.json",
					json.dumps(
						{
							"doctype": "LMS Test Case",
							"parent": test_case_parent,
							"parenttype": "LMS Programming Exercise",
							"parentfield": "test_cases",
							"input": "1 1",
							"expected_output": "999",
						}
					),
				)
			if exercise:
				zf.writestr(
					f"assessments/lms_programming_exercise_{exercise['name']}.json", json.dumps(exercise)
				)
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
		return f"/private/files/{os.path.basename(path)}"

	def _import_as(self, user, zip_path):
		frappe.set_user(user)
		try:
			upload = frappe.get_doc(
				{
					"doctype": "File",
					"file_url": zip_path,
					"file_name": os.path.basename(zip_path),
					"is_private": 1,
				}
			).insert(ignore_permissions=True)
			return import_course_from_zip(upload.file_url)
		finally:
			frappe.set_user("Administrator")

	def _new_email(self):
		return f"cis-new-{frappe.generate_hash(length=6).lower()}@example.com"

	def _instructors(self, course):
		return frappe.get_all("Course Instructor", {"parent": course}, pluck="instructor")

	def _is_batch_evaluator(self, user):
		return bool(frappe.db.exists("Has Role", {"parent": user, "role": "Batch Evaluator"}))

	def test_a_course_creator_import_cannot_grant_batch_evaluator(self):
		course = self._import_as(self.course_creator, self._archive(evaluator=self.student))

		self.assertFalse(self._is_batch_evaluator(self.student))
		self.assertFalse(frappe.db.exists("Course Evaluator", self.student))
		self.assertFalse(frappe.db.get_value("LMS Course", course, "evaluator"))

	def test_a_course_creator_import_creates_no_users(self):
		new_instructor = self._new_email()
		course = self._import_as(self.course_creator, self._archive(instructor=new_instructor))

		self.assertFalse(frappe.db.exists("User", new_instructor))
		self.assertEqual(self._instructors(course), [self.course_creator])

	def test_a_course_creator_import_keeps_existing_instructors(self):
		course = self._import_as(self.course_creator, self._archive(instructor=self.exercise_author))

		self.assertCountEqual(self._instructors(course), [self.exercise_author, self.course_creator])

	def test_a_course_creator_import_cannot_add_test_cases_to_another_authors_exercise(self):
		victim = self._victim_exercise()

		self._import_as(self.course_creator, self._archive(test_case_parent=victim.name))

		cases = frappe.get_all("LMS Test Case", {"parent": victim.name}, pluck="expected_output")
		self.assertEqual(cases, ["5"])

	def test_an_imported_exercise_carries_each_test_case_once(self):
		name = f"cis-ex-{frappe.generate_hash(length=6).lower()}"
		exercise = {
			"doctype": "LMS Programming Exercise",
			"name": name,
			"title": name,
			"language": "Python",
			"problem_statement": "<p>Add two integers.</p>",
			"test_cases": [{"input": "2 3", "expected_output": "5"}],
		}

		self._import_as(self.course_creator, self._archive(test_case_parent=name, exercise=exercise))

		cases = frappe.get_all("LMS Test Case", {"parent": name}, pluck="expected_output")
		self.assertEqual(cases, ["5"])

	def test_a_moderator_import_creates_instructors_and_the_evaluator(self):
		new_instructor = self._new_email()
		course = self._import_as(
			self.moderator, self._archive(instructor=new_instructor, evaluator=self.student)
		)

		self.assertTrue(frappe.db.exists("User", new_instructor))
		self.assertIn(new_instructor, self._instructors(course))
		self.assertTrue(frappe.db.exists("Course Evaluator", self.student))
		self.assertTrue(self._is_batch_evaluator(self.student))
		self.assertEqual(frappe.db.get_value("LMS Course", course, "evaluator"), self.student)

	def test_a_moderator_import_skips_an_existing_evaluator(self):
		"""An archived evaluator that already exists is skipped, so its bad schedule can't abort the import."""
		frappe.get_doc({"doctype": "Course Evaluator", "evaluator": self.student}).insert(
			ignore_if_duplicate=True
		)
		archive = self._archive(
			evaluator=self.student,
			evaluator_fields={"unavailable_from": "2026-02-01", "unavailable_to": "2026-01-01"},
		)

		course = self._import_as(self.moderator, archive)

		self.assertEqual(frappe.db.get_value("LMS Course", course, "evaluator"), self.student)
		self.assertFalse(frappe.db.get_value("Course Evaluator", self.student, "unavailable_from"))
