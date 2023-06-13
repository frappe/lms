import os

import frappe
from frappe import _


def execute():
	frappe.reload_doc("email", "doctype", "email_template")
	base_path = frappe.get_app_path("lms", "templates", "emails")

	if not frappe.db.exists("Email Template", _("Mentor Request Creation Template")):
		response = frappe.read_file(
			os.path.join(base_path, "mentor_request_creation_email.html")
		)
		frappe.get_doc(
			{
				"doctype": "Email Template",
				"name": _("Mentor Request Creation Template"),
				"response": response,
				"subject": _("Request for Mentorship"),
				"owner": frappe.session.user,
			}
		).insert(ignore_permissions=True)

		frappe.db.set_single_value(
			"LMS Settings",
			"mentor_request_creation",
			_("Mentor Request Creation Template"),
		)

	if not frappe.db.exists("Email Template", _("Mentor Request Status Update Template")):
		response = frappe.read_file(
			os.path.join(base_path, "mentor_request_status_update_email.html")
		)
		frappe.get_doc(
			{
				"doctype": "Email Template",
				"name": _("Mentor Request Status Update Template"),
				"response": response,
				"subject": _("The status of your application has changed."),
				"owner": frappe.session.user,
			}
		).insert(ignore_permissions=True)

		frappe.db.set_single_value(
			"LMS Settings",
			"mentor_request_status_update",
			_("Mentor Request Status Update Template"),
		)
