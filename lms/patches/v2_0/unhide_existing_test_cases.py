import frappe


def execute():
	"""New cases default to hidden. Rows existing when this post-sync patch runs predate
	the field, so pin them visible to keep live feedback. One statement, no partial
	commits."""
	if not frappe.db.table_exists("LMS Test Case"):
		return

	frappe.db.set_value("LMS Test Case", {"hidden": 1}, "hidden", 0, update_modified=False)
