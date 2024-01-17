import frappe


def get_context(context):
	context.jobs = frappe.get_all(
		"Job Opportunity",
		{"status": "Open", "disabled": False},
		["job_title", "location", "type", "company_name", "company_logo", "name", "creation"],
		order_by="creation desc",
	)
	context.title = frappe.db.get_single_value("Job Settings", "title")
	context.subtitle = frappe.db.get_single_value("Job Settings", "subtitle")
	context.allow_posting = frappe.db.get_single_value("Job Settings", "allow_posting")
