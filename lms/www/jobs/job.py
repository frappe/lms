import frappe


def get_context(context):
	try:
		job = frappe.form_dict["job"]
	except KeyError:
		frappe.local.flags.redirect_location = "/jobs"
		raise frappe.Redirect
	context.job = frappe.get_doc("Job Opportunity", job)
