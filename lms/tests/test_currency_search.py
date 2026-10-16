import frappe
from frappe.desk.search import search_link

from lms.lms.test_helpers import BaseTestUtils

QUERY = "lms.lms.api.search_currencies"


def search_currencies(*args):
	return frappe.call(QUERY, *args)


class TestCurrencySearch(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.creator = cls._create_user("currency-creator@example.com", "Cur", "Creator", ["Course Creator"])
		cls.moderator = cls._create_user("currency-moderator@example.com", "Cur", "Moderator", ["Moderator"])
		cls.student = cls._create_user("currency-student@example.com", "Cur", "Student", ["LMS Student"])

	def setUp(self):
		super().setUp()
		frappe.db.set_value("Currency", "EUR", "enabled", 1)
		frappe.db.set_value("Currency", "GBP", "enabled", 0)

	def _search(self, user, txt=""):
		frappe.set_user(user.name)
		return [row["value"] for row in search_link("Currency", txt, query=QUERY, page_length=200)]

	def test_lms_authors_can_search_enabled_currencies(self):
		# Regression: currency picker 403 for Moderator and Course Creator (#3023, fixed in #3038).
		for user in (self.creator, self.moderator):
			with self.subTest(user=user.name):
				currencies = self._search(user)
				self.assertIn("EUR", currencies)
				self.assertNotIn("GBP", currencies)

	def test_a_student_is_denied(self):
		frappe.set_user(self.student.name)
		with self.assertRaises(frappe.PermissionError):
			search_currencies("Currency", "", "name", 0, 20, {})

	def test_non_text_search_is_rejected(self):
		from lms.lms.api import search_currencies as endpoint

		frappe.set_user(self.creator.name)
		with self.assertRaises(frappe.FrappeTypeError):
			search_currencies("Currency", ["EUR"], "name", 0, 20, {})
		with self.assertRaises(frappe.ValidationError):
			endpoint.__wrapped__("Currency", ["EUR"], "name", 0, 20, {})
