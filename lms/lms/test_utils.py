import ast
import unittest
from pathlib import Path

import frappe
from frappe.utils import getdate

from lms.lms.doctype.lms_course.test_lms_course import new_course, new_user

from .utils import get_evaluation_details, is_onboarding_complete, slugify


class TestUtils(unittest.TestCase):
	def test_razorpay_is_not_imported_at_module_level(self):
		"""This module is loaded by the User override on every session."""
		tree = ast.parse(Path(__file__).with_name("utils.py").read_text())
		imported = []
		for node in tree.body:
			if isinstance(node, ast.Import):
				imported += [alias.name.split(".")[0] for alias in node.names]
			elif isinstance(node, ast.ImportFrom) and node.module:
				imported.append(node.module.split(".")[0])

		self.assertNotIn("razorpay", imported)

	def test_onboarding_status_does_not_write_while_rendering(self):
		"""Templates call this during page render, where writes raise PermissionError."""
		frappe.db.set_single_value("LMS Settings", "is_onboarding_complete", 0)
		course = new_course("Test Onboarding Status")
		chapter = frappe.get_doc(
			{"doctype": "Course Chapter", "title": "Chapter", "course": course.name}
		).insert()
		frappe.get_doc(
			{
				"doctype": "Course Lesson",
				"title": "Lesson",
				"chapter": chapter.name,
				"course": course.name,
				"body": "Lesson body",
			}
		).insert()

		frappe.local.flags.in_render_safe_exec = True
		try:
			status = is_onboarding_complete()
		finally:
			frappe.local.flags.in_render_safe_exec = False

		self.assertTrue(status["course_created"])
		self.assertTrue(status["is_onboarded"])

	def test_simple(self):
		self.assertEqual(slugify("hello-world"), "hello-world")
		self.assertEqual(slugify("Hello World"), "hello-world")
		self.assertEqual(slugify("Hello, World!"), "hello-world")

	def test_duplicates(self):
		self.assertEqual(slugify("Hello World", ["hello-world"]), "hello-world-2")

		self.assertEqual(
			slugify("Hello World", ["hello-world", "hello-world-2"]), "hello-world-3"
		)

	def test_evaluation_details(self):
		course = new_course(
			"Test Evaluation Details",
			{
				"enable_certification": 1,
				"grant_certificate_after": "Evaluation",
				"evaluator": "evaluator@example.com",
				"max_attempts": 3,
				"duration": 2,
			},
		)
		user = new_user("Eval", "eval@test.com")

		# Two evaluations failed within max attempts. Check eligibility for a third evaluation
		create_evaluation(user.name, course.name, getdate("21-03-2022"), 0.4, "Fail")
		create_evaluation(user.name, course.name, getdate("12-04-2022"), 0.4, "Fail")
		details = get_evaluation_details(course.name, user.name)
		self.assertTrue(details.eligible)

		# Three evaluations failed within max attempts. Check eligibility for a forth evaluation
		create_evaluation(user.name, course.name, getdate("21-03-2022"), 0.4, "Fail")
		create_evaluation(user.name, course.name, getdate("12-04-2022"), 0.4, "Fail")
		create_evaluation(user.name, course.name, getdate("16-04-2022"), 0.4, "Fail")
		details = get_evaluation_details(course.name, user.name)
		self.assertFalse(details.eligible)

		# Three evaluations failed within max attempts. Check eligibility for a forth evaluation. Different Dates
		create_evaluation(user.name, course.name, getdate("01-03-2022"), 0.4, "Fail")
		create_evaluation(user.name, course.name, getdate("12-04-2022"), 0.4, "Fail")
		create_evaluation(user.name, course.name, getdate("16-04-2022"), 0.4, "Fail")
		details = get_evaluation_details(course.name, user.name)
		self.assertFalse(details.eligible)

		frappe.db.delete("LMS Certificate Evaluation", {"course": course.name})
		frappe.db.delete("LMS Course", course.name)
		frappe.db.delete("User", user.name)


def create_evaluation(user, course, date, rating, status):
	evaluation = frappe.get_doc(
		{
			"doctype": "LMS Certificate Evaluation",
			"member": user,
			"course": course,
			"date": date,
			"start_time": "12:00:00",
			"end_time": "13:00:00",
			"rating": rating,
			"status": status,
		}
	)
	evaluation.save()
