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

	# Find coupon by code and applicable reference
	coupon = frappe.db.exists(
		"LMS Coupon",
		{
			"coupon_code": coupon_code,
			"applicable_to": reference_doctype,
			"applicable_reference": reference_name,
		},
	)

	if not coupon:
		return {
			"valid": False,
			"message": f"Invalid coupon code for this {reference_doctype.replace('LMS ', '').lower()}",
		}

	coupon_doc = frappe.get_doc("LMS Coupon", coupon)

	try:
		# Use the new calculate_discount method which includes all validations
		discount_amount = coupon_doc.calculate_discount(reference_doctype, reference_name)
		original_amount = float(amount)
		discounted_amount = original_amount - discount_amount

		return {
			"valid": True,
			"discount_amount": discount_amount,
			"discounted_amount": max(0, discounted_amount),
			"coupon_name": coupon_doc.name,
			"discount_type": coupon_doc.discount_type,
			"discount_value": coupon_doc.discount_value,
		}
	except frappe.ValidationError as e:
		return {"valid": False, "message": str(e)}


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

	# Process coupon if provided
	if coupon_code:
		coupon_result = validate_coupon(coupon_code, doctype, docname, amount)
		if not coupon_result.get("valid"):
			frappe.throw(coupon_result.get("message", "Invalid coupon"))
		
		# Apply coupon discount
		discount_amount = coupon_result["discount_amount"]
		amount = coupon_result["discounted_amount"]
		coupon_name = coupon_result["coupon_name"]
		
		# Recalculate total amount with GST if applicable
		total_amount = _calculate_total_with_gst(amount, original_amount, original_total_amount)

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


def _calculate_total_with_gst(discounted_amount, original_amount, original_total_amount):
	"""Calculate total amount including GST after applying discount"""
	if original_total_amount > original_amount:
		gst_amount = original_total_amount - original_amount
		gst_percentage = gst_amount / original_amount if original_amount > 0 else 0
		return discounted_amount + (discounted_amount * gst_percentage)
	else:
		return discounted_amount
