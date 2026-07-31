import frappe
from frappe.tests.test_api import FrappeAPITestCase

from lms.lms.api import get_profile_details
from lms.lms.test_helpers import BaseTestUtils


class TestProfileDetailsDisclosure(BaseTestUtils, FrappeAPITestCase):
	"""get_profile_details must not leak privileged roles to other users, and must not
	behave as a username-enumeration oracle (VULN-2026-FRAPPE-LMS-001, -003)."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.student = self._create_user(f"pstud-{hash}@example.com", "Pat", "Student", ["LMS Student"])
		self.moderator = self._create_user(f"pmod-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		self.admin_user = self._create_user(
			f"padmin-{hash}@example.com", "Ada", "Ministrator", ["System Manager", "LMS Student"]
		)
		self.admin_username = f"padminuser{hash}"
		frappe.db.set_value("User", self.admin_user.name, "username", self.admin_username)
		self.student_username = f"pstuduser{hash}"
		frappe.db.set_value("User", self.student.name, "username", self.student_username)

	def _call(self, user, username):
		frappe.session.user = user
		try:
			return get_profile_details(username)
		finally:
			frappe.session.user = "Administrator"

	def test_student_does_not_see_privileged_roles_of_other_user(self):
		details = self._call(self.student.email, self.admin_username)
		self.assertNotIn("System Manager", details.roles)
		# LMS-facing roles the UI needs are still exposed.
		self.assertIn("LMS Student", details.roles)

	def test_owner_sees_full_role_list(self):
		details = self._call(self.admin_user.email, self.admin_username)
		self.assertIn("System Manager", details.roles)

	def test_moderator_sees_full_role_list(self):
		details = self._call(self.moderator.email, self.admin_username)
		self.assertIn("System Manager", details.roles)

	def test_guest_is_denied(self):
		# Every logged-in LMS user gets the LMS Student role (User before_insert hook
		# add_lms_student_role), so Guest is the reachable no-LMS-role caller. The authz
		# check must fire before any target lookup.
		with self.assertRaises(frappe.PermissionError):
			self._call("Guest", self.admin_username)

	def test_nonexistent_username_raises_does_not_exist_not_500(self):
		# Both valid and invalid usernames must fail the same way for an unauthorized/absent
		# target — no 200-vs-500 discrepancy to enumerate accounts with.
		with self.assertRaises(frappe.DoesNotExistError):
			self._call(self.student.email, f"nosuchuser-{frappe.generate_hash(length=8)}")

	def test_non_string_username_rejected(self):
		# Rejected either by Frappe's whitelist type validation (FrappeTypeError,
		# from the `username: str` annotation) or by our own isinstance guard.
		with self.assertRaises((frappe.ValidationError, frappe.FrappeTypeError)):
			self._call(self.student.email, ["administrator"])
