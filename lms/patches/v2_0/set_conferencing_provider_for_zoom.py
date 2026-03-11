import frappe


def execute():
	frappe.db.set_value(
		"LMS Batch",
		{"zoom_account": ["is", "set"]},
		"conferencing_provider",
		"Zoom",
	)
	frappe.db.set_value(
		"LMS Live Class",
		{"zoom_account": ["is", "set"]},
		"conferencing_provider",
		"Zoom",
	)
