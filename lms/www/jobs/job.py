import frappe


def get_context(context):
	try:
		job = frappe.form_dict["job"]
	except KeyError:
		frappe.local.flags.redirect_location = "/jobs"
		raise frappe.Redirect

	context.job = frappe.get_doc("Job Opportunity", job)

	context.metatags = {
		"title": context.job.job_title,
		"image": context.job.company_logo,
		"description": f"Job Posting for {context.job.job_title} by {context.job.company_name}",
		"keywords": "Job Opening, Job Posting, Job Opportunity, Job Vacancy, Job, Vacancy, Opening, Opportunity, Vacancy",
	}
