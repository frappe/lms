"""Changing one activity of a skill's plan by asking, without rebuilding the rest."""

import json

import frappe
from frappe import _
from frappe.utils import cint

from lms.lms.ai import setup

SAVED = "lms_goal_revision_saved:{session}"


def revise(goal_name: str, index: int, request: str) -> str:
	"""Ask the plan drafter to rework one activity. Returns the Flow Session it works in."""
	from frappe.flow.lib.session import new_session

	from lms.lms.ai.goals import _material_for, material_lines

	request = (request or "").strip()
	if not request:
		frappe.throw(
			_("Say what to change, for example: make the role-play harder."), title=_("Nothing to Change")
		)
	goal = frappe.get_doc("LMS Goal", goal_name)
	row = _row(goal, index)
	setup.ensure_agents()
	session = new_session(
		setup.PLAN_DRAFTER, title=_("Change {0}").format(row.title), approval_mode="Auto-approve"
	)
	session.chat(
		"\n".join(
			[
				"REVISE ONE ACTIVITY",
				f"Goal: {goal.name}",
				f"Activity index: {cint(index)}",
				f"Skill: {goal.title}",
				f"What learners should be able to do: {goal.learner_outcome or goal.outcome or ''}",
				f"The admin's change, in their words: {request}",
				"Current activity:",
				json.dumps(_as_plan_activity(row)),
				"",
				*material_lines(_material_for(goal)),
			]
		)
	)
	return session.name


def save(goal_name: str, index: int, activity: dict, session: str | None = None) -> None:
	"""Replace one activity, keeping its type so the rest of the plan still fits."""
	goal = frappe.get_doc("LMS Goal", goal_name)
	row = _row(goal, index)
	if activity["activity_type"] != row.activity_type:
		frappe.throw(
			_("Keep it a {0}; change only what the admin asked for.").format(row.activity_type),
			title=_("Wrong Activity Type"),
		)
	content = {
		key: value
		for key, value in activity.items()
		if key not in ("activity_type", "title", "summary", "minutes") and value is not None
	}
	row.update(
		{
			"title": activity["title"],
			"summary": activity["summary"],
			"minutes": activity["minutes"],
			"content": json.dumps(content),
		}
	)
	goal.minutes = sum(cint(a.minutes) for a in goal.activities)
	goal.save(ignore_permissions=True)
	if session:
		frappe.cache.set_value(SAVED.format(session=session), 1, expires_in_sec=60 * 60)


def state(session: str) -> dict:
	"""Whether a revision is still running, and a plain error if it ended without saving."""
	from frappe.flow.lib.session import sync_with_retry

	from lms.lms.ai.goals import friendly_error

	sync_with_retry(frappe.get_doc("Flow Session", session))
	run = frappe.db.get_value(
		"Flow Run", {"session": session}, ["status", "error"], as_dict=True, order_by="creation desc"
	)
	if not run or run.status not in ("Completed", "Failed", "Denied"):
		return {"running": True, "error": None}
	if frappe.cache.get_value(SAVED.format(session=session)):
		return {"running": False, "error": None}
	return {
		"running": False,
		"error": friendly_error(run.error)
		or _("The change didn't come through. Try again, or word it differently."),
	}


def _row(goal, index: int):
	index = cint(index)
	if not 0 <= index < len(goal.activities):
		frappe.throw(_("That activity does not exist."), title=_("Invalid Activity"))
	return goal.activities[index]


def _as_plan_activity(row) -> dict:
	return {
		"activity_type": row.activity_type,
		"title": row.title,
		"summary": row.summary,
		"minutes": row.minutes,
		**json.loads(row.content or "{}"),
	}
