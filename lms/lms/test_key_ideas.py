import frappe
from frappe.tests import IntegrationTestCase

from lms.lms.ai import goals


class TestKeyIdeas(IntegrationTestCase):
	"""The admin sets how many key ideas the lesson covers; 7 unless they change it."""

	def test_the_count_defaults_to_seven_and_stays_in_range(self):
		goal = frappe._dict(key_ideas=None)
		self.assertEqual(goals.key_idea_count(goal), 7)
		goal.key_ideas = 10
		self.assertEqual(goals.key_idea_count(goal), 10)
		goal.key_ideas = 40
		self.assertEqual(goals.key_idea_count(goal), 12)
		goal.key_ideas = 1
		self.assertEqual(goals.key_idea_count(goal), 3)
