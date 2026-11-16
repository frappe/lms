import frappe
from frappe.utils import cint

PASSING_FIELDS = ("enforce_quiz_passing", "enforce_open_ended_quiz_passing")


def execute():
	"""Keep both quiz passing switches on where quizzes gate completion: before this
	change every gated quiz, open-ended included, needed a pass. Only fills switches
	never stored."""
	stored = frappe.db.get_singles_dict("LMS Settings")
	if not cint(stored.get("enforce_quiz_completion")):
		return
	for field in PASSING_FIELDS:
		if field not in stored:
			frappe.db.set_single_value("LMS Settings", field, 1)
