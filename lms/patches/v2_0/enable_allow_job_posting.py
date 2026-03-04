import frappe


def execute():
	frappe.db.set_single_value("LMS Settings", "allow_job_posting", 1)
