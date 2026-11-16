import frappe


def execute():
	"""Assignments made before a skill rename reached them still carry the old title."""
	if not frappe.db.table_exists("LMS Goal Assignment"):
		return
	for goal in frappe.get_all("LMS Goal", fields=["name", "title"]):
		frappe.db.set_value(
			"LMS Goal Assignment",
			{"goal": goal.name, "goal_title": ["!=", goal.title]},
			"goal_title",
			goal.title,
			update_modified=False,
		)
