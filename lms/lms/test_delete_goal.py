import frappe

from lms.lms.ai import goals
from lms.lms.ai.api import delete_goal
from lms.lms.test_helpers import BaseTestUtils


class TestDeleteGoal(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.moderator = self._create_user(
			"delete.moderator@example.com", "Delete", "Moderator", roles=["Moderator"]
		)
		self.learner = self._create_user(
			"delete.learner@example.com", "Delete", "Learner", roles=["LMS Student"]
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _goal_with_everything(self) -> str:
		# create_goal gives the skill its knowledge base
		goal = goals.create_goal("Forklift safety check", "Run a safety check before using a forklift")
		assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": goal, "member": self.learner.name}
		).insert()
		frappe.get_doc({"doctype": "LMS Goal Evidence", "goal": goal, "assignment": assignment.name}).insert()
		return goal

	def test_a_moderator_deletes_the_skill_with_all_it_owns(self):
		goal = self._goal_with_everything()
		kb = frappe.db.get_value("LMS Goal", goal, "knowledge_base")

		frappe.set_user(self.moderator.name)
		delete_goal(goal)

		self.assertFalse(frappe.db.exists("LMS Goal", goal))
		self.assertFalse(frappe.db.exists("LMS Goal Assignment", {"goal": goal}))
		self.assertFalse(frappe.db.exists("LMS Goal Evidence", {"goal": goal}))
		self.assertFalse(frappe.db.exists("Flow Knowledge Base", kb))

	def test_a_learner_cannot_delete_a_skill(self):
		goal = self._goal_with_everything()

		frappe.set_user(self.learner.name)
		self.assertRaises(frappe.PermissionError, delete_goal, goal)
		self.assertTrue(frappe.db.exists("LMS Goal", goal))

	def test_a_skill_titled_new_keeps_the_builder_route_free(self):
		goal = goals.create_goal("New")
		self.assertNotEqual(goal, "new")
