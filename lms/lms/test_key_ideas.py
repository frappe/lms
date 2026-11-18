import json

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

	def test_the_lesson_brief_lists_what_the_practice_tests(self):
		goal = frappe._dict(
			activities=[
				frappe._dict(activity_type="Lesson", content="{}"),
				frappe._dict(
					activity_type="Role-play",
					content=json.dumps(
						{
							"learner_task": "Show the auditor your records",
							"rubric": [{"criterion": "Corrective action", "good": "Names the 45-day plan"}],
						}
					),
				),
				frappe._dict(
					activity_type="Check",
					content=json.dumps(
						{
							"questions": [
								{
									"question": "Where is the manual?",
									"options": ["Drive", "Desk"],
									"answer_index": 0,
								}
							]
						}
					),
				),
			]
		)
		self.assertEqual(
			goals._practice_tests(goal),
			{
				"role_plays": [
					{
						"task": "Show the auditor your records",
						"graded_on": ["Corrective action: Names the 45-day plan"],
					}
				],
				"check_questions": ["Where is the manual? Answer: Drive"],
			},
		)
