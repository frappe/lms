import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_certificate")
	default_certificate_template = frappe.db.get_value(
		"Property Setter",
		{
			"doc_type": "LMS Certificate",
			"property": "default_print_format",
		},
		"value",
	)

	if frappe.db.exists("Print Format", default_certificate_template):
		certificates = frappe.get_all("LMS Certificate", pluck="name")
		for certificate in certificates:
			frappe.db.set_value(
				"LMS Certificate", certificate, "template", default_certificate_template
			)
