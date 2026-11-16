import json

import frappe
from pydantic import TypeAdapter, ValidationError

from lms.lms.ai import goals, situations
from lms.lms.ai.tools import Moment
from lms.lms.test_helpers import BaseTestUtils

MOMENTS = [
	{
		"kind": "sort",
		"idea": 0,
		"prompt": "Where does each one go?",
		"buckets": ["Report to the IC", "Handle with your manager"],
		"items": [{"text": "Comments on your clothes", "bucket": 0}],
	},
	{
		"kind": "match",
		"idea": 0,
		"prompt": "Who has how long?",
		"pairs": [{"left": "The employer acts", "right": "One month"}],
	},
	{
		"kind": "fill",
		"idea": 0,
		"prompt": "Complete the rule",
		"text": "A complaint goes to the IC within ___.",
		"answers": ["three months"],
	},
	{
		"kind": "reply",
		"idea": 0,
		"prompt": "What do you say?",
		"message": "Who complained?",
		"cast": "quilla",
		"criteria": ["Keeps the names private"],
	},
]


class TestMomentKinds(BaseTestUtils):
	"""The tutor's exercise tool accepts the four new kinds and still refuses an unknown one."""

	def test_each_new_kind_parses(self):
		adapter = TypeAdapter(Moment)
		for moment in MOMENTS:
			self.assertEqual(adapter.validate_python(moment).kind, moment["kind"])

	def test_a_sort_item_must_point_at_a_real_bucket(self):
		moment = dict(MOMENTS[0], items=[{"text": "x", "bucket": 2}])
		with self.assertRaises(ValidationError):
			TypeAdapter(Moment).validate_python(moment)

	def test_a_fill_needs_one_answer_per_blank(self):
		for text, answers in (
			("No blank here", ["x"]),
			("One ___ and two ___", ["x"]),
			("Short __ dash", ["x"]),
		):
			with self.assertRaises(ValidationError, msg=text):
				TypeAdapter(Moment).validate_python(dict(MOMENTS[2], text=text, answers=answers))

	def test_an_unknown_kind_is_refused(self):
		with self.assertRaises(ValidationError):
			TypeAdapter(Moment).validate_python({"kind": "dance", "idea": 0, "prompt": "x"})


class TestLearnerSituations(BaseTestUtils):
	"""What the learner told the tutor about their own work stays with the assignment."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		goal = goals.create_goal("Situations skill", "Handle a worried visitor")
		self.assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": goal, "member": "Administrator"}
		).insert()

	def test_remember_keeps_each_situation_once_and_only_the_newest_few(self):
		name = self.assignment.name
		situations.remember(name, "  A visitor shouted at me   at the front desk. ")
		situations.remember(name, "a visitor shouted at me at the front desk.")
		for n in range(situations.MAX_SITUATIONS):
			situations.remember(name, f"Situation {n}")

		kept = situations.recall(frappe.get_doc("LMS Goal Assignment", name))
		self.assertEqual(len(kept), situations.MAX_SITUATIONS)
		self.assertEqual(kept[-1], f"Situation {situations.MAX_SITUATIONS - 1}")
		self.assertNotIn("A visitor shouted at me at the front desk.", kept)

	def test_the_role_play_brief_carries_their_situations(self):
		brief = json.loads(
			goals._roleplay_brief({"cast": "odalie", "character": "Odalie"}, ["My desk faces the door."])[
				len("BRIEF\n") :
			]
		)
		self.assertEqual(brief["the_learners_own_situations"], ["My desk faces the door."])

	def test_recall_survives_bad_data(self):
		self.assignment.learner_situations = "not json"
		self.assertEqual(situations.recall(self.assignment), [])
