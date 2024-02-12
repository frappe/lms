import frappe


def execute():
	jobs_link = frappe.db.exists(
		"Top Bar Item",
		{
			"label": "Jobs",
			"url": "/jobs",
			"parent_label": "Explore",
		},
	)

	if jobs_link:
		frappe.db.set_value("Top Bar Item", jobs_link, "url", "/job-openings")
