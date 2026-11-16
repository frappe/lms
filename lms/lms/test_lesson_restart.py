import json

import frappe

from lms.lms.ai import goals, ideas
from lms.lms.test_helpers import BaseTestUtils


class TestLessonRestart(BaseTestUtils):
	"""A lesson left half way starts again from nothing; a finished one stays finished."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.learner = self._create_user(
			"restart.learner@example.com", "Restart", "Learner", roles=["LMS Student"]
		)
		name = goals.create_goal("Restart skill", "Leave the building calmly")
		goal = frappe.get_doc("LMS Goal", name)
		goal.append("activities", {"activity_type": "Lesson", "title": "The alarm", "content": "{}"})
		goal.save()
		self.assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": name, "member": self.learner.name}
		).insert()
		self.activity = goal.activities[0]

	def _evidence(self, **values):
		goals._save_evidence(self.assignment, 0, self.activity, **values)

	def test_forgetting_unticks_ideas_but_keeps_misses(self):
		self.assignment.db_set("idea_state", json.dumps({"0": {"confirmed": True, "misses": 2}}))
		ideas.forget_confirmations(self.assignment.name)
		state = json.loads(frappe.db.get_value("LMS Goal Assignment", self.assignment.name, "idea_state"))
		self.assertEqual(state, {"0": {"misses": 2}})

	def test_a_finished_lesson_stays_finished_when_taken_again(self):
		self._evidence(status="Graded", passed=1, flow_session=None)
		self._evidence(flow_session=None)
		row = frappe.db.get_value(
			"LMS Goal Evidence",
			{"assignment": self.assignment.name, "activity_index": 0},
			["status", "passed"],
			as_dict=True,
		)
		self.assertEqual((row.status, row.passed), ("Graded", 1))
