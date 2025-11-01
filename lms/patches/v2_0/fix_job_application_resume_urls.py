import frappe


def execute():
	applications = frappe.get_all(
		"LMS Job Application",
		fields=["name", "resume", "job.owner as job_owner"],
		filters={"resume": ["not like", "/files/%"]},
	)

	for application in applications:
		if not application.resume:
			continue

		file_name = frappe.db.get_value(
			"File", {"file_name": application.resume, "attached_to_name": ["is", "not set"]}, "name"
		)

		if file_name:
			file_doc = frappe.get_doc("File", file_name)

			file_doc.is_private = 1
			file_doc.attached_to_doctype = "LMS Job Application"
			file_doc.attached_to_name = application.name
			file_doc.attached_to_field = "resume"
			file_doc.save()

			if application.job_owner:
				frappe.share.add_docshare(
					"LMS Job Application", application.name, application.job_owner, read=1
				)
