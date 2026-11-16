from urllib.parse import urlencode

import frappe
from frappe import _

from lms.lms.doctype.lms_certificate.lms_certificate import get_default_certificate_template


def get_context(context):
	context.no_cache = 1
	certificate_id = frappe.form_dict.certificate_id
	# A filter list here would match some other certificate.
	certificate = (
		frappe.db.get_value("LMS Certificate", certificate_id, ["name", "template"], as_dict=True)
		if certificate_id and isinstance(certificate_id, str)
		else None
	)
	if not certificate:
		raise frappe.PageDoesNotExistError(_("Certificate not found."))

	# Certificates issued before templates were set on them have none.
	template = certificate.template or get_default_certificate_template()
	if not template:
		frappe.throw(_("No certificate template is set up. Ask a moderator to add one."))

	params = urlencode(
		{"doctype": "LMS Certificate", "name": certificate.name, "format": template, "no_letterhead": 1}
	)
	frappe.local.flags.redirect_location = f"/api/method/frappe.utils.print_format.download_pdf?{params}"
	raise frappe.Redirect
