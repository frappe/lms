"""An admin sends a learner back through a lesson, or through the whole skill."""

import frappe
from frappe import _

from lms.lms.ai import goals, ideas


def reset_lesson(assignment_name: str, index: int) -> dict:
	"""Clear one lesson, so the learner takes it again from the start, key ideas unticked."""
	assignment = frappe.get_doc("LMS Goal Assignment", assignment_name)
	activities = frappe.get_doc("LMS Goal", assignment.goal).activities
	if not 0 <= index < len(activities) or activities[index].activity_type != "Lesson":
		frappe.throw(_("Only a lesson can be reset on its own."), title=_("Not a Lesson"))
	_delete_evidence({"assignment": assignment.name, "activity_index": index})
	ideas.forget_confirmations(assignment.name)
	# A sign-off vouched for the work as it was; with a lesson to take again, it is given again.
	assignment.db_set("signed_off_by", None)
	return goals.refresh_assignment(assignment.name)


def reset_progress(assignment_name: str) -> dict:
	"""Send the learner back to the first step of the skill, as if new to it: they stay assigned
	with the same due date, but what they told Lumi about their work goes too, so the next
	lesson does not bring back stories from the one that was reset."""
	assignment = frappe.get_doc("LMS Goal Assignment", assignment_name)
	_delete_evidence({"assignment": assignment.name})
	assignment.db_set(
		{
			"idea_state": None,
			"learner_situations": None,
			"check_selection": None,
			"tutor_session": None,
			"started_on": None,
			"ready_on": None,
			"acknowledged_on": None,
			"signed_off_by": None,
		}
	)
	return goals.refresh_assignment(assignment.name)


def _delete_evidence(filters: dict) -> None:
	for name in frappe.get_all("LMS Goal Evidence", filters=filters, pluck="name"):
		# nosemgrep: lms-unjustified-ignore-permissions - the caller checked the learning admin role; Moderators may not hold delete on every row
		frappe.delete_doc("LMS Goal Evidence", name, ignore_permissions=True)
