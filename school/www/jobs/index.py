import frappe

def get_context(context):
    context.jobs = frappe.get_all("Job Opportunity",
        {
            "status": "Open",
            "disabled": False
        },
        [
            "job_title", "location", "type", "company_name",
            "company_logo", "name", "creation"
        ],
        order_by="creation desc")

