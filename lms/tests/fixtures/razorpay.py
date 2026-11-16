from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch


class FakeRazorpayClient:
	"""Answers `client.payment.fetch` and `client.order.fetch` like razorpay.Client,
	from payments registered with `add_payment`. An unknown id raises, as the
	real API does."""

	def __init__(self):
		self.payments = {}
		self.orders = {}
		self.payment = SimpleNamespace(fetch=lambda payment_id: self.payments[payment_id])
		self.order = SimpleNamespace(fetch=lambda order_id: self.orders[order_id])

	def add_payment(self, payment_id, receipt, amount, currency="INR", status="captured"):
		"""`amount` is in the currency's minor unit, as Razorpay reports it."""
		if payment_id in self.payments:
			return
		order_id = f"order_{payment_id}"
		self.orders[order_id] = {"id": order_id, "receipt": receipt, "amount": amount, "currency": currency}
		self.payments[payment_id] = {
			"id": payment_id,
			"order_id": order_id,
			"amount": amount,
			"currency": currency,
			"status": status,
		}


@contextmanager
def mock_razorpay(client=None):
	client = client or FakeRazorpayClient()
	with patch("lms.lms.utils.get_razorpay_client", return_value=client, create=True):
		yield client
