import hmac
import secrets
from decimal import Decimal, InvalidOperation

import frappe
import requests
from frappe import _
from frappe.utils import get_url

from lms.lms.utils import complete_enrollment


TEST_OAUTH_URL = "https://test-epay-oauth.epayment.kz/oauth2/token"
PRODUCTION_OAUTH_URL = "https://epay-oauth.homebank.kz/oauth2/token"
TEST_SCRIPT_URL = "https://test-epay.epayment.kz/redesign-payform/payment-api.js"
PRODUCTION_SCRIPT_URL = "https://epay.homebank.kz/payform/payment-api.js"
TEST_CLIENT_ID = "test"
TEST_CLIENT_SECRET = "yF587AV9Ms94qN2QShFzVR3vFnWkhjbAK3sG"
TEST_TERMINAL_ID = "67e34d63-102f-4bd1-898e-370781d0074d"


def is_enabled() -> bool:
	return bool(frappe.conf.get("halyk_epay_enabled"))


def is_test_mode() -> bool:
	return bool(frappe.conf.get("halyk_epay_test_mode", True))


def get_config() -> frappe._dict:
	test_mode = is_test_mode()
	config = frappe._dict(
		client_id=frappe.conf.get("halyk_epay_client_id") or (TEST_CLIENT_ID if test_mode else None),
		client_secret=frappe.conf.get("halyk_epay_client_secret")
		or (TEST_CLIENT_SECRET if test_mode else None),
		terminal_id=frappe.conf.get("halyk_epay_terminal_id")
		or (TEST_TERMINAL_ID if test_mode else None),
		oauth_url=TEST_OAUTH_URL if test_mode else PRODUCTION_OAUTH_URL,
		script_url=TEST_SCRIPT_URL if test_mode else PRODUCTION_SCRIPT_URL,
		test_mode=test_mode,
	)
	if not all((config.client_id, config.client_secret, config.terminal_id)):
		frappe.throw(_("Halyk ePay credentials are not configured."))
	return config


@frappe.whitelist()
def get_checkout_availability():
	return {
		"enabled": is_enabled(),
		"test_mode": is_test_mode(),
		"methods": ["card"],
	}


def create_checkout(payment, amount, currency, title, redirect_to, address):
	if not is_enabled():
		frappe.throw(_("Halyk ePay is not enabled."))
	if currency != "KZT":
		frappe.throw(_("Halyk ePay currently accepts checkout in KZT only."))

	config = get_config()
	invoice_id = _new_invoice_id()
	secret_hash = secrets.token_urlsafe(32)
	callback_url = get_url("/api/method/lms.lms.halyk.payment_callback")
	back_link = get_url(redirect_to)

	payload = {
		"grant_type": "client_credentials",
		"scope": "payment",
		"client_id": config.client_id,
		"client_secret": config.client_secret,
		"invoiceID": invoice_id,
		"secret_hash": secret_hash,
		"amount": str(amount),
		"currency": currency,
		"terminal": config.terminal_id,
		"postLink": callback_url,
		"failurePostLink": callback_url,
	}

	try:
		response = requests.post(config.oauth_url, data=payload, timeout=20)
		response.raise_for_status()
		auth = response.json()
	except (requests.RequestException, ValueError) as exc:
		frappe.log_error(title="Halyk ePay token request failed", message=str(exc))
		frappe.throw(_("Halyk ePay is temporarily unavailable. Please try again."))

	# The payment page expects the complete OAuth response, not just the token
	# string. Passing only access_token makes a newly created checkout render as
	# expired immediately.
	if not auth.get("access_token"):
		frappe.throw(_("Halyk ePay did not return an authorization token."))

	# Password fields are encrypted into __Auth only through Document.save;
	# db_set would put an unusable masked value in the document table.
	payment.order_id = invoice_id
	payment.gateway_secret_hash = secret_hash
	payment.payment_gateway_name = "Halyk ePay"
	payment.save(ignore_permissions=True)

	return {
		"provider": "halyk_epay",
		"script_url": config.script_url,
		"test_mode": config.test_mode,
		"payment": {
			"invoiceId": invoice_id,
			"backLink": back_link,
			"failureBackLink": get_url(f"{redirect_to}?payment=failed"),
			"postLink": callback_url,
			"failurePostLink": callback_url,
			"language": "rus",
			"autoBackLink": True,
			"description": str(title)[:125],
			"accountId": payment.member,
			"terminal": config.terminal_id,
			"amount": float(amount),
			"currency": currency,
			"phone": address.get("phone") or "",
			"name": address.billing_name,
			"email": payment.member,
			"auth": auth,
		},
	}


def _new_invoice_id() -> str:
	for _ in range(10):
		# ePay accepts 6-15 digits and requires the last six digits to remain
		# unique. Nine digits match Halyk's own payment-page examples.
		invoice_id = str(secrets.randbelow(900_000_000) + 100_000_000)
		# Checking only the complete value is insufficient: ePay also rejects a
		# different invoice whose last six digits were used before.
		if not frappe.db.exists("LMS Payment", {"order_id": ("like", f"%{invoice_id[-6:]}")}):
			return invoice_id
	frappe.throw(_("Could not create a unique payment number. Please try again."))


@frappe.whitelist(allow_guest=True)
def payment_callback():
	payload = frappe.request.get_json(silent=True) or frappe.form_dict
	data = frappe._dict(payload or {})
	invoice_id = data.get("invoiceId") or data.get("invoiceID")
	if not invoice_id:
		frappe.throw(_("Payment number is missing."), frappe.ValidationError)

	payment_name = frappe.db.get_value("LMS Payment", {"order_id": str(invoice_id)}, "name")
	if not payment_name:
		frappe.throw(_("Payment was not found."), frappe.DoesNotExistError)

	payment = frappe.get_doc("LMS Payment", payment_name)
	expected_secret = payment.get_password("gateway_secret_hash")
	provided_secret = str(data.get("secret_hash") or "")
	if not expected_secret or not hmac.compare_digest(expected_secret, provided_secret):
		frappe.throw(_("Invalid payment signature."), frappe.PermissionError)

	config = get_config()
	if str(data.get("terminal") or "") != config.terminal_id:
		frappe.throw(_("Invalid payment terminal."), frappe.PermissionError)
	if str(data.get("currency") or "") != payment.currency:
		frappe.throw(_("Payment currency does not match."), frappe.ValidationError)
	expected_amount = payment.amount_with_gst or payment.amount
	try:
		callback_amount = Decimal(str(data.get("amount")))
	except (InvalidOperation, ValueError):
		frappe.throw(_("Payment amount is invalid."), frappe.ValidationError)
	if callback_amount != Decimal(str(expected_amount)):
		frappe.throw(_("Payment amount does not match."), frappe.ValidationError)

	if data.get("code") != "ok" or data.get("reason") != "success":
		return {"ok": True, "paid": False}

	if frappe.db.get_value("LMS Payment", payment.name, "payment_received", for_update=True):
		return {"ok": True, "paid": True}

	transaction_id = str(data.get("id") or data.get("reference") or "")
	if not transaction_id:
		frappe.throw(_("Payment transaction ID is missing."), frappe.ValidationError)
	if frappe.db.exists("LMS Payment", {"payment_id": transaction_id}):
		return {"ok": True, "paid": True}

	# Halyk calls postLink without a learner session, so this request starts as
	# Guest. Enrollment helpers intentionally use frappe.session.user; switch to
	# the verified payment owner before they create access records. Otherwise the
	# enrollment is attempted for Guest, validation fails, and the paid flag is
	# rolled back with the request.
	frappe.set_user(payment.member)
	payment.db_set(
		{"payment_received": 1, "payment_id": transaction_id},
		update_modified=False,
	)
	frappe.flags.payment_bank_fee = data.get("fee") or 0
	complete_enrollment(
		payment.name,
		payment.payment_for_document_type,
		payment.payment_for_document,
	)
	return {"ok": True, "paid": True}
