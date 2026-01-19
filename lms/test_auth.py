import frappe
from frappe.tests import UnitTestCase
from frappe.tests.test_api import FrappeAPITestCase

from lms.auth import authenticate
from lms.lms.test_utils import TestUtils


class TestAuth(FrappeAPITestCase):
	def setUp(self):
		self.normal_user = TestUtils.create_user(
			self, "normal-user@example.com", "Normal", "User", ["LMS Student"]
		)

	def test_allowed_path(self):
		site_url = frappe.utils.get_site_url(frappe.local.site)
		headers = {"Authorization": "Bearer set_test_example_user"}
		url = site_url + "/api/method/lms.lms.utils.get_courses"
		response = self.get(
			url,
			headers=headers,
		)
		self.assertNotEqual(response.json.get("exc_type"), "PermissionError")

	def test_not_allowed_path(self):
		site_url = frappe.utils.get_site_url(frappe.local.site)
		headers = {"Authorization": "Bearer set_test_example_user"}
		url = site_url + "/api/method/frappe.auth.get_logged_user"
		response = self.get(
			url,
			headers=headers,
		)
		self.assertEqual(response.json.get("exc_type"), "PermissionError")

	def tearDown(self):
		frappe.delete_doc("User", self.normal_user.name)
