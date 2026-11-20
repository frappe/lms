import json

import frappe
from frappe.flow.lib.tool import ToolContext
from frappe.tests import IntegrationTestCase

from lms.lms.ai import goals, tools


def _row(role: str, content: str | None = None, tool_calls=None, tool_call_id=None) -> dict:
	return frappe._dict(
		role=role,
		content=content,
		tool_calls=json.dumps(tool_calls) if tool_calls else None,
		tool_call_id=tool_call_id,
	)


def _shown_exercise(call_id: str, result: str = "Shown to the learner. Your turn is over.") -> list[dict]:
	return [
		_row("assistant", None, [{"id": call_id, "name": "lms__show_moment", "arguments": {}}]),
		_row("tool", result, tool_call_id=call_id),
	]


class TestOneExercisePerTurn(IntegrationTestCase):
	"""A turn puts one exercise in front of the learner; a second one would replace it unanswered."""

	def setUp(self):
		self.ctx = ToolContext(session_id="turn-test-session", agent="lms/Learning Tutor", user="Guest")
		frappe.cache.set_value(tools._agreed_key(self.ctx.session_id), 1)
		tools.free_turn_moment(self.ctx.session_id)

	def tearDown(self):
		frappe.cache.delete_value(tools._agreed_key(self.ctx.session_id))
		tools.free_turn_moment(self.ctx.session_id)

	def _show(self) -> str:
		return tools.show_moment.func({"kind": "spot"}, ctx=self.ctx)

	def test_a_second_exercise_in_the_same_turn_is_refused(self):
		self.assertFalse(self._show().startswith(tools.NOT_SHOWN))
		second = self._show()
		self.assertTrue(second.startswith(tools.NOT_SHOWN))
		self.assertIn("already on screen", second)

	def test_the_learners_next_message_frees_the_turn(self):
		self._show()
		tools.free_turn_moment(self.ctx.session_id)
		self.assertFalse(self._show().startswith(tools.NOT_SHOWN))

	def test_an_exercise_sent_back_for_a_fix_does_not_use_up_the_turn(self):
		giveaway = {
			"kind": "choose",
			"options": [
				{"text": "Guess.", "correct": False},
				{"text": "Check the written procedure before you change anything at all.", "correct": True},
			],
		}
		self.assertTrue(tools.show_moment.func(giveaway, ctx=self.ctx).startswith(tools.NOT_SHOWN))
		self.assertFalse(self._show().startswith(tools.NOT_SHOWN))


class TestStalledTurn(IntegrationTestCase):
	"""A lesson turn that leaves the learner nothing to answer is caught, and only that turn."""

	def test_a_turn_that_ends_on_a_statement_has_stalled(self):
		rows = [
			_row("user", "BRIEF {}"),
			_row("assistant", "Where does quality show up in your work?"),
			_row("user", 'MOMENT_RESULT {"id": "m4"}'),
			_row("assistant", "You got the first two steps down. Verifying comes last."),
		]
		self.assertTrue(goals.turn_stalled(rows, {}))

	def test_a_question_or_a_shown_exercise_settles_the_turn(self):
		asked = [_row("user", "hi"), _row("assistant", "Good. Ready for an exercise?")]
		self.assertFalse(goals.turn_stalled(asked, {}))
		showed = [_row("user", "yes"), _row("assistant", "Spot on."), *_shown_exercise("m1")]
		self.assertFalse(goals.turn_stalled(showed, {}))

	def test_a_refused_exercise_does_not_settle_the_turn(self):
		rows = [
			_row("user", "yes"),
			_row("assistant", "Here it comes."),
			*_shown_exercise("m1", tools.NOT_SHOWN + "An exercise is already on screen."),
		]
		self.assertTrue(goals.turn_stalled(rows, {}))

	def test_a_question_the_check_cut_still_counts(self):
		text = "Good. What do you do first, and who do you tell?"
		rows = [_row("user", "ok"), _row("assistant", text)]
		self.assertFalse(goals.turn_stalled(rows, {text: "Good. What do you do first?"}))

	def test_the_turn_after_a_nudge_never_asks_for_another(self):
		rows = [
			_row("user", "MOMENT_RESULT {}"),
			_row("assistant", "That's the order."),
			_row("user", goals.KEEP_GOING + goals.SYSTEM_NOTE + goals.KEEP_GOING_NOTE),
			_row("assistant", "And that wraps it up."),
		]
		self.assertFalse(goals.turn_stalled(rows, {}))


class TestRolePlayPoints(IntegrationTestCase):
	"""The points a role-play's learner has covered, as the character marks them."""

	def setUp(self):
		self.session = "points-test-session"
		frappe.cache.delete_value(goals._points_key(self.session))

	def tearDown(self):
		frappe.cache.delete_value(goals._points_key(self.session))

	def test_points_add_up_once_each_in_order(self):
		goals.cover_point(self.session, "Guest", 2)
		goals.cover_point(self.session, "Guest", 0)
		self.assertEqual(goals.cover_point(self.session, "Guest", 2), [0, 2])
		self.assertEqual(goals.covered_points(self.session), [0, 2])

	def test_only_the_learner_who_owns_the_session_can_read_them(self):
		with self.assertRaises(frappe.PermissionError):
			goals.roleplay_points(self.session)


class TestTranscriptionHint(IntegrationTestCase):
	"""Whisper is told the names the material uses, so it writes them right."""

	def test_the_names_the_material_uses_come_first(self):
		names = goals.proper_names(
			[
				"Your part in the Frappe QMS. The Quality Manual FRA-QM-01 is kept on Frappe's drive.",
				"QMS audits: every team at Frappe reports incidents to the Quality Team.",
			]
		)
		self.assertEqual(names[:2], ["Frappe", "QMS"])
		self.assertIn("FRA-QM-01", names)
		self.assertNotIn("Your", names)
		self.assertNotIn("The", names)


class TestRolePlayEnding(IntegrationTestCase):
	"""A role-play with points to cover goes on until they are covered, and always ends."""

	content = {"exchanges": 4, "rubric": [{"criterion": "Records it"}, {"criterion": "Plans the fix"}]}

	def test_points_double_the_replies_it_can_take(self):
		self.assertEqual(goals.roleplay_reply_cap(self.content), 8)
		self.assertEqual(goals.roleplay_reply_cap({"exchanges": 8, "rubric": [{}]}), 12)
		self.assertEqual(goals.roleplay_reply_cap({"exchanges": 4}), 4)

	def test_each_reply_names_the_points_still_open(self):
		note = goals.points_note(self.content, [0])
		self.assertIn("1. Plans the fix", note)
		self.assertNotIn("Records it", note)
		self.assertEqual(goals.points_note(self.content, [0, 1]), goals.ALL_COVERED_NOTE)
		self.assertEqual(goals.points_note({"exchanges": 4}, []), "")
