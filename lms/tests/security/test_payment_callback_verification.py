# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""A payment callback credits an LMS Payment only for the gateway payment made
against that payment's own order, for its full amount and currency."""

from unittest.mock import patch

import frappe
from razorpay.errors import BadRequestError, ServerError

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import PAYMENT_RECHECKS, recheck_payment, update_payment_record
from lms.tests.fixtures.razorpay import mock_razorpay

PRICE = 5000


class TestPaymentCallbackVerification(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		suffix = frappe.generate_hash(length=6)
		instructor = cls._create_user(f"pcv-instr-{suffix}@example.com", "Pcv", "Instr", ["Course Creator"])
		cls.instructor = instructor
		cls.buyer = cls._create_user(f"pcv-buyer-{suffix}@example.com", "Pcv", "Buyer", ["LMS Student"])
		cls.other = cls._create_user(f"pcv-other-{suffix}@example.com", "Pcv", "Other", ["LMS Student"])
		cls.course = cls._create_course(f"PCV Course {suffix}", instructor.email)
		cls.cheap_course = cls._create_course(f"PCV Cheap Course {suffix}", instructor.email)
		for course, price in ((cls.course, PRICE), (cls.cheap_course, 10)):
			course.db_set({"paid_course": 1, "course_price": price, "currency": "INR"})

	def setUp(self):
		super().setUp()
		patcher = mock_razorpay()
		self.razorpay = patcher.__enter__()
		self.addCleanup(patcher.__exit__, None, None, None)
		frappe.set_user(self.buyer.email)

	def _payment(self, member=None, course=None, amount=PRICE, currency="INR"):
		payment = frappe.new_doc("LMS Payment")
		payment.update(
			{
				"member": member or self.buyer.email,
				"billing_name": "Pcv Buyer",
				"amount": amount,
				"currency": currency,
				"payment_for_document_type": "LMS Course",
				"payment_for_document": (course or self.course).name,
			}
		)
		payment.flags.ignore_mandatory = True
		payment.insert(ignore_permissions=True)
		return payment

	def _callback(self, payment, razorpay_payment_id="pay_x", course=None, **extra):
		frappe.flags.data = {
			"payment": payment.name,
			"payment_gateway": "Razorpay",
			"razorpay_payment_id": razorpay_payment_id,
			**extra,
		}
		try:
			update_payment_record("LMS Course", (course or self.course).name)
		finally:
			frappe.flags.data = None

	def _paid(self, payment):
		return frappe.db.get_value("LMS Payment", payment.name, "payment_received")

	def _enrolled_member(self, member, course=None):
		return bool(
			frappe.db.exists("LMS Enrollment", {"member": member, "course": (course or self.course).name})
		)

	def _enrolled(self, course=None):
		return bool(
			frappe.db.exists(
				"LMS Enrollment", {"member": self.buyer.email, "course": (course or self.course).name}
			)
		)

	def test_matching_gateway_payment_enrolls_and_stores_its_order(self):
		payment = self._payment()
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100)

		self._callback(payment, order_id="order_forged")

		self.assertEqual(self._paid(payment), 1)
		self.assertTrue(self._enrolled())
		self.assertEqual(frappe.db.get_value("LMS Payment", payment.name, "order_id"), "order_pay_x")

	def test_payment_made_for_another_checkout_is_refused(self):
		cheap = self._payment(course=self.cheap_course, amount=10)
		expensive = self._payment()
		self.razorpay.add_payment("pay_x", receipt=cheap.name, amount=PRICE * 100)

		self._callback(expensive)

		self.assertEqual(self._paid(expensive), 0)
		self.assertFalse(self._enrolled())

	def test_lower_amount_is_refused(self):
		payment = self._payment()
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=10 * 100)

		self._callback(payment)

		self.assertEqual(self._paid(payment), 0)
		self.assertFalse(self._enrolled())

	def test_other_currency_is_refused(self):
		payment = self._payment()
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100, currency="USD")

		self._callback(payment)

		self.assertEqual(self._paid(payment), 0)

	def test_unpaid_gateway_status_is_refused(self):
		payment = self._payment()
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100, status="failed")

		self._callback(payment)

		self.assertEqual(self._paid(payment), 0)

	def test_unknown_gateway_payment_is_refused(self):
		payment = self._payment()

		self._callback(payment, razorpay_payment_id="pay_unknown")

		self.assertEqual(self._paid(payment), 0)

	def test_a_passing_gateway_failure_is_retried(self):
		payment = self._payment()
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100)
		fetch = self.razorpay.payment.fetch
		failures = iter([ServerError("down")])

		def flaky_fetch(payment_id):
			for error in failures:
				raise error
			return fetch(payment_id)

		self.razorpay.payment.fetch = flaky_fetch
		with patch("time.sleep"):
			self._callback(payment)

		self.assertEqual(self._paid(payment), 1)
		self.assertTrue(self._enrolled())

	def test_a_lasting_gateway_failure_queues_a_recheck(self):
		payment = self._payment()
		self.razorpay.payment.fetch = self._unreachable

		with patch("time.sleep") as sleep, patch("frappe.enqueue") as enqueue:
			self._callback(payment)

		self.assertEqual(self._paid(payment), 0)
		self.assertEqual(sleep.call_count, 2)
		self.assertEqual(enqueue.call_args.args, ("lms.lms.utils.recheck_payment",))
		self.assertEqual(enqueue.call_args.kwargs["recheck"], 1)

	def test_a_recheck_that_reaches_the_gateway_enrolls(self):
		payment = self._payment()
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100)
		data = {"payment": payment.name, "payment_gateway": "Razorpay", "razorpay_payment_id": "pay_x"}

		with patch("time.sleep"):
			recheck_payment(data, "LMS Course", self.course.name, recheck=1)

		self.assertEqual(self._paid(payment), 1)
		self.assertTrue(self._enrolled())

	def test_the_last_recheck_stops_and_logs(self):
		payment = self._payment()
		self.razorpay.payment.fetch = self._unreachable
		data = {"payment": payment.name, "payment_gateway": "Razorpay", "razorpay_payment_id": "pay_x"}

		with patch("time.sleep"), patch("frappe.enqueue") as enqueue:
			recheck_payment(data, "LMS Course", self.course.name, recheck=PAYMENT_RECHECKS)

		self.assertEqual(self._paid(payment), 0)
		enqueue.assert_not_called()

	@staticmethod
	def _unreachable(payment_id):
		raise ServerError("down")

	def test_a_rejected_lookup_is_not_retried(self):
		payment = self._payment()
		calls = []

		def rejecting_fetch(payment_id):
			calls.append(payment_id)
			raise BadRequestError("The id provided does not exist")

		self.razorpay.payment.fetch = rejecting_fetch
		self._callback(payment)

		self.assertEqual(calls, ["pay_x"])
		self.assertEqual(self._paid(payment), 0)

	def test_a_verified_payment_from_another_session_enrolls_its_member(self):
		"""Razorpay vouches for the money, so the payment's member is enrolled and the
		session that carried the callback gets nothing."""
		payment = self._payment(member=self.other.email)
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100)

		self._callback(payment)

		self.assertEqual(self._paid(payment), 1)
		self.assertTrue(self._enrolled_member(self.other.email))
		self.assertFalse(self._enrolled())

	def test_a_guest_callback_enrolls_the_member_who_paid(self):
		"""Regression: a callback arriving as Guest enrolled Guest in the course and
		left the learner who paid on the billing page."""
		payment = self._payment()
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100)
		frappe.set_user("Guest")

		self._callback(payment)

		self.assertEqual(self._paid(payment), 1)
		self.assertTrue(self._enrolled())
		self.assertFalse(self._enrolled_member("Guest"))

	def test_a_guest_callback_marks_the_members_certificate_purchased(self):
		frappe.set_user("Administrator")
		enrollment = self._create_enrollment(self.buyer.email, self.course.name)
		payment = self._payment()
		payment.db_set("payment_for_certificate", 1)
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100)
		frappe.set_user("Guest")

		self._callback(payment)

		self.assertEqual(
			frappe.db.get_value("LMS Enrollment", enrollment.name, ["purchased_certificate", "payment"]),
			(1, payment.name),
		)
		self.assertFalse(self._enrolled_member("Guest"))

	def test_a_guest_callback_enrolls_the_member_in_a_paid_batch(self):
		frappe.set_user("Administrator")
		self._create_evaluator(self.instructor.email)
		batch = self._create_batch(
			self.course.name,
			instructor=self.instructor.email,
			title=f"PCV Batch {frappe.generate_hash(length=6)}",
			evaluator=self.instructor.email,
		)
		batch.db_set({"paid_batch": 1, "amount": PRICE, "currency": "INR"})
		payment = self._payment()
		payment.db_set({"payment_for_document_type": "LMS Batch", "payment_for_document": batch.name})
		self.razorpay.add_payment("pay_x", receipt=payment.name, amount=PRICE * 100)
		frappe.set_user("Guest")

		frappe.flags.data = {
			"payment": payment.name,
			"payment_gateway": "Razorpay",
			"razorpay_payment_id": "pay_x",
		}
		try:
			with patch("frappe.log_error", wraps=frappe.log_error) as log_error:
				update_payment_record("LMS Batch", batch.name)
		finally:
			frappe.flags.data = None

		self.assertEqual(self._paid(payment), 1)
		enrollment = frappe.db.get_value(
			"LMS Batch Enrollment", {"batch": batch.name, "member": self.buyer.email}, ["owner", "payment"]
		)
		self.assertEqual(enrollment, (self.buyer.email, payment.name))
		self.assertFalse(frappe.db.exists("LMS Batch Enrollment", {"batch": batch.name, "member": "Guest"}))
		# The confirmation is sent for the member, not refused for the Guest session.
		log_error.assert_not_called()

	def test_an_unverified_gateway_callback_from_another_session_is_refused(self):
		"""Without a gateway lookup behind it, only the payment's own member may
		complete a payment."""
		payment = self._payment(member=self.other.email)

		self._callback(payment, payment_gateway="PayPal", razorpay_payment_id=None)

		self.assertEqual(self._paid(payment), 0)
		self.assertFalse(self._enrolled_member(self.other.email))

	def test_payment_for_another_course_is_refused(self):
		cheap = self._payment(course=self.cheap_course, amount=10)
		self.razorpay.add_payment("pay_x", receipt=cheap.name, amount=10 * 100)

		self._callback(cheap, course=self.course)

		self.assertEqual(self._paid(cheap), 0)
		self.assertFalse(self._enrolled())

	def test_relabelled_gateway_is_still_verified(self):
		cheap = self._payment(course=self.cheap_course, amount=10)
		expensive = self._payment()
		self.razorpay.add_payment("pay_x", receipt=cheap.name, amount=10 * 100)

		self._callback(expensive, payment_gateway="Stripe", stripe_token_id="tok_x")

		self.assertEqual(self._paid(expensive), 0)
