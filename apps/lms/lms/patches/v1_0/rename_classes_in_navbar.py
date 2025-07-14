import frappe


def execute():
	frappe.db.set_value(
		"Top Bar Item",
		{"url": "/classes"},
		{
			"label": "Batches",
			"url": "/batches",
		},
	)
