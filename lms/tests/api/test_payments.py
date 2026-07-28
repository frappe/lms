import frappe

from lms.lms import payments as payments_module
from lms.lms.test_helpers import BaseTestUtils


class FakeRazorpayController:
	"""Stands in for the payments app's RazorpaySettings.

	Mirrors the real controller: `get_payment_url` creates the order itself when
	the caller hasn't supplied an `order_id`, `create_order` converts rupees to
	paise, and both write an Integration Request. `direct_create_order_calls`
	records the calls that did *not* come from inside `get_payment_url` — i.e.
	the ones LMS made on its own.
	"""

	def __init__(self):
		self.create_order_calls = []
		self.direct_create_order_calls = []
		self.get_payment_url_calls = []
		self.integration_requests = []
		self._inside_get_payment_url = False

	def create_order(self, **kwargs):
		self.create_order_calls.append(kwargs)
		if not self._inside_get_payment_url:
			self.direct_create_order_calls.append(kwargs)
		paise = dict(kwargs, amount=int(kwargs["amount"] * 100))
		self.integration_requests.append(paise)
		return {"id": "order_TEST123"}

	def get_payment_url(self, **kwargs):
		self.get_payment_url_calls.append(dict(kwargs))
		self._inside_get_payment_url = True
		try:
			if not kwargs.get("order_id"):
				order = self.create_order(**kwargs)
				kwargs.update({"order_id": order.get("id")})
		finally:
			self._inside_get_payment_url = False
		self.integration_requests.append(kwargs)
		return "https://example.test/razorpay_checkout?token=IR-TEST"


class TestPaymentLink(BaseTestUtils):
	"""LMS used to pre-create the Razorpay order and hand the resulting
	`order_id` to `get_payment_url` — which creates the order itself whenever one
	is missing. That put gateway-specific order logic (and a hard-coded
	`if payment_gateway != "Razorpay"`) in LMS, duplicating what the payments app
	owns, while omitting the `receipt` / `payment_capture` fields the controller's
	order payload expects. Ordering the call through `get_payment_url` alone keeps
	LMS gateway-agnostic.
	"""

	def setUp(self):
		super().setUp()
		self.controller = FakeRazorpayController()
		self.original_get_controller = payments_module.get_controller
		payments_module.get_controller = lambda gateway: self.controller

		self.original_gateway = frappe.db.get_single_value("LMS Settings", "payment_gateway")
		frappe.db.set_single_value("LMS Settings", "payment_gateway", "Razorpay")

		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"payinstr-{hash}@example.com", "Ina", "Instructor", ["Course Creator"]
		)
		self.course = self._create_course(
			title=f"Paid Payments Course {hash}", instructor=self.instructor.email
		)
		self.course.db_set({"paid_course": 1, "course_price": 500, "currency": "INR"}, update_modified=False)

	def tearDown(self):
		payments_module.get_controller = self.original_get_controller
		frappe.db.set_single_value("LMS Settings", "payment_gateway", self.original_gateway)
		super().tearDown()

	def _buy_course(self):
		return payments_module.get_payment_link(
			doctype="LMS Course",
			docname=self.course.name,
			address={
				"billing_name": "Test Buyer",
				"address_line1": "1 Test Street",
				"city": "Test City",
				"country": "India",
				"pincode": "560001",
				"source": "Website",
				"member_consent": 1,
			},
			payment_for_certificate=0,
		)

	def test_lms_never_calls_create_order_itself(self):
		"""The regression guard: order creation belongs to the gateway
		controller. Before the fix LMS called `create_order` directly whenever
		the gateway happened to be named Razorpay."""
		self._buy_course()

		self.assertEqual(self.controller.direct_create_order_calls, [])
		self.assertEqual(len(self.controller.get_payment_url_calls), 1)

	def test_no_create_order_helper_remains(self):
		"""`create_order` in lms.lms.payments was a stale copy of logic that has
		since moved into the payments app."""
		self.assertFalse(
			hasattr(payments_module, "create_order"),
			"lms.lms.payments.create_order duplicates the payments app controller",
		)

	def test_controller_still_gets_an_order_created(self):
		"""Delegating must not lose the order — `get_payment_url` creates one
		because LMS no longer supplies an `order_id`."""
		self._buy_course()

		self.assertEqual(len(self.controller.create_order_calls), 1)
		self.assertIsNone(self.controller.get_payment_url_calls[0].get("order_id"))

	def test_payment_url_receives_the_amount_in_rupees(self):
		"""LMS passes the order total untouched; converting to paise is the
		controller's job."""
		self._buy_course()

		self.assertEqual(self.controller.get_payment_url_calls[0]["amount"], 500)

	def test_the_request_carrying_the_order_id_is_written_last(self):
		"""The controller writes two Integration Requests per attempt — the paise
		order payload, then the checkout payload with the `order_id`.
		`update_payment_record` resolves the payment with
		`order_by="creation desc" limit 1`, so it depends on the second one being
		the newer row. This documents that contract; the duplication itself lives
		in the payments app and is unchanged by this fix."""
		self._buy_course()

		self.assertEqual(len(self.controller.integration_requests), 2)
		self.assertNotIn("order_id", self.controller.integration_requests[0])
		self.assertEqual(self.controller.integration_requests[-1]["order_id"], "order_TEST123")
