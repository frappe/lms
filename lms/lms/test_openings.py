from unittest.mock import patch

import frappe

from lms.lms.ai import goals, openings, reset
from lms.lms.test_helpers import BaseTestUtils


class TestOpenings(BaseTestUtils):
	"""A lesson's opening is written while its start screen shows, and Start takes that session."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.learner = self._create_user(
			"opening.learner@example.com", "Opening", "Learner", roles=["LMS Student"]
		)
		name = goals.create_goal("Opening skill", "Close a corrective action")
		goal = frappe.get_doc("LMS Goal", name)
		goal.append("activities", {"activity_type": "Lesson", "title": "Root causes", "content": "{}"})
		goal.append("activities", {"activity_type": "Check", "title": "Check", "content": "{}"})
		goal.save()
		self.assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": name, "member": self.learner.name}
		).insert()
		frappe.set_user(self.learner.name)
		self.opened = []
		self.patches = [
			patch.object(goals, "_open_lesson", side_effect=self._open),
			patch.object(goals, "_opening", return_value="Hi, I'm Lumi."),
		]
		for p in self.patches:
			p.start()

	def tearDown(self):
		for p in self.patches:
			p.stop()
		frappe.set_user("Administrator")
		frappe.cache.delete_keys(f"lms:opening:{self.assignment.name}:")
		super().tearDown()

	def _open(self, *args):
		# nosemgrep: lms-unjustified-ignore-permissions - stands in for Flow's new_session, which inserts the same way
		session = frappe.get_doc(
			{"doctype": "Flow Session", "agent": "lms/Learning Tutor", "title": "Root causes"}
		).insert(ignore_permissions=True)
		self.opened.append(session.name)
		return session

	def test_start_takes_the_session_prepared_on_the_start_screen(self):
		self.assertEqual(goals.prepare_conversation(self.assignment.name, 0), {"opening": "Hi, I'm Lumi."})
		goals.prepare_conversation(self.assignment.name, 0)  # the screen asks again until it is written
		self.assertEqual(goals.start_teaching(self.assignment.name, 0), self.opened[0])
		self.assertEqual(len(self.opened), 1)

	def test_a_second_start_opens_a_new_conversation(self):
		goals.prepare_conversation(self.assignment.name, 0)
		goals.start_teaching(self.assignment.name, 0)
		self.assertNotEqual(goals.start_teaching(self.assignment.name, 0), self.opened[0])

	def test_a_reset_drops_the_waiting_opening(self):
		goals.prepare_conversation(self.assignment.name, 0)
		frappe.set_user("Administrator")
		reset.reset_progress(self.assignment.name)
		frappe.set_user(self.learner.name)
		self.assertIsNone(openings.take(self.assignment.name, 0))

	def test_only_a_conversation_is_prepared(self):
		self.assertRaises(frappe.ValidationError, goals.prepare_conversation, self.assignment.name, 1)
