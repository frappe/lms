import json

import frappe


def record_gateway_request(payment, amount=None, currency=None, status="Completed", gateway="Stripe"):
	"""The Integration Request a payments-app checkout page leaves behind: the
	payload the browser posted, marked Completed once the gateway charged it."""
	data = {
		"payment": payment.name,
		"payment_gateway": gateway,
		"amount": payment.amount if amount is None else amount,
		"currency": currency or payment.currency,
		"reference_doctype": payment.payment_for_document_type,
		"reference_docname": payment.payment_for_document,
	}
	request = frappe.get_doc(
		{
			"doctype": "Integration Request",
			"integration_request_service": gateway,
			"status": status,
			"data": json.dumps(data),
			"reference_doctype": payment.payment_for_document_type,
			"reference_docname": payment.payment_for_document,
			"owner": payment.member,
		}
	)
	request.insert(ignore_permissions=True)
	return request
