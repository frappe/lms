# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase


class UnitTestLMSGoogleMeetSettings(UnitTestCase):
	"""
	Unit tests for LMSGoogleMeetSettings.
	Use this class for testing individual functions and methods.
	"""

	pass


class IntegrationTestLMSGoogleMeetSettings(IntegrationTestCase):
	"""
	Integration tests for LMSGoogleMeetSettings.
	"""

	def setUp(self):
		self.cleanup_items = []

	def tearDown(self):
		for item_type, item_name in reversed(self.cleanup_items):
			if frappe.db.exists(item_type, item_name):
				try:
					frappe.delete_doc(item_type, item_name, force=True)
				except Exception:
					pass

	def _create_google_calendar(self, name="Test Google Calendar"):
		if frappe.db.exists("Google Calendar", name):
			return frappe.get_doc("Google Calendar", name)

		calendar = frappe.get_doc(
			{
				"doctype": "Google Calendar",
				"calendar_name": name,
				"user": "Administrator",
				"google_account": "test@gmail.com",
			}
		)
		calendar.insert(ignore_permissions=True)
		self.cleanup_items.append(("Google Calendar", calendar.name))
		return calendar

	def test_create_google_meet_settings_with_valid_data(self):
		calendar = self._create_google_calendar()
		settings = frappe.get_doc(
			{
				"doctype": "LMS Google Meet Settings",
				"account_name": f"Test Meet Account {frappe.generate_hash(length=6)}",
				"member": "Administrator",
				"google_calendar": calendar.name,
				"enabled": 1,
			}
		)
		settings.insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Google Meet Settings", settings.name))

		self.assertTrue(frappe.db.exists("LMS Google Meet Settings", settings.name))
		self.assertEqual(settings.enabled, 1)
		self.assertEqual(settings.google_calendar, calendar.name)

	def test_create_google_meet_settings_without_calendar_raises_error(self):
		with self.assertRaises(frappe.exceptions.MandatoryError):
			settings = frappe.get_doc(
				{
					"doctype": "LMS Google Meet Settings",
					"account_name": f"Test No Calendar {frappe.generate_hash(length=6)}",
					"member": "Administrator",
				}
			)
			settings.insert(ignore_permissions=True)

	def test_create_google_meet_settings_without_member_raises_error(self):
		calendar = self._create_google_calendar()
		with self.assertRaises(frappe.exceptions.MandatoryError):
			settings = frappe.get_doc(
				{
					"doctype": "LMS Google Meet Settings",
					"account_name": f"Test No Member {frappe.generate_hash(length=6)}",
					"google_calendar": calendar.name,
				}
			)
			settings.insert(ignore_permissions=True)
