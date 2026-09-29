import frappe


def execute():
	"""`hidden` defaults to 1 for new cases. The column is added by the model sync of
	the same migrate, so every row flagged here predates it and is pinned to 0 to keep
	live exercises' feedback. One statement in the migrate's transaction: a few rows
	per exercise, and a partial commit would leave some exercises half-hidden."""
	if not frappe.db.table_exists("LMS Test Case"):
		return

	frappe.db.set_value("LMS Test Case", {"hidden": 1}, "hidden", 0, update_modified=False)
