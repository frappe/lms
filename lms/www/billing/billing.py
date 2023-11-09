import frappe
from frappe import _
from lms.lms.utils import check_multicurrency, apply_gst


def get_context(context):
	module = frappe.form_dict.module
	docname = frappe.form_dict.modulename
	doctype = "LMS Course" if module == "course" else "LMS Batch"

	context.module = module
	context.docname = docname
	context.doctype = doctype

	validate_access(doctype, docname, module)
	get_billing_details(context)

	context.original_currency = context.currency
	context.original_amount = (
		apply_gst(context.amount, None)[0]
		if context.original_currency == "INR"
		else context.amount
	)

	context.exception_country = frappe.get_all(
		"Payment Country", filters={"parent": "LMS Settings"}, pluck="country"
	)

	context.amount, context.currency = check_multicurrency(
		context.amount, context.currency
	)

	context.address = get_address()
	if context.currency == "INR":
		context.amount, context.gst_applied = apply_gst(context.amount, None)


def validate_access(doctype, docname, module):
	if frappe.session.user == "Guest":
		raise frappe.PermissionError(_("Please login to continue with payment."))

	if module not in ["course", "batch"]:
		raise ValueError(_("Module is incorrect."))

	if not frappe.db.exists(doctype, docname):
		raise ValueError(_("Module Name is incorrect or does not exist."))

	if doctype == "LMS Course":
		membership = frappe.db.exists(
			"LMS Enrollment", {"member": frappe.session.user, "course": docname}
		)
		if membership:
			raise frappe.PermissionError(_("You are already enrolled for this course"))

	else:
		membership = frappe.db.exists(
			"Batch Student", {"student": frappe.session.user, "parent": docname}
		)
		if membership:
			raise frappe.PermissionError(_("You are already enrolled for this batch."))


def get_billing_details(context):
	if context.doctype == "LMS Course":
		details = frappe.db.get_value(
			"LMS Course",
			context.docname,
			["title", "name", "paid_course", "course_price as amount", "currency"],
			as_dict=True,
		)

		if not details.paid_course:
			raise frappe.PermissionError(_("This course is free."))

	else:
		details = frappe.db.get_value(
			"LMS Batch",
			context.docname,
			["title", "name", "paid_batch", "amount", "currency"],
			as_dict=True,
		)

		if not details.paid_batch:
			raise frappe.PermissionError(
				_("To join this batch, please contact the Administrator.")
			)

	context.title = details.title
	context.amount = details.amount
	context.currency = details.currency


def get_address():
	address = frappe.get_all(
		"Address",
		{"email_id": frappe.session.user},
		[
			"address_title as billing_name",
			"address_line1",
			"address_line2",
			"city",
			"state",
			"country",
			"pincode",
			"phone",
		],
		order_by="creation desc",
		limit=1,
	)

	if not len(address):
		return None
	else:
		address = address[0]

	if not address.address_line2:
		address.address_line2 = ""

	if not address.state:
		address.state = ""

	return address
