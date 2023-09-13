import frappe


def execute():
	certificates = frappe.get_all("LMS Certificate", pluck="name")

	for certificate in certificates:
		frappe.db.set_value("LMS Certificate", certificate, "published", 1)
