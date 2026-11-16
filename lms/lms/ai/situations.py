"""What a learner told the tutor about their own work, kept on the assignment so every later
conversation can build on it instead of on a cast story."""

import json

import frappe
from frappe.model.document import Document

MAX_SITUATIONS = 5
MAX_LENGTH = 300


def recall(assignment: Document) -> list[str]:
	"""The situations kept so far, oldest first."""
	try:
		kept = json.loads(assignment.get("learner_situations") or "[]")
	except (TypeError, ValueError):
		return []
	return [s for s in kept if isinstance(s, str) and s.strip()]


def remember(assignment_name: str, situation: str) -> list[str]:
	"""Add one situation, once, and keep only the newest few."""
	text = " ".join((situation or "").split())[:MAX_LENGTH]
	assignment = frappe.get_doc("LMS Goal Assignment", assignment_name)
	kept = recall(assignment)
	if text and text.casefold() not in (s.casefold() for s in kept):
		kept = (kept + [text])[-MAX_SITUATIONS:]
		assignment.db_set("learner_situations", json.dumps(kept), update_modified=False)
	return kept
