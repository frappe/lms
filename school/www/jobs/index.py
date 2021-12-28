import frappe

def get_context(context):
    context.jobs = frappe.get_all("Job Opportunity",
        {
            "status": "Approved"
        },
        [
            "job_title", "location", "type", "company_name",
            "company_logo", "name"
        ])

