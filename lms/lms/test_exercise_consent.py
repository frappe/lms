import frappe
from frappe.flow.lib.tool import ToolContext
from frappe.tests import IntegrationTestCase

from lms.lms.ai import tools


class TestExerciseConsent(IntegrationTestCase):
	"""Lumi shows no exercise until the learner has said yes to trying some."""

	def setUp(self):
		self.ctx = ToolContext(session_id="consent-test-session", agent="lms/Learning Tutor", user="Guest")
		frappe.cache.delete_value(tools._agreed_key(self.ctx.session_id))

	def _show(self) -> str:
		return tools.show_moment.func({"kind": "choose"}, ctx=self.ctx)

	def test_an_exercise_waits_for_the_learners_yes(self):
		self.assertTrue(self._show().startswith(tools.NOT_SHOWN))
		tools.begin_exercises.func(ctx=self.ctx)
		self.assertFalse(self._show().startswith(tools.NOT_SHOWN))

	def test_an_option_that_gives_the_answer_away_is_sent_back(self):
		tools.begin_exercises.func(ctx=self.ctx)
		options = [
			{"text": "Answer from memory.", "correct": False, "why": "It may be wrong."},
			{
				"text": "Open the Quality Manual on the shared drive and check the policy before you answer.",
				"correct": True,
				"why": "It is the source.",
			},
		]
		moment = {"kind": "choose", "idea": 0, "prompt": "What do you do?", "options": options}
		self.assertTrue(self._show_moment(moment).startswith(tools.NOT_SHOWN))
		options[0]["text"] = "Answer from memory, then check the wording with your manager later."
		self.assertFalse(self._show_moment(moment).startswith(tools.NOT_SHOWN))

	def _show_moment(self, moment: dict) -> str:
		return tools.show_moment.func(moment, ctx=self.ctx)
