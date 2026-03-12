import frappe


def execute():
	evaluator_users = frappe.get_all("Course Evaluator", pluck="evaluator")

	# Add Batch Evaluator role to all Course Evaluator users
	for user in evaluator_users:
		if not frappe.db.exists("Has Role", {"parent": user, "role": "Batch Evaluator"}):
			doc = frappe.new_doc("Has Role")
			doc.parent = user
			doc.parenttype = "User"
			doc.parentfield = "roles"
			doc.role = "Batch Evaluator"
			doc.save(ignore_permissions=True)

	# Remove Batch Evaluator role from users who are not in Course Evaluator
	stale_users = frappe.get_all(
		"Has Role",
		filters={
			"role": "Batch Evaluator",
			"parent": ["not in", evaluator_users or [""]],
			"parenttype": "User",
		},
		pluck="parent",
	)
	for user in stale_users:
		frappe.db.delete("Has Role", {"parent": user, "role": "Batch Evaluator"})

	for user in set(evaluator_users + stale_users):
		frappe.clear_cache(user=user)
