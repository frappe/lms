from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from lms.lms.ai import goals, one_question


class TestOneQuestion(IntegrationTestCase):
	"""A turn that asks more than one thing reaches the learner asking only the first."""

	def setUp(self):
		frappe.cache.delete_value(one_question._seen_key("one-q-session"))

	def _check(self, replies: list[str]) -> dict:
		with patch.object(one_question, "_latest_turn", return_value=replies):
			return one_question.check_turn("one-q-session")

	def test_only_the_first_ask_is_kept(self):
		self.assertEqual(
			one_question.one_ask("Fine. So which system did you log it in, and what is the reference?"),
			"Fine. So which system did you log it in?",
		)
		self.assertEqual(
			one_question.one_ask("What is the ticket number? And what date was it logged?"),
			"What is the ticket number?",
		)
		either_or = "Do you fix it yourself, or does someone else decide?"
		self.assertEqual(one_question.one_ask(either_or), either_or)

	def test_a_turn_with_one_question_is_left_alone(self):
		self.assertEqual(self._check(["Good catch. Where would you look first?"]), {})
		self.assertEqual(self._check(["Where would you look first? Take your time."]), {})

	def test_a_joined_ask_is_cut(self):
		reply = "Fine. Which system did you log it in, and what is the reference?"
		self.assertEqual(self._check([reply]), {reply: "Fine. Which system did you log it in?"})

	def test_the_reply_stops_at_its_first_question(self):
		reply = "Right. Where is it logged? Who signed it off?"
		self.assertEqual(self._check([reply]), {reply: "Right. Where is it logged?"})

	def test_a_second_message_in_the_turn_loses_its_question(self):
		first, second = "Good. Where did you log it?", "Noted. And who checked your fix?"
		self.assertEqual(self._check([first, second]), {second: "Noted."})

	def test_the_next_message_says_what_the_learner_saw(self):
		self._check(["Right. Where is it logged? Who signed it off?"])
		sent = one_question.with_what_they_saw("one-q-session", "In the Helpdesk.")
		self.assertTrue(sent.startswith("In the Helpdesk." + goals.SYSTEM_NOTE))
		self.assertIn("Where is it logged?", sent)
		self.assertEqual(one_question.with_what_they_saw("one-q-session", "Next."), "Next.")
