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

	def check_request_path(self, path):
		frappe.form_dict.cmd = None
		original_request = getattr(frappe.local, "request", None)
		frappe.local.request = frappe._dict(path=path)
		frappe.session.user = self.normal_user.name
		try:
			authenticate()
		finally:
			frappe.session.user = "Administrator"
			frappe.local.request = original_request

	def test_v2_method_follows_v1_rules(self):
		# frappectl calls methods through /api/v2/method/.
		self.check_request_path("/api/v2/method/lms.lms.utils.get_roles")
		self.check_request_path("/api/v2/method/frappe.client.get_list")
		self.assertRaises(
			frappe.PermissionError, self.check_request_path, "/api/v2/method/frappe.auth.get_logged_user"
		)

	def test_v2_document_routes_stay_blocked(self):
		self.assertRaises(frappe.PermissionError, self.check_request_path, "/api/v2/document/LMS Course")
