import frappe

from lms.auth import authenticate
from lms.lms.test_helpers import BaseTestUtils


class TestAuth(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.normal_user = cls._create_user("normal-user@example.com", "Normal", "User", ["LMS Student"])

	def setUp(self):
		super().setUp()
		# authenticate() no-ops unless this is set. CI's site config sets it, a local
		# one doesn't, so test_allowed_path passed vacuously and test_not_allowed_path
		# failed locally.
		self._original_block_endpoints = frappe.conf.get("block_endpoints")
		frappe.conf.block_endpoints = 1

	def tearDown(self):
		frappe.conf.block_endpoints = self._original_block_endpoints
		super().tearDown()

	def test_allowed_path(self):
		frappe.form_dict.cmd = "ping"
		frappe.session.user = self.normal_user.name
		authenticate()
		frappe.session.user = "Administrator"

	def test_not_allowed_path(self):
		frappe.form_dict.cmd = "frappe.auth.get_logged_user"
		frappe.session.user = self.normal_user.name
		self.assertRaises(frappe.PermissionError, authenticate)
		frappe.session.user = "Administrator"
