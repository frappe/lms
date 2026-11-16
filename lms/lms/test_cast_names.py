import json

import frappe

from lms.lms.ai import characters, goals
from lms.lms.test_helpers import BaseTestUtils


class TestCastNames(BaseTestUtils):
	"""A role-play partner always has a name on screen, whichever path wrote the plan."""

	def test_name_cast_fills_the_name_from_the_cast_and_keeps_a_given_one(self):
		self.assertEqual(characters.name_cast({"cast": "quilla"})["character"], "Quilla")
		self.assertEqual(characters.name_cast({"cast": "quilla", "character": "Q"})["character"], "Q")
		self.assertNotIn("character", characters.name_cast({"cast": "nobody"}))
		self.assertNotIn("character", characters.name_cast({}))

	def test_the_learner_view_names_a_partner_an_older_plan_left_nameless(self):
		frappe.set_user("Administrator")
		goal = frappe.get_doc(
			{
				"doctype": "LMS Goal",
				"title": "Cast names skill",
				"activities": [
					{
						"activity_type": "Role-play",
						"title": "A visitor at the door",
						"content": json.dumps(
							{
								"cast": "brannoc",
								"character_role": "Visitor",
								"setting": "Reception",
								"rubric": [],
							}
						),
					}
				],
			}
		).insert()
		row = goal.activities[0]
		view = goals._learner_view(0, row, None)
		self.assertEqual(view["content"]["character"], "Brannoc")
