import frappe


def execute():
	"""Course Creators and Batch Evaluators pick users through select; they do not
	open profiles. Earlier installs gave them read on User, and create_role never
	revisits a row that exists, so take read back here. At most one row per role."""
	rows = frappe.get_all(
		"Custom DocPerm",
		{
			"parent": "User",
			"permlevel": 0,
			"role": ["in", ("Course Creator", "Batch Evaluator")],
			"read": 1,
		},
		pluck="name",
	)
	for name in rows:
		frappe.db.set_value("Custom DocPerm", name, {"read": 0, "select": 1})
	if rows:
		frappe.clear_cache(doctype="User")
