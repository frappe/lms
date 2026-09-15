import frappe

from lms.lms.api import get_system_preferences, set_system_preferences
from lms.lms.test_helpers import BaseTestUtils


class TestSystemPreferences(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.language = frappe.db.get_single_value("System Settings", "language")
		self.time_zone = frappe.db.get_single_value("System Settings", "time_zone")

	def tearDown(self):
		frappe.db.set_single_value("System Settings", "language", self.language)
		frappe.db.set_single_value("System Settings", "time_zone", self.time_zone)
		super().tearDown()

	def test_get_system_preferences_reports_current_values(self):
		frappe.db.set_single_value("System Settings", "language", "de")
		frappe.db.set_single_value("System Settings", "time_zone", "Asia/Kolkata")

		preferences = get_system_preferences()

		self.assertEqual(preferences["language"], "de")
		self.assertEqual(preferences["time_zone"], "Asia/Kolkata")
		self.assertIn("Asia/Kolkata", preferences["timezones"])

	def test_set_system_preferences_requires_system_manager(self):
		student = self._create_user("prefs.student@example.com", "Prefs", "Student", roles=["LMS Student"])
		self.cleanup_items.append(("User", student.name))

		frappe.set_user(student.name)
		try:
			self.assertRaises(frappe.PermissionError, set_system_preferences, language="de")
		finally:
			frappe.set_user("Administrator")

	def test_set_system_preferences_rejects_unknown_language(self):
		self.assertRaises(
			frappe.ValidationError,
			set_system_preferences,
			language="not-a-real-language",
		)

	def test_set_system_preferences_rejects_unknown_timezone(self):
		self.assertRaises(
			frappe.ValidationError,
			set_system_preferences,
			time_zone="Not/A_Real_Zone",
		)

	def test_set_system_preferences_writes_valid_values(self):
		set_system_preferences(language="de", time_zone="Asia/Kolkata")

		self.assertEqual(frappe.db.get_single_value("System Settings", "language"), "de")
		self.assertEqual(frappe.db.get_single_value("System Settings", "time_zone"), "Asia/Kolkata")

	def test_set_system_preferences_leaves_unset_fields_untouched(self):
		frappe.db.set_single_value("System Settings", "language", "fr")
		frappe.db.set_single_value("System Settings", "time_zone", "UTC")

		set_system_preferences(language="de")

		self.assertEqual(frappe.db.get_single_value("System Settings", "language"), "de")
		self.assertEqual(frappe.db.get_single_value("System Settings", "time_zone"), "UTC")
