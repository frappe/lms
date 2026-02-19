import frappe


def execute():
	frappe.db.set_value("LMS Settings", None, "allow_job_posting", 1)
