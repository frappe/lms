from frappe.tests import IntegrationTestCase

from lms.lms.ai import goals


class TestRoleplayReplies(IntegrationTestCase):
	"""A greeting or a request to repeat does not use up one of the learner's role-play replies."""

	def test_only_answers_count(self):
		self.assertFalse(goals.counts_as_reply("thanks for making time"))
		self.assertFalse(goals.counts_as_reply("can you please repeat your question"))
		self.assertTrue(goals.counts_as_reply("I log the complaint and fix the root cause myself"))
