import frappe


def execute():
	topics = frappe.get_all(
		"Discussion Topic",
		{"title": ["is", "not set"]},
		["name", "reference_docname", "title"],
	)

	for topic in topics:
		if not topic.title:
			frappe.db.set_value("Discussion Topic", topic.name, "title", topic.reference_docname)
