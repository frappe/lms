from unittest.mock import MagicMock, patch

import frappe
from frappe.tests.utils import FrappeTestCase

from lms.lms import halyk


class TestHalykInvoiceId(FrappeTestCase):
	@patch("lms.lms.halyk.secrets.randbelow", side_effect=[123_456_789, 223_456_789])
	@patch("lms.lms.halyk.frappe.db.exists")
	def test_invoice_id_retries_when_last_six_digits_are_already_used(self, exists, randbelow):
		# randbelow values become 9-digit invoice numbers after the 100m offset.
		exists.side_effect = ["LMS-PAYMENT-1", None]

		invoice_id = halyk._new_invoice_id()

		self.assertEqual(invoice_id, "323456789")
		self.assertEqual(
			exists.call_args_list[0].args,
			("LMS Payment", {"order_id": ("like", "%456789")}),
		)
		self.assertEqual(randbelow.call_count, 2)

	@patch("lms.lms.halyk.secrets.randbelow", return_value=123_456_789)
	@patch("lms.lms.halyk.frappe.db.exists", return_value=None)
	def test_invoice_id_is_nine_digits_and_checks_the_suffix(self, exists, _randbelow):
		invoice_id = halyk._new_invoice_id()

		self.assertEqual(invoice_id, "223456789")
		self.assertEqual(len(invoice_id), 9)
		exists.assert_called_once_with(
			"LMS Payment", {"order_id": ("like", "%456789")}
		)


class TestHalykCallback(FrappeTestCase):
	@patch("lms.lms.halyk.complete_enrollment")
	@patch("lms.lms.halyk.frappe.set_user")
	@patch("lms.lms.halyk.frappe.get_doc")
	@patch("lms.lms.halyk.frappe.db.exists", return_value=None)
	@patch("lms.lms.halyk.frappe.db.get_value")
	@patch("lms.lms.halyk.get_config")
	def test_guest_callback_enrolls_the_payment_owner(
		self, get_config, get_value, _exists, get_doc, set_user, complete_enrollment
	):
		payment = frappe._dict(
			name="PAY-TEST",
			member="buyer@example.com",
			currency="KZT",
			amount=9900,
			amount_with_gst=0,
			payment_for_document_type="LMS Course",
			payment_for_document="COURSE-TEST",
		)
		payment.get_password = MagicMock(return_value="callback-secret")
		payment.db_set = MagicMock()
		get_doc.return_value = payment
		get_config.return_value = frappe._dict(terminal_id="terminal-test")
		get_value.side_effect = [payment.name, 0]

		payload = {
			"invoiceId": "123456789",
			"secret_hash": "callback-secret",
			"terminal": "terminal-test",
			"currency": "KZT",
			"amount": 9900,
			"code": "ok",
			"reason": "success",
			"id": "transaction-test",
		}
		request = MagicMock()
		request.get_json.return_value = payload

		with patch("lms.lms.halyk.frappe.request", request):
			result = halyk.payment_callback()

		self.assertEqual(result, {"ok": True, "paid": True})
		set_user.assert_called_once_with(payment.member)
		payment.db_set.assert_called_once_with(
			{"payment_received": 1, "payment_id": "transaction-test"},
			update_modified=False,
		)
		complete_enrollment.assert_called_once_with(
			payment.name, "LMS Course", "COURSE-TEST"
		)


class TestHalykCheckout(FrappeTestCase):
	@patch("lms.lms.halyk.get_url", side_effect=lambda path: f"https://lms.test{path}")
	@patch("lms.lms.halyk._new_invoice_id", return_value="123456789")
	@patch("lms.lms.halyk.requests.post")
	@patch("lms.lms.halyk.get_config")
	def test_checkout_passes_the_complete_oauth_response_to_halyk(
		self, get_config, post, _invoice_id, _get_url
	):
		get_config.return_value = frappe._dict(
			client_id="client",
			client_secret="secret",
			terminal_id="terminal",
			oauth_url="https://oauth.test/token",
			script_url="https://pay.test/payment-api.js",
			test_mode=True,
		)
		auth = {
			"access_token": "token",
			"expires_in": 7200,
			"refresh_token": "",
			"scope": "payment",
			"token_type": "Bearer",
		}
		post.return_value.json.return_value = auth
		payment = frappe._dict(name="PAY-TEST", member="buyer@example.com")
		payment.save = MagicMock()

		checkout = halyk.create_checkout(
			payment,
			9900,
			"KZT",
			"Course",
			"/lms/courses/course-test",
			frappe._dict(billing_name="Buyer", phone="+77000000000"),
		)

		self.assertEqual(checkout["payment"]["auth"], auth)
		post.return_value.raise_for_status.assert_called_once_with()
		payment.save.assert_called_once_with(ignore_permissions=True)
