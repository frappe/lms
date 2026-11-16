import frappe

from lms.lms.ai import goals
from lms.lms.home import _skills
from lms.lms.test_helpers import BaseTestUtils


class TestGoalTitleSync(BaseTestUtils):
	"""Renaming a skill renames it everywhere the learner sees it."""

	def test_a_rename_reaches_the_assignment_and_the_home(self):
		frappe.set_user("Administrator")
		learner = self._create_user("title.sync@example.com", "Title", "Sync", roles=["LMS Student"])
		name = goals.create_goal("POSH Policy", "Handle a complaint")
		frappe.db.set_value("LMS Goal", name, "status", "Published")
		assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": name, "member": learner.name}
		).insert()
		self.assertEqual(assignment.goal_title, "POSH Policy")

		goal = frappe.get_doc("LMS Goal", name)
		goal.title = "Handle a harassment complaint the right way"
		goal.save()

		self.assertEqual(
			frappe.db.get_value("LMS Goal Assignment", assignment.name, "goal_title"),
			"Handle a harassment complaint the right way",
		)
		titles = [item["title"] for item in _skills(learner.name)]
		self.assertIn("Handle a harassment complaint the right way", titles)
		self.assertNotIn("POSH Policy", titles)
