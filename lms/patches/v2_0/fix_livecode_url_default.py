import frappe


def execute():
	livecode_url = frappe.db.get_single_value("LMS Settings", "livecode_url")
	if livecode_url == "https://falcon.frappe.io/":
		frappe.db.set_single_value("LMS Settings", "livecode_url", "https://falcon.frappe.io")
