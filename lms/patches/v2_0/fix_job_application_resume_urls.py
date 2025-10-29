import frappe


def execute():
	applications = frappe.get_all("LMS Job Application", fields=["name", "resume"])

	for application in applications:
		if application.resume and not application.resume.startswith("/files/"):
			file_doc = frappe.db.get_value(
				"File", {"file_name": application.resume}, ["file_url", "name"], as_dict=True
			)

			if file_doc and file_doc.file_url:
				frappe.db.set_value("LMS Job Application", application.name, "resume", file_doc.file_url)
