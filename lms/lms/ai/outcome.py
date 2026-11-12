"""Suggesting what a skill's learners should be able to do, from its material, for the admin to edit."""

import frappe
from frappe import _

from lms.lms.ai import material, setup

SUGGESTED = "lms_goal_outcome:{session}"


def suggest(goal_name: str) -> str:
	"""Ask the outcome writer for a draft. Returns the Flow Session it works in."""
	from frappe.flow.lib.session import new_session

	from lms.lms.ai.goals import UNTITLED, _material_for

	goal = frappe.get_doc("LMS Goal", goal_name)
	if material.is_reading(goal.name):
		frappe.throw(_("Still reading your material. Try again once it's done."), title=_("Still Reading"))
	if not material.goal_sources(goal.name):
		frappe.throw(
			_("Add your material first, so the suggestion comes from it."), title=_("No Material Yet")
		)
	setup.ensure_agents()
	session = new_session(
		setup.OUTCOME_WRITER, title=_("Outcome for {0}").format(goal.title), approval_mode="Auto-approve"
	)
	session.chat(
		"\n".join(
			[
				f"Goal: {goal.name}",
				f"Title: {goal.title if goal.title != UNTITLED else 'Not set'}",
				f"What the admin wrote so far: {(goal.outcome or '').strip() or 'Nothing yet'}",
				"",
				"Material:",
				_material_for(goal),
			]
		)
	)
	return session.name


def offer(goal_name: str, session: str, options: list[dict]) -> None:
	"""Keep the options for the admin's page to pick up; the goal itself is not changed."""
	options = [
		{"label": option["label"].strip(), "outcome": option["outcome"].strip()}
		for option in options
		if option.get("outcome", "").strip()
	]
	frappe.cache.set_value(
		SUGGESTED.format(session=session),
		{"goal": goal_name, "options": options},
		expires_in_sec=60 * 60,
	)


def state(session: str) -> dict:
	"""Whether the suggestion is still being written, and the text or a plain error once it ends."""
	from frappe.flow.lib.session import sync_with_retry

	from lms.lms.ai.goals import friendly_error

	suggestion = frappe.cache.get_value(SUGGESTED.format(session=session))
	if suggestion:
		return {"running": False, "options": suggestion["options"], "error": None}
	sync_with_retry(frappe.get_doc("Flow Session", session))
	run = frappe.db.get_value(
		"Flow Run",
		{"session": session},
		["status", "error", "output"],
		as_dict=True,
		order_by="creation desc",
	)
	if not run or run.status not in ("Completed", "Failed", "Denied"):
		return {"running": True, "options": [], "error": None}
	# A writer that declines says why, such as material that doesn't cover the skill, and that
	# reason is the most useful thing the admin can read.
	reason = (run.output or "").strip() if run.status == "Completed" else ""
	return {
		"running": False,
		"options": [],
		"error": friendly_error(run.error) or reason or _("No suggestion came through. Try again."),
	}
