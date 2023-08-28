import frappe
from frappe import _


def get_context(context):
	module = frappe.form_dict.module
	docname = frappe.form_dict.modulename

	if frappe.session.user == "Guest":
		raise frappe.PermissionError(_("You are not allowed to access this page."))

	if module not in ["course", "class"]:
		raise ValueError(_("Module is incorrect."))

	doctype = "LMS Course" if module == "course" else "LMS Batch"
	context.module = module
	context.docname = docname
	context.doctype = doctype

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
			raise frappe.PermissionError(_("You are already enrolled for this class"))

	if doctype == "LMS Course":
		course = frappe.db.get_value(
			"LMS Course",
			docname,
			["title", "name", "paid_course", "course_price", "currency"],
			as_dict=True,
		)

		if not course.paid_course:
			raise frappe.PermissionError(_("This course is free."))

		context.title = course.title
		context.amount = course.course_price
		context.currency = course.currency

	else:
		class_info = frappe.db.get_value(
			"LMS Batch",
			docname,
			["title", "name", "paid_class", "amount", "currency"],
			as_dict=True,
		)

		if not class_info.paid_class:
			raise frappe.PermissionError(
				_("To join this class, please contact the Administrator.")
			)

		context.title = class_info.title
		context.amount = class_info.amount
		context.currency = class_info.currency
