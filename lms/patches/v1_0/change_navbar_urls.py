import frappe


def execute():
	rename_link("/courses", "/lms/courses")
	rename_link("/batches", "/lms/batches")
	rename_link("/statistics", "/lms/statistics")
	rename_link("/job-openings", "/lms/job-openings")
	delete_link("/people")


def rename_link(source, target):
	link = frappe.db.exists("Top Bar Item", {"url": source})

	if link:
		frappe.db.set_value("Top Bar Item", link, "url", target)


def delete_link(source):
	link = frappe.db.exists("Top Bar Item", {"url": source})

	if link:
		frappe.delete_doc("Top Bar Item", link)
