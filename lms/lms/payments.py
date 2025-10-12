import frappe


def get_payment_gateway():
	return frappe.db.get_single_value("LMS Settings", "payment_gateway")


def get_controller(payment_gateway):
	if "payments" in frappe.get_installed_apps():
		from payments.utils import get_payment_gateway_controller

		return get_payment_gateway_controller(payment_gateway)


def validate_currency(payment_gateway, currency):
	controller = get_controller(payment_gateway)
	controller().validate_transaction_currency(currency)


@frappe.whitelist()
def get_payment_link(
    doctype,
    docname,
    title,
    amount,
    total_amount,
    currency,
    address,
    redirect_to,
    payment_for_certificate,
    coupon_code=None,
):
	payment_gateway = get_payment_gateway()
	address = frappe._dict(address)
    amount_with_gst = total_amount if total_amount != amount else 0

    coupon_context = None
    # Coupon application only for courses/batches
    if doctype in ["LMS Course", "LMS Batch"] and coupon_code:
        try:
            from lms.lms.utils import apply_coupon

            applied = apply_coupon(doctype, docname, coupon_code)
            # Override total_amount based on validated coupon calculation
            total_amount = applied.get("amount", total_amount)
            coupon_context = applied
        except Exception:
            # Ignore coupon errors here; frontend handles validation
            pass

    payment = record_payment(
        address,
        doctype,
        docname,
        amount,
        currency,
        amount_with_gst,
        payment_for_certificate,
        coupon_context,
    )
	controller = get_controller(payment_gateway)

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
	if payment_gateway == "Razorpay":
		order = controller.create_order(**payment_details)
		payment_details.update({"order_id": order.get("id")})

	url = controller.get_payment_url(**payment_details)

	return url


def record_payment(
    address,
    doctype,
    docname,
    amount,
    currency,
    amount_with_gst=0,
    payment_for_certificate=0,
    coupon_context=None,
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
			"amount_with_gst": amount_with_gst,
			"gstin": address.gstin,
			"pan": address.pan,
			"source": address.source,
			"payment_for_document_type": doctype,
			"payment_for_document": docname,
			"payment_for_certificate": payment_for_certificate,
		}
	)
    if coupon_context:
        payment_doc.update(
            {
                "coupon": coupon_context.get("coupon"),
                "discount_type": coupon_context.get("discount_type"),
                "discount_percent": coupon_context.get("discount_percent"),
                "discount_amount": coupon_context.get("discount_amount"),
            }
        )
	payment_doc.save(ignore_permissions=True)
	return payment_doc


def save_address(address):
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
