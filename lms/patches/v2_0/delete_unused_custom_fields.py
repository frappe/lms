import frappe


def execute():
	if "payments" not in frappe.get_installed_apps():
		web_form_custom_fields = frappe.get_all(
			"Custom Field", {"dt": "Web Form"}, ["name", "fieldname"]
		)

		unused_fields = [
			"currency",
			"amount_field",
			"amount_based_on_field",
			"payment_button_help",
			"amount",
			"payments_cb",
			"payment_button_label",
			"payment_gateway",
			"payments_tab",
		]

		for field in web_form_custom_fields:
			if field.fieldname in unused_fields:
				frappe.delete_doc("Custom Field", field.name)
