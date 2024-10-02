# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_url_to_list


class LMSSettings(Document):
	def validate(self):
		self.validate_google_settings()

	def validate_google_settings(self):
		if self.send_calendar_invite_for_evaluations:
			google_settings = frappe.get_single("Google Settings")

			if not google_settings.enable:
				frappe.throw(
					_("Enable Google API in Google Settings to send calendar invites for evaluations.")
				)

			if not google_settings.client_id or not google_settings.client_secret:
				frappe.throw(
					_(
						"Enter Client Id and Client Secret in Google Settings to send calendar invites for evaluations."
					)
				)

			calendars = frappe.db.count("Google Calendar")
			if not calendars:
				frappe.throw(
					_(
						"Please add <a href='{0}'>{1}</a> for <a href='{2}'>{3}</a> to send calendar invites for evaluations."
					).format(
						get_url_to_list("Google Calendar"),
						frappe.bold("Google Calendar"),
						get_url_to_list("Course Evaluator"),
						frappe.bold("Course Evaluator"),
					)
				)


@frappe.whitelist()
def check_payments_app():
	installed_apps = frappe.get_installed_apps()
	if "payments" not in installed_apps:
		return False
	else:
		filters = {
			"doctype_or_field": "DocField",
			"doc_type": "LMS Settings",
			"field_name": "payment_gateway",
		}
		if frappe.db.exists("Property Setter", filters):
			return True

		link_property = frappe.new_doc("Property Setter")
		link_property.update(filters)
		link_property.property = "fieldtype"
		link_property.value = "Link"
		link_property.save()

		options_property = frappe.new_doc("Property Setter")
		options_property.update(filters)
		options_property.property = "options"
		options_property.value = "Payment Gateway"
		options_property.save()

		return True
