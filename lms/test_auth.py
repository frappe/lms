import frappe
from frappe.tests.test_api import FrappeAPITestCase

from lms.lms.test_helpers import BaseTestUtils


class TestAuth(FrappeAPITestCase, BaseTestUtils):
	def setUp(self):
		super().setUp()
		BaseTestUtils.setUp(self)
		self.normal_user = self._create_user("normal-user@example.com", "Normal", "User", ["LMS Student"])

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
		BaseTestUtils.tearDown(self)
