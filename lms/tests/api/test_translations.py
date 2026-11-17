from unittest.mock import patch

import frappe

from lms.lms.api import get_translations
from lms.lms.test_helpers import BaseTestUtils


class TestTranslations(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.student = self._create_user(
			"translations.student@example.com", "Translations", "Student", roles=["LMS Student"]
		)

	def _language_served_to(self, user):
		frappe.set_user(user)
		try:
			with (
				patch("frappe.get_system_settings", return_value="es"),
				patch("lms.lms.api.get_all_translations", return_value={}) as get_all,
			):
				get_translations()
		finally:
			frappe.set_user("Administrator")
		return get_all.call_args.args[0]

	def test_a_user_without_a_language_gets_the_system_language(self):
		"""Regression: an empty User.language served no translations at all, so the
		UI stayed in English while Desk followed the system language."""
		frappe.db.set_value("User", self.student.name, "language", None)

		self.assertEqual(self._language_served_to(self.student.name), "es")
