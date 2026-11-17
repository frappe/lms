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
