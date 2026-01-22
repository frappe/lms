import frappe
from frappe.tests.test_api import FrappeAPITestCase

from lms.auth import authenticate
from lms.lms.test_utils import TestUtils


class TestAuth(FrappeAPITestCase):
	def setUp(self):
		self.normal_user = TestUtils.create_user(
			self, "normal-user@example.com", "Normal", "User", ["LMS Student"]
		)

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

	def tearDown(self):
		frappe.delete_doc("User", self.normal_user.name)
