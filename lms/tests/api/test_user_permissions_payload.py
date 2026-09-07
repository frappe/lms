import frappe

from lms.lms.api import PERMISSION_DOCTYPES, get_user_info
from lms.lms.test_helpers import BaseTestUtils


class TestUserPermissionsPayload(BaseTestUtils):
	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_payload_carries_doctype_level_permissions(self):
		frappe.set_user("Administrator")
		info = get_user_info()
		self.assertIn("permissions", info)
		self.assertIn("LMS Course", info["permissions"])
		self.assertEqual(info["permissions"]["LMS Course"]["read"], 1)

	def test_payload_reflects_a_role_that_cannot_write(self):
		# A fresh user, not one of the site's fixtures: the audit site's test
		# users have been granted roles by earlier runs.
		student = self._create_user(
			f"permpayload-{frappe.generate_hash(length=6)}@example.com",
			"Perm",
			"Payload",
			["LMS Student"],
		)
		frappe.set_user(student.name)
		info = get_user_info()
		self.assertEqual(info["permissions"].get("LMS Course", {}).get("write", 0), 0)

	def test_a_student_has_no_docperm_read_on_courses_or_lessons(self):
		"""Pinned because it is a trap for anything that drives UI off this
		payload. LMS Student holds a read DocPerm on Course Chapter but not on
		LMS Course or Course Lesson (see the doctype JSONs); students reach both
		through whitelisted APIs that do their own scoping. So "can the user see
		courses" must not be keyed off permissions["LMS Course"].read — that
		would hide the catalogue from every student."""
		student = self._create_user(
			f"permread-{frappe.generate_hash(length=6)}@example.com",
			"Perm",
			"Reader",
			["LMS Student"],
		)
		frappe.set_user(student.name)
		perms = get_user_info()["permissions"]
		self.assertEqual(perms["LMS Course"]["read"], 0)
		self.assertEqual(perms["Course Lesson"]["read"], 0)
		self.assertEqual(perms["Course Chapter"]["read"], 1)

	def test_every_declared_doctype_is_answered(self):
		"""A doctype that stops existing would otherwise drop out of the payload
		silently and every UI affordance keyed on it would go dark."""
		frappe.set_user("Administrator")
		info = get_user_info()
		self.assertEqual(set(info["permissions"]), set(PERMISSION_DOCTYPES))
		for doctype in PERMISSION_DOCTYPES:
			self.assertEqual(set(info["permissions"][doctype]), {"read", "write", "create", "delete"})
