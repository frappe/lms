from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from lms.lms.utils import check_multicurrency

INR_TO_USD = 0.01079


class TestCheckMulticurrency(UnitTestCase):
	def convert(
		self, amount, currency="INR", country="United States", amount_usd=None, rate=INR_TO_USD, converts=True
	):
		# apply_rounding is still stored on sites that had it on before the field was removed.
		settings = frappe._dict(
			show_usd_equivalent=1, apply_rounding=1, exception_country=[frappe._dict(country="India")]
		)
		with (
			patch("lms.lms.utils.frappe.get_single", return_value=settings),
			patch("lms.lms.utils.get_current_exchange_rate", return_value=rate) as get_rate,
		):
			result = check_multicurrency(amount, currency, country, amount_usd)
		self.assertEqual(get_rate.called, converts)
		return result

	def test_converted_price_rounds_to_nearest_dollar(self):
		self.assertEqual(self.convert(3000), (32, "USD"))
		self.assertEqual(self.convert(15000), (162, "USD"))

	def test_whole_dollar_price_is_unchanged(self):
		self.assertEqual(self.convert(100, currency="EUR", rate=1.5), (150, "USD"))

	def test_explicit_usd_price_skips_conversion(self):
		self.assertEqual(self.convert(15000, amount_usd=200, converts=False), (200, "USD"))

	def test_usd_price_is_returned_as_is(self):
		self.assertEqual(self.convert(200, currency="USD", converts=False), (200, "USD"))

	def test_buyer_in_primary_country_keeps_local_price(self):
		self.assertEqual(self.convert(3000, country="India", converts=False), (3000, "INR"))
