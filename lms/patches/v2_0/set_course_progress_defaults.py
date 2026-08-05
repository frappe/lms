import frappe


def execute():
	"""Backfill Course Progress defaults on existing LMS Settings singletons.

	These fields were added to the `LMS Settings` Single with docfield defaults
	(dwell 30s, enforcement on), but Frappe applies docfield defaults only when a
	doc is first created. Pre-existing singletons never stored these fields, so the
	Settings UI showed a blank dwell time and "off" toggles instead of the intended
	defaults.

	Guard on row existence in `tabSingles` (i.e. the field was never stored), not
	on the value: `frappe.db.get_single_value` cint-coerces unset Int/Check fields
	to 0, so a value-based `is None` check would never match. Existence-guarding
	keeps the patch idempotent and never overwrites a choice an admin has saved.
	"""
	defaults = {
		"lesson_dwell_time": 30,
		"enforce_video_completion": 1,
		"enforce_quiz_completion": 1,
		"enforce_assignment_completion": 1,
	}
	stored = {
		d.field
		for d in frappe.db.sql(
			"""select field from tabSingles
			   where doctype = 'LMS Settings' and field in %(fields)s""",
			{"fields": tuple(defaults)},
			as_dict=True,
		)
	}
	for field, value in defaults.items():
		if field not in stored:
			frappe.db.set_single_value("LMS Settings", field, value)
