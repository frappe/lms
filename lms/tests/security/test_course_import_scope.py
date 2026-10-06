# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A course archive cannot reach past the course it creates.

The import inserts with ignore_permissions, so whatever the archive names is
written as-is. A Course Creator's archive must not create users or a Course
Evaluator (which grants Batch Evaluator). A Moderator's archive still creates
instructors and the evaluator.
"""

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

	def _archive(self, instructor=None, evaluator=None, test_case_parent=None, exercise=None):
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
					json.dumps({"doctype": "Course Evaluator", "name": evaluator, "evaluator": evaluator}),
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
