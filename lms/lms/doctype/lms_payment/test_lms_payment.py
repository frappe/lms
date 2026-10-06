# Copyright (c) 2023, Frappe and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from lms.lms.api import verify_billing_access
from lms.lms.doctype.lms_payment.lms_payment import is_batch_sold_out


class TestLMSPayment(UnitTestCase):
	pass


class IntegrationTestLMSPaymentSeats(IntegrationTestCase):
	def _make_batch(self, seat_count):
		return frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": f"Seat Test Batch {frappe.generate_hash(length=6)}",
				"start_date": "2099-01-01",
				"end_date": "2099-01-31",
				"start_time": "10:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": "Seat test",
				"batch_details": "Seat test",
				"published": 1,
				"seat_count": seat_count,
				"paid_batch": 1,
				"amount": 1000,
				"currency": "INR",
				"instructors": [{"instructor": "Administrator"}],
			}
		).insert()

	def _payment(self, batch):
		return frappe._dict(payment_for_document_type="LMS Batch", payment_for_document=batch.name)

	def _with_students(self, count):
		return patch.object(frappe.db, "count", return_value=count)

	def test_unlimited_batch_is_never_sold_out(self):
		batch = self._make_batch(0)
		with self._with_students(0):
			self.assertFalse(is_batch_sold_out(self._payment(batch)))
		with self._with_students(50):
			self.assertFalse(is_batch_sold_out(self._payment(batch)))

	def test_batch_with_seats_left_is_not_sold_out(self):
		batch = self._make_batch(5)
		with self._with_students(4):
			self.assertFalse(is_batch_sold_out(self._payment(batch)))

	def test_full_batch_is_sold_out(self):
		batch = self._make_batch(5)
		with self._with_students(5):
			self.assertTrue(is_batch_sold_out(self._payment(batch)))

	def test_missing_seat_count_does_not_raise(self):
		batch = self._make_batch(0)
		with (
			patch.object(frappe, "get_cached_value", return_value=None),
			self._with_students(3),
		):
			self.assertFalse(is_batch_sold_out(self._payment(batch)))

	def test_course_payment_is_never_sold_out(self):
		payment = frappe._dict(payment_for_document_type="LMS Course", payment_for_document="any")
		self.assertFalse(is_batch_sold_out(payment))

	def test_billing_access_for_unlimited_batch(self):
		batch = self._make_batch(0)
		with self._with_students(0):
			access, message = verify_billing_access("LMS Batch", batch.name, "batch")
		self.assertTrue(access, message)

	def test_billing_access_for_full_batch(self):
		batch = self._make_batch(5)
		with self._with_students(5):
			access, message = verify_billing_access("LMS Batch", batch.name, "batch")
		self.assertFalse(access)
		self.assertEqual(message, "Batch is sold out.")
