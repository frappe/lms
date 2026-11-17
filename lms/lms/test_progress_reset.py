import json

import frappe

from lms.lms.ai import api, goals
from lms.lms.test_helpers import BaseTestUtils


class TestProgressReset(BaseTestUtils):
	"""An admin sends a learner back through one lesson, or through the whole skill."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.learner = self._create_user(
			"reset.learner@example.com", "Reset", "Learner", roles=["LMS Student"]
		)
		name = goals.create_goal("Reset skill", "Close a corrective action")
		goal = frappe.get_doc("LMS Goal", name)
		goal.append("activities", {"activity_type": "Lesson", "title": "Root causes", "content": "{}"})
		goal.append("activities", {"activity_type": "Lesson", "title": "Closing out", "content": "{}"})
		goal.save()
		self.goal = goal
		self.assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": name, "member": self.learner.name}
		).insert()
		for index in (0, 1):
			goals._save_evidence(
				self.assignment, index, goal.activities[index], status="Graded", passed=1, flow_session=None
			)
		self.assignment.db_set(
			{
				"idea_state": json.dumps({"0": {"confirmed": True}}),
				"learner_situations": json.dumps(["Runs the audit at the Pune plant"]),
				"signed_off_by": "Administrator",
			}
		)
		goals.refresh_assignment(self.assignment.name)

	def _assignment(self):
		return frappe.get_doc("LMS Goal Assignment", self.assignment.name)

	def _indexes(self):
		return frappe.get_all(
			"LMS Goal Evidence", filters={"assignment": self.assignment.name}, pluck="activity_index"
		)

	def test_a_lesson_reset_clears_only_that_lesson(self):
		result = api.reset_lesson(self.assignment.name, 1)
		self.assertEqual(self._indexes(), [0])
		self.assertEqual((result["progress"], result["current_step"]), (50, 1))
		assignment = self._assignment()
		self.assertEqual(json.loads(assignment.idea_state), {"0": {}})
		self.assertFalse(assignment.signed_off_by)

	def test_only_a_lesson_can_be_reset_on_its_own(self):
		self.goal.activities[1].activity_type = "Check"
		self.goal.save()
		self.assertRaises(frappe.ValidationError, api.reset_lesson, self.assignment.name, 1)
		self.assertRaises(frappe.ValidationError, api.reset_lesson, self.assignment.name, 7)

	def test_a_full_reset_starts_the_skill_again_but_keeps_what_lumi_learned(self):
		result = api.reset_progress(self.assignment.name)
		self.assertEqual(self._indexes(), [])
		self.assertEqual(result["status"], "Assigned")
		assignment = self._assignment()
		self.assertEqual((assignment.progress, assignment.score, assignment.current_step), (0, 0, 0))
		self.assertFalse(assignment.idea_state or assignment.signed_off_by or assignment.started_on)
		self.assertEqual(json.loads(assignment.learner_situations), ["Runs the audit at the Pune plant"])

	def test_a_learner_cannot_reset(self):
		frappe.set_user(self.learner.name)
		self.assertRaises(frappe.PermissionError, api.reset_progress, self.assignment.name)
		self.assertRaises(frappe.PermissionError, api.reset_lesson, self.assignment.name, 0)
