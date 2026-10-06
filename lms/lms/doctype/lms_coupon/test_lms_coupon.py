# Copyright (c) 2025, Frappe and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from lms.lms.utils import apply_coupon, calculate_discount_amount

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class UnitTestLMSCoupon(UnitTestCase):
	"""
	Unit tests for coupon discount calculation.
	"""

	def test_fixed_amount_discount(self):
		coupon = frappe._dict(discount_type="Fixed Amount", fixed_amount_discount=200)
		self.assertEqual(calculate_discount_amount(1000, coupon), 200)

	def test_fixed_amount_equal_to_price(self):
		coupon = frappe._dict(discount_type="Fixed Amount", fixed_amount_discount=5000)
		self.assertEqual(calculate_discount_amount(5000, coupon), 5000)

	def test_fixed_amount_is_capped_at_price(self):
		coupon = frappe._dict(discount_type="Fixed Amount", fixed_amount_discount=1500)
		self.assertEqual(calculate_discount_amount(1000, coupon), 1000)

	def test_negative_fixed_amount_gives_no_discount(self):
		coupon = frappe._dict(discount_type="Fixed Amount", fixed_amount_discount=-200)
		self.assertEqual(calculate_discount_amount(1000, coupon), 0)

	def test_negative_percentage_gives_no_discount(self):
		coupon = frappe._dict(discount_type="Percentage", percentage_discount=-10)
		self.assertEqual(calculate_discount_amount(1000, coupon), 0)

	def test_percentage_discount(self):
		coupon = frappe._dict(discount_type="Percentage", percentage_discount=25)
		self.assertEqual(calculate_discount_amount(1000, coupon), 250)


class IntegrationTestLMSCoupon(IntegrationTestCase):
	"""
	Integration tests for LMSCoupon.
	Use this class for testing interactions between multiple components.
	"""

	def setUp(self):
		self.course = frappe.get_doc(
			{
				"doctype": "LMS Course",
				"title": f"Coupon Test Course {frappe.generate_hash(length=6)}",
				"short_introduction": "Coupon test",
				"description": "Coupon test",
				"published": 1,
				"paid_course": 1,
				"course_price": 1000,
				"currency": "INR",
				"instructors": [{"instructor": "Administrator"}],
			}
		).insert()

	def _make_coupon(self, discount_type, **values):
		return frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"code": f"TEST{frappe.generate_hash(length=6)}".upper(),
				"discount_type": discount_type,
				"enabled": 1,
				"applicable_items": [{"reference_doctype": "LMS Course", "reference_name": self.course.name}],
				**values,
			}
		).insert()

	def test_apply_fixed_amount_coupon(self):
		coupon = self._make_coupon("Fixed Amount", fixed_amount_discount=200)
		discount, subtotal, _ = apply_coupon("LMS Course", self.course.name, coupon.code, 1000)
		self.assertEqual(discount, 200)
		self.assertEqual(subtotal, 800)

	def test_apply_fixed_amount_coupon_covering_full_price(self):
		coupon = self._make_coupon("Fixed Amount", fixed_amount_discount=1000)
		discount, subtotal, _ = apply_coupon("LMS Course", self.course.name, coupon.code, 1000)
		self.assertEqual(discount, 1000)
		self.assertEqual(subtotal, 0)

	def test_apply_fixed_amount_coupon_larger_than_price(self):
		coupon = self._make_coupon("Fixed Amount", fixed_amount_discount=1500)
		discount, subtotal, _ = apply_coupon("LMS Course", self.course.name, coupon.code, 1000)
		self.assertEqual(discount, 1000)
		self.assertEqual(subtotal, 0)

	def test_apply_negative_fixed_amount_coupon(self):
		coupon = self._make_coupon("Fixed Amount", fixed_amount_discount=-200)
		discount, subtotal, _ = apply_coupon("LMS Course", self.course.name, coupon.code, 1000)
		self.assertEqual(discount, 0)
		self.assertEqual(subtotal, 1000)

	def test_apply_percentage_coupon(self):
		coupon = self._make_coupon("Percentage", percentage_discount=25)
		discount, subtotal, _ = apply_coupon("LMS Course", self.course.name, coupon.code, 1000)
		self.assertEqual(discount, 250)
		self.assertEqual(subtotal, 750)
