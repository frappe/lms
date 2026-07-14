import frappe
from frappe import _

from lms.lms.utils import (
	complete_enrollment,
	get_lms_route,
	get_order_summary,
)

GATEWAY_NOT_CONFIGURED_TITLE = "Payment Gateway Not Configured"


def get_payment_gateway():
	return frappe.db.get_single_value("LMS Settings", "payment_gateway")


def get_controller(payment_gateway):
	validate_payment_gateway(payment_gateway)

	from payments.utils import get_payment_gateway_controller

	return get_payment_gateway_controller(payment_gateway)


def validate_payment_gateway(payment_gateway):
	"""Fail with an actionable message instead of a permission error from the payments app."""
	if "payments" not in frappe.get_installed_apps():
		frappe.throw(
			_("The Payments app is not installed. Please contact the administrator."),
			title=_(GATEWAY_NOT_CONFIGURED_TITLE),
		)

	if not payment_gateway:
		frappe.throw(
			_("No payment gateway is configured. Please contact the administrator."),
			title=_(GATEWAY_NOT_CONFIGURED_TITLE),
		)

	if not frappe.db.exists("Payment Gateway", payment_gateway):
		frappe.throw(
			_("The configured payment gateway {0} does not exist. Please contact the administrator.").format(
				frappe.bold(payment_gateway)
			),
			title=_(GATEWAY_NOT_CONFIGURED_TITLE),
		)


@frappe.whitelist()
def get_payment_link(
	doctype: str,
	docname: str,
	address: dict,
	payment_for_certificate: int,
	coupon_code: str | None = None,
	country: str | None = None,
):
	payment_gateway = get_payment_gateway()
	address = frappe._dict(address)
	redirect_to = get_redirect_url(doctype, docname, payment_for_certificate)

	details = frappe._dict(get_order_summary(doctype, docname, coupon=coupon_code, country=country))
	title = details.title
	currency = details.currency
	original_amount = details.original_amount
	discount_amount = details.get("discount_amount", 0)
	gst_amount = details.get("gst_applied", 0)
	amount = original_amount - discount_amount
	amount_with_gst = get_amount_with_gst(amount, gst_amount)
	coupon = details.get("coupon")
	total_amount = amount_with_gst if amount_with_gst else amount

	# Resolve the controller before writing anything: get_controller validates the
	# gateway and fails with an actionable message, so a misconfigured gateway
	# doesn't leave an orphan Address / LMS Payment row behind.
	controller = get_controller(payment_gateway) if total_amount > 0 else None

	payment = record_payment(
		address,
		doctype,
		docname,
		amount,
		original_amount,
		currency,
		amount_with_gst,
		discount_amount,
		payment_for_certificate,
		coupon_code,
		coupon,
	)

	if total_amount <= 0:
		frappe.db.set_value("LMS Payment", payment.name, "payment_received", 1)
		complete_enrollment(payment.name, doctype, docname)
		return redirect_to

	payment_details = {
		"amount": total_amount,
		"title": f"Payment for {doctype} {title} {docname}",
		"description": f"{address.billing_name}'s payment for {title}",
		"reference_doctype": doctype,
		"reference_docname": docname,
		"payer_email": frappe.session.user,
		"payer_name": address.billing_name,
		"currency": currency,
		"payment_gateway": payment_gateway,
		"redirect_to": redirect_to,
		"payment": payment.name,
	}

	create_order(payment_gateway, payment_details, controller)
	url = controller.get_payment_url(**payment_details)

	return url


def create_order(payment_gateway: str, payment_details: dict, controller: object):
	if payment_gateway != "Razorpay":
		return

	order = controller.create_order(**payment_details)
	payment_details.update({"order_id": order.get("id")})


def get_amount_with_gst(amount: float, gst_amount: float) -> float:
	amount_with_gst = 0
	if gst_amount:
		amount_with_gst = amount + gst_amount

	return amount_with_gst


def record_payment(
	address: dict,
	doctype: str,
	docname: str,
	amount: float,
	original_amount: float,
	currency: str,
	amount_with_gst: float = 0,
	discount_amount: float = 0,
	payment_for_certificate: int = 0,
	coupon_code: str | None = None,
	coupon: str | None = None,
):
	address = frappe._dict(address)
	address_name = save_address(address)

	payment_doc = frappe.new_doc("LMS Payment")
	payment_doc.update(
		{
			"member": frappe.session.user,
			"billing_name": address.billing_name,
			"address": address_name,
			"amount": amount,
			"currency": currency,
			"discount_amount": discount_amount,
			"amount_with_gst": amount_with_gst,
			"gstin": address.gstin,
			"pan": address.pan,
			"source": address.source,
			"payment_for_document_type": doctype,
			"payment_for_document": docname,
			"payment_for_certificate": payment_for_certificate,
			"member_consent": address.member_consent,
		}
	)
	if coupon_code:
		payment_doc.update(
			{
				"coupon": coupon,
				"coupon_code": coupon_code,
				"discount_amount": discount_amount,
				"original_amount": original_amount,
			}
		)

	payment_doc.save(ignore_permissions=True)
	return payment_doc


def get_redirect_url(doctype: str, docname: str, payment_for_certificate: int) -> str:
	if int(payment_for_certificate):
		return get_lms_route(f"courses/{docname}/certification")
	elif doctype == "LMS Course":
		return get_lms_route(f"courses/{docname}")
	else:
		return get_lms_route(f"batches/{docname}")


def save_address(address: dict) -> str:
	filters = {"email_id": frappe.session.user}
	exists = frappe.db.exists("Address", filters)
	if exists:
		address_doc = frappe.get_last_doc("Address", filters=filters)
	else:
		address_doc = frappe.new_doc("Address")

	address_doc.update(address)
	address_doc.update(
		{
			"address_title": frappe.db.get_value("User", frappe.session.user, "full_name"),
			"address_type": "Billing",
			"is_primary_address": 1,
			"email_id": frappe.session.user,
		}
	)
	address_doc.save(ignore_permissions=True)
	return address_doc.name
