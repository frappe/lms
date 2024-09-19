import frappe
from payments.utils import get_payment_gateway_controller


def get_payment_gateway():
	return "Razorpay"


def get_controller(payment_gateway):
	return get_payment_gateway_controller(payment_gateway)


def validate_currency(payment_gateway, currency):
	controller = get_controller(payment_gateway)
	controller().validate_transaction_currency(currency)


@frappe.whitelist()
def get_payment_link(doctype, docname, amount, currency, billing_name):
	payment_gateway = get_payment_gateway()

	payment_details = {
		"amount": amount,
		"title": f"Payment for {doctype} {docname}",
		"description": f"{billing_name}'s payment for {doctype} {docname}",
		"reference_doctype": doctype,
		"reference_docname": docname,
		"payer_email": frappe.session.user,
		"payer_name": billing_name,
		"order_id": docname,
		"currency": currency,
		"payment_gateway": payment_gateway,
	}
	controller = get_controller(payment_gateway)
	url = controller().get_payment_url(**payment_details)
	return url
