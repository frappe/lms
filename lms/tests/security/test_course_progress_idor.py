import json
import unittest

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestCourseProgressPermissionJSON(unittest.TestCase):
	def test_lms_student_role_json_grants_no_create(self):
		# Defense-in-depth: the doctype JSON must not grant LMS Student create (syncs to
		# the DB permission layer on migrate). Read from disk to avoid mutating the site.
		path = frappe.get_app_path("lms", "lms", "doctype", "lms_course_progress", "lms_course_progress.json")
		with open(path) as f:
			perms = json.load(f)["permissions"]
		student = next(p for p in perms if p["role"] == "LMS Student")
		self.assertNotEqual(student.get("create"), 1)


class TestCourseProgressIDOR(BaseTestUtils):
	"""A student must not be able to record progress for another member."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.attacker = cls._create_user(f"atk-{hash}@example.com", "At", "Tacker", ["LMS Student"])
		cls.victim = cls._create_user(f"vic-{hash}@example.com", "Vic", "Tim", ["LMS Student"])
		cls.instructor = cls._create_user(
			f"pinstr-{hash}@example.com", "Pat", "Instr", ["Course Creator", "Moderator"]
		)
		cls.course = cls._create_course(title=f"Progress Course {hash}", instructor=cls.instructor.email)
		cls.chapter = cls._create_chapter(f"PChapter {hash}", cls.course.name)
		cls.lesson = cls._create_lesson(f"PLesson {hash}", cls.chapter.name, cls.course.name)

	def test_student_cannot_insert_progress_for_another_member(self):
		frappe.session.user = self.attacker.email
		try:
			doc = frappe.get_doc(
				{
					"doctype": "LMS Course Progress",
					"member": self.victim.email,
					"course": self.course.name,
					"lesson": self.lesson.name,
					"status": "Complete",
				}
			)
			# ignore_permissions isolates the controller guard from the role-permission layer.
			with self.assertRaises(frappe.PermissionError):
				doc.insert(ignore_permissions=True)
		finally:
			frappe.session.user = "Administrator"

	def test_controller_rebinds_member_to_session_user(self):
		frappe.session.user = self.attacker.email
		try:
			doc = frappe.get_doc(
				{
					"doctype": "LMS Course Progress",
					"member": self.attacker.email,  # own account is allowed
					"course": self.course.name,
					"lesson": self.lesson.name,
					"status": "Complete",
				}
			)
			doc.insert(ignore_permissions=True)
			self.assertEqual(doc.member, self.attacker.email)
		finally:
			frappe.session.user = "Administrator"
