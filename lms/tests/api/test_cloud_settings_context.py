import sys
from unittest.mock import patch

import frappe

from lms.lms.api import get_user_info
from lms.lms.test_helpers import BaseTestUtils

PILOT_CONF = {"pilot_endpoint": "https://pilot.example.test", "pilot_auth_token": "token"}


class TestCloudSettingsContext(BaseTestUtils):
	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_disabled_without_pilot_config(self):
		frappe.set_user("Administrator")
		self.assertEqual(get_user_info()["cloud_settings"], {"enabled": False})

	def test_enabled_for_system_manager_on_pilot_site(self):
		frappe.set_user("Administrator")
		with patch.dict(frappe.local.conf, PILOT_CONF):
			context = get_user_info()["cloud_settings"]
		self.assertTrue(context["enabled"])
		self.assertIn("js", context["bundle"])
		self.assertNotIn("pilot_auth_token", context)

	def test_disabled_for_non_system_manager_on_pilot_site(self):
		student = self._create_user(
			f"cloud-{frappe.generate_hash(length=6)}@example.com", "Cloud", "Student", ["LMS Student"]
		)
		frappe.set_user(student.name)
		with patch.dict(frappe.local.conf, PILOT_CONF):
			self.assertEqual(get_user_info()["cloud_settings"], {"enabled": False})

	def test_disabled_when_frappe_has_no_cloud_settings(self):
		frappe.set_user("Administrator")
		with (
			patch.dict(frappe.local.conf, PILOT_CONF),
			patch.dict(sys.modules, {"frappe.integrations.frappe_providers.cloud_settings": None}),
		):
			self.assertEqual(get_user_info()["cloud_settings"], {"enabled": False})

	def test_disabled_on_v1_frappe_cloud_site(self):
		frappe.set_user("Administrator")
		with (
			patch.dict(frappe.local.conf, {"fc_communication_secret": "secret"}),
			patch("lms.lms.api.current_site_info", return_value={}),
		):
			user = get_user_info()
		self.assertTrue(user["is_fc_site"])
		self.assertEqual(user["cloud_settings"], {"enabled": False})
