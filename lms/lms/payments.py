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
def validate_coupon(coupon_code, reference_doctype, reference_name, amount):
	"""Validate coupon and return discount details"""
	if not coupon_code:
		return {"valid": False, "message": "Coupon code is required"}

	if reference_doctype == "LMS Course":
		applicable_to = "Course"
		field_name = "course"
	elif reference_doctype == "LMS Batch":
		applicable_to = "Batch"
		field_name = "batch"
	else:
		return {"valid": False, "message": "Invalid reference doctype"}

	coupon = frappe.db.exists(
		"LMS Coupon",
		{
			"coupon_code": coupon_code,
			"applicable_to": applicable_to,
			field_name: reference_name,
		},
	)

	if not coupon:
		return {
			"valid": False,
			"message": f"Invalid coupon code for this {applicable_to.lower()}",
		}

	coupon_doc = frappe.get_doc("LMS Coupon", coupon)

	can_use, message = coupon_doc.can_use_coupon()
	if not can_use:
		return {"valid": False, "message": message}

	discount_amount = coupon_doc.calculate_discount(float(amount))
	discounted_amount = float(amount) - discount_amount

	return {
		"valid": True,
		"discount_amount": discount_amount,
		"discounted_amount": max(0, discounted_amount),
		"coupon_name": coupon_doc.name,
		"discount_type": coupon_doc.discount_type,
		"discount_value": coupon_doc.discount_value,
	}


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

	# Handle coupon discount
	original_amount = float(amount)
	original_total_amount = float(total_amount)
	discount_amount = 0
	coupon_name = None

	if coupon_code:
		coupon_result = validate_coupon(coupon_code, doctype, docname, amount)
		if coupon_result.get("valid"):
			discount_amount = coupon_result["discount_amount"]
			amount = coupon_result["discounted_amount"]
			coupon_name = coupon_result["coupon_name"]

			if original_total_amount > original_amount:
				gst_amount = original_total_amount - original_amount
				gst_percentage = gst_amount / original_amount if original_amount > 0 else 0
				total_amount = amount + (amount * gst_percentage)
			else:
				total_amount = amount
		else:
			frappe.throw(coupon_result.get("message", "Invalid coupon"))

	amount_with_gst = total_amount if total_amount != amount else 0

	payment = record_payment(
		address,
		doctype,
		docname,
		amount,
		currency,
		amount_with_gst,
		payment_for_certificate,
		coupon_code=coupon_name,
		discount_amount=discount_amount,
		original_amount=original_amount,
	)

	# If coupon was used, increment its usage count
	if coupon_name:
		coupon_doc = frappe.get_doc("LMS Coupon", coupon_name)
		coupon_doc.increment_usage()

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
	coupon_code=None,
	discount_amount=0,
	original_amount=0,
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
			"coupon_code": coupon_code,
			"discount_amount": discount_amount,
			"original_amount": original_amount if original_amount > 0 else amount,
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
