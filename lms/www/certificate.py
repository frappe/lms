import frappe
from urllib.parse import quote


def get_context(context):
	context.no_cache = 1
	template = frappe.db.get_value(
		"LMS Certificate", frappe.form_dict.certificate_id, "template"
	)
	certificate_id = frappe.form_dict.certificate_id
	template = quote(template)

	frappe.local.flags.redirect_location = f"/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name={certificate_id}&format={template}"
	raise frappe.Redirect
